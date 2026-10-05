import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { joinSchema } from "@/lib/schema";
import { membershipId } from "@/lib/membership";
import { saveMembership } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const { projectId } = joinSchema.parse(await readJson(request));
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) throw new AppError("Project not found.", 404);
    if (project.state !== "active")
      throw new AppError("This project is complete.", 409);
    const membership = store.memberships.find(
      (m) => m.projectId === projectId && m.personId === identity.personId,
    ) ?? {
      id: membershipId(identity.personId, projectId),
      projectId,
      personId: identity.personId,
      joinedAt: new Date().toISOString(),
    };
    await saveMembership(membership);
    return NextResponse.json({ membership });
  } catch (e) {
    return apiError(e);
  }
}
