import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./access";

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the form fields." }, { status: 400 });
  if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
  // Never return credential-bearing upstream responses or exceptions to the browser.
  console.error("Lab request failed:", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: "The request could not be completed. Check the Google setup or try again." }, { status: 503 });
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("Send a JSON request.", 415);
  const body = await request.text();
  if (body.length > 20000) throw new AppError("This submission is too large.", 413);
  try { return JSON.parse(body); } catch { throw new AppError("The request contains invalid JSON."); }
}
