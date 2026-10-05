import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { settingsSchema } from "@/lib/schema";
import { saveSettings } from "@/lib/store";
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity } = await authorizedContext();
    requireAdmin(identity);
    const input = settingsSchema.parse(await readJson(request));
    await saveSettings({ id: "lab", ...input });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
