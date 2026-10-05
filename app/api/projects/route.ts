import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { saveProject } from "@/lib/store";
import { planProjectChange, planProjectCreation } from "@/lib/project-details";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const project = planProjectCreation(
      store,
      identity,
      await readJson(request),
    );
    if (store.projects.some((p) => p.id === project.id))
      return NextResponse.json({ project });
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
