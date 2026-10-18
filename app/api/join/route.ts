import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, isApproved, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { joinSchema } from "@/lib/schema";
import { membershipId } from "@/lib/membership";
import { mutateProjectDomain } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    const { projectId } = joinSchema.parse(await readJson(request));
    const membership = await mutateProjectDomain(identity, "Project team", "Joined project", (store, current) => {
      const project = store.projects.find(p => p.id === projectId);
      if (!project) throw new AppError("Project not found.", 404);
      if (project.state !== "active") throw new AppError("This project is not active.", 409);
      if (!isApproved(project)) throw new AppError("This project is waiting for approval. Ask its lead to add you once it is approved.", 409);
      const existing = store.memberships.find(m => m.projectId === projectId && m.personId === current.personId);
      if (existing) return existing;
      const member = { id: membershipId(current.personId, projectId), projectId, personId: current.personId, joinedAt: new Date().toISOString(), contributor: true, supervisor: false };
      store.memberships.push(member);
      return member;
    });
    return NextResponse.json({ membership });
  } catch (e) {
    return apiError(e);
  }
}
