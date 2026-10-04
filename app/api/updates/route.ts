import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireAssignment, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { reportSchema } from "@/lib/schema";
import { addUpdate } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const body = reportSchema.parse(await readJson(request));
    const assignment = requireAssignment(store, identity, body.assignmentId);
    const update = { ...body, id: crypto.randomUUID(), createdAt: new Date().toISOString(), projectId: assignment.projectId, personId: identity.personId };
    await addUpdate(update);
    return NextResponse.json({ update }, { status: 201 });
  } catch (e) { return apiError(e); }
}
