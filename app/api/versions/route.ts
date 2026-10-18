import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { addVersion } from "@/lib/store";
import { planVersion } from "@/lib/versions";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    const version = planVersion(store, identity, await readJson(request));
    if (!store.versions.some(v => v.id === version.id)) await addVersion(version);
    return NextResponse.json({ version }, { status: 201 });
  } catch (e) { return apiError(e); }
}
