import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { projectSchema } from "@/lib/schema";
import { saveProject } from "@/lib/store";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext(); requireAdmin(identity);
    const project = projectSchema.parse(await readJson(request));
    if (!store.projects.some(p => p.id === project.id)) throw new AppError("Project not found.", 404);
    await saveProject(project);
    return NextResponse.json({ project });
  } catch (e) { return apiError(e); }
}
