import { AppError } from "./access";
import type { AppEnvironment } from "./types";

// Production is the live site. Vercel previews are the test version unless
// APP_ENV says otherwise; local runs are development.
export function appEnvironment(env: NodeJS.ProcessEnv = process.env): AppEnvironment {
  if (env.VERCEL_ENV === "production") return "production";
  if (env.APP_ENV === "test" || env.APP_ENV === "development") return env.APP_ENV;
  return env.VERCEL_ENV === "preview" ? "test" : "development";
}
// A test or dev version must never write to the live spreadsheet.
export function requireSeparateSpreadsheet(env: NodeJS.ProcessEnv = process.env) {
  const live = env.PRODUCTION_GOOGLE_SHEET_ID?.trim();
  if (appEnvironment(env) !== "production" && live && live === env.GOOGLE_SHEET_ID?.trim())
    throw new AppError("This test version is connected to the live spreadsheet. Give it its own GOOGLE_SHEET_ID; see docs/ENVIRONMENTS.md.", 503);
}
