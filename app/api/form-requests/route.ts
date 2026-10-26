import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { mutateProjectDomain } from "@/lib/store";
import { planFormRequest } from "@/lib/invitations";
import { checkVersion, versionedInput } from "@/lib/collaboration";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const { expectedVersion, input } = versionedInput(await readJson(request));
    await mutateProjectDomain(identity, "Form requests", "Updated form request", (store, current) => {
      const project = store.projects.find(p => p.id === input.projectId);
      if (!project) throw new AppError("Project not found.", 404);
      // Completion only sets the caller's own completion date and is safe to retry.
      if (input.action === "request") checkVersion(project.version, expectedVersion);
      return planFormRequest(store, current, input);
    });
    return NextResponse.json({ saved: true });
  } catch (e) { return apiError(e); }
}
