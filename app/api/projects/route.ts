import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { newProjectSchema, projectChangeSchema } from "@/lib/schema";
import { saveProject } from "@/lib/store";
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
    requireAdmin(identity);
    const input = projectChangeSchema.parse(await readJson(request));
    const existing = store.projects.find((p) => p.id === input.id);
    if (!existing) throw new AppError("Project not found.", 404);
    const project = { ...existing };
    switch (input.action) {
      case "goal":
        project.name = input.name;
        project.goal = input.goal;
        break;
      case "phase":
        project.phase = input.phase;
        break;
      case "milestone":
        project.milestone = input.milestone;
        project.due = input.due;
        break;
      case "clear-milestone":
        project.milestone = "";
        project.due = "";
        break;
      case "complete":
        project.state = "completed";
        break;
      case "reopen":
        project.state = "active";
        break;
    }
    await saveProject(project);
    return NextResponse.json({ project });
  } catch (e) {
    return apiError(e);
  }
}
