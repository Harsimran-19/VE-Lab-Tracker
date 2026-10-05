import { membershipId } from "@/lib/membership";
import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { joinSchema } from "@/lib/schema";
import { saveAssignment } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const { projectId } = joinSchema.parse(await readJson(request));
    if (!store.projects.some((p) => p.id === projectId))
      throw new AppError("Project not found.", 404);
    if (!store.people.some((p) => p.id === identity.personId))
      throw new AppError("Initialize the spreadsheet first.", 409);
    const existing = store.assignments.find(
      (a) => a.projectId === projectId && a.personId === identity.personId,
    );
    if (existing) return NextResponse.json({ assignment: existing });
    const assignment = {
      id: membershipId(identity.personId, projectId),
      personId: identity.personId,
      projectId,
      responsibility: "Project work",
      status: "In progress",
      due: "",
    };
    await saveAssignment(assignment, false);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
