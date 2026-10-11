import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { planEntry } from "@/lib/entries";
import { mutateProjectDomain } from "@/lib/store";
import { checkVersion, versionedInput } from "@/lib/collaboration";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const { expectedVersion, input } = versionedInput(await readJson(request));
    const update = await mutateProjectDomain(identity, "Weekly update", "Saved weekly update", (store, current) => {
      const update = planEntry(store, current, input);
      checkVersion(store.updates.find(u => u.id === update.id)?.version, expectedVersion);
      store.updates = [...store.updates.filter(u => u.id !== update.id), update];
      return update;
    });
    return NextResponse.json({ update });
  } catch (e) { return apiError(e); }
}
