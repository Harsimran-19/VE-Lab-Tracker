import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError } from "@/lib/access";
import { apiError } from "@/lib/api";
export async function GET(request: Request) {
  try {
    const { store } = await authorizedContext();
    const query = new URL(request.url).searchParams;
    const projectId = query.get("projectId");
    if (!store.projects.some(p => p.id === projectId)) throw new AppError("Project not found.", 404);
    const rows = store.activities.filter(a => a.projectId === projectId).reverse();
    const cursor = query.get("before");
    const index = cursor ? rows.findIndex(a => a.id === cursor) : -1;
    if (cursor && index === -1) throw new AppError("Reload the activity history.", 409);
    const activities = rows.slice(index + 1, index + 21);
    return NextResponse.json({ activities, hasMore: rows.length > index + 21 });
  } catch (e) { return apiError(e); }
}
