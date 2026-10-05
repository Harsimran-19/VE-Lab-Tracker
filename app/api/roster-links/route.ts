import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { rosterLinkSchema } from "@/lib/schema";
import {
  connectionRequest,
  linkRequest,
  requireUnstartedConnection,
} from "@/lib/onboarding";
import { saveAssignment, saveUpdate, saveOnboarding } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const input = rosterLinkSchema.parse(await readJson(request));
    if (!input.approve) {
      const { request: connection, member } = connectionRequest(
        store,
        identity,
        input.id,
      );
      requireUnstartedConnection(store, connection.rosterId, member.id);
      await saveOnboarding({ ...connection, status: "declined" });
      return NextResponse.json({ saved: true });
    }
    const {
      request: connection,
      member,
      roster,
    } = linkRequest(store, identity, input.id);
    // Reserve the imported identity first. Retries by this same member are
    // safe; another pending request cannot claim the same previous work.
    const reservation = {
      id: roster.id,
      completedAt: "",
      rosterId: member.id,
      status: "linking",
      requesterEmail: member.email,
    };
    await saveOnboarding(reservation);
    for (const a of store.assignments.filter((a) => a.personId === roster.id))
      await saveAssignment({ ...a, personId: member.id }, true, true);
    for (const u of store.updates.filter((u) => u.personId === roster.id))
      await saveUpdate({ ...u, personId: member.id });
    await saveOnboarding({ ...reservation, status: "archived" });
    await saveOnboarding({ ...connection, status: "approved" });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
