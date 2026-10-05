import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { projectSchema } from "@/lib/schema";
import { addProject, saveProject } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    requireAdmin(identity);
    const project = projectSchema.parse(await readJson(request));
    const existing = store.projects.find((p) => p.id === project.id);
    if (existing) {
      if (
        Object.keys(project).every(
          (k) =>
            project[k as keyof typeof project] ===
            existing[k as keyof typeof existing],
        )
      )
        return NextResponse.json({ project: existing });
      throw new AppError(
        "This project already exists. Refresh to review it.",
        409,
      );
    }
    await addProject(project);
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    requireAdmin(identity);
    const project = projectSchema.parse(await readJson(request));
    if (!store.projects.some((p) => p.id === project.id))
      throw new AppError("Project not found.", 404);
    await saveProject(project);
    return NextResponse.json({ project });
  } catch (e) {
    return apiError(e);
  }
}
