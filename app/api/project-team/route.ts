import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { mutateProjectDomain } from "@/lib/store";
import { checkVersion, planTeamChange, versionedInput } from "@/lib/collaboration";
import { teamChangeSchema } from "@/lib/schema";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const { expectedVersion, input } = versionedInput(await readJson(request));
    const parsed = teamChangeSchema.parse(input);
    const project = await mutateProjectDomain(identity, "Project team", {add:"Added member",responsibilities:"Changed project responsibilities",lead:"Changed project lead",remove:"Removed member",reporting:"Changed reporting relationships"}[parsed.action], (store, current) => {
      const project = store.projects.find(p => p.id === parsed.projectId);
      if (!project) throw new AppError("Project not found.", 404);
      const changed = planTeamChange(store, current, parsed);
      checkVersion(project.version, expectedVersion);
      return changed;
    });
    return NextResponse.json({ project });
  } catch (e) { return apiError(e); }
}
