export function isDemo(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "development" && env.DEMO_MODE === "true" && !env.VERCEL;
}
export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
}
export function missingConfig() {
  return ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_SHEET_ID", "ADMIN_EMAILS"].filter(k => !process.env[k]?.trim());
}
