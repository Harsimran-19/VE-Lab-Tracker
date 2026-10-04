import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { workspaceFor } from "@/lib/access";
import { apiError } from "@/lib/api";
import { adminEmails, isDemo } from "@/lib/config";
export async function GET() {
  try {
    const { identity, store } = await authorizedContext();
    return NextResponse.json(workspaceFor(store, identity, isDemo(), adminEmails()));
  } catch (e) { return apiError(e); }
}
