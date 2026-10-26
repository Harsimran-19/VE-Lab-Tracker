import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { mutateProjectDomain } from "@/lib/store";
import { acceptInvitation, planInvitation, revokeInvitation } from "@/lib/invitations";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const input = await readJson(request);
    const invitation = await mutateProjectDomain(identity, "Invitations", "Invited member", (store, current) => planInvitation(store, current, input));
    const url = new URL(`/invite/${invitation.id}`, process.env.NEXTAUTH_URL || request.url).href;
    return NextResponse.json({ invitation, url }, { status: 201 });
  } catch (e) { return apiError(e); }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const input = z.object({ id: z.uuid(), action: z.enum(["accept", "revoke"]) }).strict().parse(await readJson(request));
    await mutateProjectDomain(identity, "Invitations", input.action === "accept" ? "Accepted invitation" : "Revoked invitation", (store, current) => input.action === "accept" ? acceptInvitation(store, current, input.id) : revokeInvitation(store, current, input.id));
    return NextResponse.json({ saved: true });
  } catch (e) { return apiError(e); }
}
