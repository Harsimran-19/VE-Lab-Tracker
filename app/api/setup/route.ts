import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError } from "@/lib/api";
import { initializeStore } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext(); requireAdmin(identity);
    await initializeStore();
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
