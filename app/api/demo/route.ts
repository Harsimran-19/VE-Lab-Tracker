import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";
import { requireSameOrigin } from "@/lib/access";
import { apiError } from "@/lib/api";
export async function POST(request: Request) {
  if (!isDemo()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    requireSameOrigin(request);
    const form = await request.formData();
    const view = form.get("view") === "member" ? "member" : "admin";
    const response = NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL || request.url), 303);
    response.cookies.set("ve-demo-view", view, { httpOnly: true, sameSite: "strict", path: "/" });
    return response;
  } catch (e) { return apiError(e); }
}
