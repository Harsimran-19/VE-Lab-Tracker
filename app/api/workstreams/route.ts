import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { planWorkstreamChange } from "@/lib/project-details";
import { mutateProjectDomain } from "@/lib/store";
import { checkVersion, versionedInput } from "@/lib/collaboration";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const { expectedVersion, input } = versionedInput(await readJson(request));
    const project = await mutateProjectDomain(identity, "Responsibilities", "Updated responsibility", (store, current) => {
      const changed = planWorkstreamChange(store, current, input);
      checkVersion(changed.version, expectedVersion);
      store.projects = store.projects.map(p => p.id === changed.id ? changed : p);
      return changed;
    });
    return NextResponse.json({ project });
  } catch (e) { return apiError(e); }
}
