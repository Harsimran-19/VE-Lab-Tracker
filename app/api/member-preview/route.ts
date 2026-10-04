import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { memberPreview } from "@/lib/access";
import { apiError } from "@/lib/api";
import { adminEmails, isDemo } from "@/lib/config";

export async function GET(request: Request) {
  try {
    const { identity, store } = await authorizedContext();
    const personId = new URL(request.url).searchParams.get("personId") ?? "";
    // The session stays the real administrator's session. This endpoint only
    // returns a scoped, read-only workspace and never issues a member token.
    return NextResponse.json(memberPreview(store, identity, personId, isDemo(), adminEmails()));
  } catch (error) { return apiError(error); }
}
