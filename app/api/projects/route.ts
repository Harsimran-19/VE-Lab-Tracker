import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { mutateProjectDomain } from "@/lib/store";
import { planProjectChange, planProjectCreation } from "@/lib/project-details";
import { checkVersion, versionedInput } from "@/lib/collaboration";
import { membershipId } from "@/lib/membership";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const input = await readJson(request);
    const project = await mutateProjectDomain(identity, "Project", identity.role === "admin" ? "Created project" : "Requested project", (store, current) => {
      const created = planProjectCreation(store, current, input);
      if (store.projects.some(p => p.id === created.id)) return created;
      store.projects.push(created);
      for (const personId of new Set([current.personId, created.leadId!])) {
        store.memberships.push({ id: membershipId(personId, created.id), personId, projectId: created.id, joinedAt: new Date().toISOString(), contributor: true, supervisor: false });
      }
      return created;
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) { return apiError(e); }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const { expectedVersion, input } = versionedInput(await readJson(request));
    const verb = ({ review: "Reviewed project request", resubmit: "Resubmitted project for approval", attribute: "Saved project attribute", "remove-attribute": "Removed project attribute", "attribute-review": "Reviewed project attribute" } as Record<string, string>)[String(input.action)] ?? "Updated project";
    const project = await mutateProjectDomain(identity, "Project", verb, (store, current) => {
      const changed = planProjectChange(store, current, input);
      checkVersion(changed.version, expectedVersion);
      store.projects = store.projects.map(p => p.id === changed.id ? changed : p);
      return changed;
    });
    return NextResponse.json({ project });
  } catch (e) { return apiError(e); }
}
