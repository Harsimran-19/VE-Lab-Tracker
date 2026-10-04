import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests/browser", timeout: 60000, fullyParallel: false, workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3100", headless: true, screenshot: "only-on-failure", trace: "retain-on-failure", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined) } },
  webServer: [
    { command: "npm run dev -- --port 3100", url: "http://localhost:3100", reuseExistingServer: false, timeout: 120000, env: { DEMO_MODE: "true", VERCEL: "", NEXTAUTH_URL: "http://localhost:3100", NEXTAUTH_SECRET: "local-browser-tests-only-not-a-deployment-secret", ADMIN_EMAILS: "harsimran1869@gmail.com" } },
    { command: "npm run start -- --port 3101", url: "http://localhost:3101", reuseExistingServer: false, timeout: 120000, env: { DEMO_MODE: "true", VERCEL: "", NEXTAUTH_URL: "http://localhost:3101", NEXTAUTH_SECRET: "local-production-tests-only-not-a-deployment-secret", ADMIN_EMAILS: "harsimran1869@gmail.com", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", GOOGLE_SERVICE_ACCOUNT_EMAIL: "", GOOGLE_PRIVATE_KEY: "", GOOGLE_SHEET_ID: "" } }
  ]
});
