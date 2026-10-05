import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { newProjectSchema } from "@/lib/schema";
import { saveProject } from "@/lib/store";
import { planProjectChange } from "@/lib/project-details";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    requireAdmin(identity);
    const input = newProjectSchema.parse(await readJson(request));
    const existing = store.projects.find((p) => p.id === input.id);
    if (existing) {
      if (existing.name !== input.name || existing.goal !== input.goal)
        throw new AppError(
          "This project already exists. Refresh to review it.",
          409,
        );
      return NextResponse.json({ project: existing });
    }
    const project = {
      ...input,
      phase: "Idea",
      milestone: "",
      due: "",
      state: "active" as const,
    };
    await saveProject(project);
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const project = planProjectChange(store, identity, await readJson(request));
    await saveProject(project);
    return NextResponse.json({ project });
  } catch (e) {
    return apiError(e);
  }
}
