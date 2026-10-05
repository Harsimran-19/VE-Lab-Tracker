import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { planEntry } from "@/lib/entries";
import { saveUpdate } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const update = planEntry(store, identity, await readJson(request));
    await saveUpdate(update);
    return NextResponse.json({ update });
  } catch (e) {
    return apiError(e);
  }
}
