import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { assignmentSchema } from "@/lib/schema";
import { saveAssignment } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext(); requireAdmin(identity);
    const body = assignmentSchema.parse(await readJson(request));
    if (!store.projects.some(p => p.id === body.projectId) || !store.people.some(p => p.id === body.personId)) throw new AppError("Choose an existing project and person.");
    const existing = body.id ? store.assignments.find(a => a.id === body.id) : undefined;
    if (body.id && !existing) throw new AppError("Assignment not found.", 404);
    if (existing && existing.projectId !== body.projectId) throw new AppError("Keep existing responsibilities on their original project. Create a new responsibility for a different project.");
    const assignment = { ...body, id: existing?.id ?? crypto.randomUUID() };
    await saveAssignment(assignment, Boolean(existing));
    return NextResponse.json({ assignment });
  } catch (e) { return apiError(e); }
}
