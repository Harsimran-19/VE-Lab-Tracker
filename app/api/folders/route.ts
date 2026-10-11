import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { mutateProjectDomain } from "@/lib/store";
import { planFolderChange, versionedInput } from "@/lib/collaboration";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const { expectedVersion, input } = versionedInput(await readJson(request));
    await mutateProjectDomain(identity, "Folder", "Updated folder", (store, current) => planFolderChange(store, current, input, expectedVersion));
    return NextResponse.json({ saved: true });
  } catch (e) { return apiError(e); }
}
