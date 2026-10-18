// The sample workspace runs locally, or on a Vercel preview (the dev version)
// when DEMO_MODE is set for that preview. It never runs in production.
export function isDemo(env: NodeJS.ProcessEnv = process.env) {
  if (env.DEMO_MODE !== "true") return false;
  if (env.VERCEL) return env.VERCEL_ENV === "preview";
  return env.NODE_ENV === "development";
}
export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
}
export function missingConfig() {
  return ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_SHEET_ID", "ADMIN_EMAILS"].filter(k => !process.env[k]?.trim());
}
