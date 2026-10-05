import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { planWorkstreamChange } from "@/lib/project-details";
import { saveProject } from "@/lib/store";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const project = planWorkstreamChange(
      store,
      identity,
      await readJson(request),
    );
    await saveProject(project);
    return NextResponse.json({ project });
  } catch (e) {
    return apiError(e);
  }
}
