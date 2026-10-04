import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { scopeStore } from "@/lib/access";
import { apiError } from "@/lib/api";
import { isDemo } from "@/lib/config";
export async function GET() {
  try {
    const { identity, store } = await authorizedContext();
    return NextResponse.json({ ...scopeStore(store, identity), identity, demo: isDemo(), needsSetup: !store.projects.length && !store.people.length });
  } catch (e) { return apiError(e); }
}
