# VE Lab Tracker

A Next.js application for a research lab, deployed on Vercel. Google login authenticates approved members; Google Sheets is the only persistent data store.

## Start locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

For a credential-free local sample workspace, set `DEMO_MODE=true` in `.env.local`. Sample reports are clearly labeled and live only in the development server's memory. Use **Member view** to test reporting as Hars, and **Admin view** to manage the sample lab. This mode is disabled whenever `NODE_ENV` is not `development` or `VERCEL` is set, even if `DEMO_MODE=true`.

For the real app, follow [Google and Vercel setup](docs/GOOGLE_SETUP.md). Google credentials belong in `.env.local` or Vercel environment variables, never in tracked files. No database, Apps Script deployment, or Google Form is required.

## Included

- Google sign-in with verified emails and an approved member roster.
- Admin testing account: `harsimran1869@gmail.com`.
- Fifteen projects and twenty-one responsibilities transcribed from the supplied workbook.
- Project dashboard, research-stage and person filters, project details, editable milestones and publication status.
- Responsibility assignment and editing, including multiple responsibilities within a shared project.
- Member progress reports, blockers, next plans, previous-plan context, and automatic author/timestamp recording.
- Member and collaborator directories; administrators can connect member Google emails.
- One-click initialization of a **new blank Sheet**, preserving the source workbook.
- Responsive screens, keyboard-accessible dialogs, empty states, and connection errors.

Member email addresses are intentionally blank until confirmed by an administrator. Add them in **People → Edit**. Fanny's role starts as member until her confirmed Google email is added to `ADMIN_EMAILS`; the test administrator remains authorized through that environment variable.

## Storage

The app uses five normalized Sheet tabs: `Projects`, `People`, `Assignments`, `Collaborators`, `Updates`. Initialize them through the app; the original six-tab workbook uses a different schema and cannot be connected directly. Do not rename the tabs, alter headers, sort rows during writes, or insert formulas into the stored records. Use the app for routine edits.

All reads and writes happen on the server. Text is written with Sheets `valueInputOption=RAW`, preventing user input from becoming spreadsheet formulas. Session cookies do not contain service-account credentials. Signed-in members receive their assigned projects and their own reports; administrators see the full workspace. Approved members can see the people directory.

Google Sheets works well for this lab's small reporting volume. It has API quotas and does not offer database transactions or conflict detection: simultaneous admin edits to the same record can overwrite each other. Updates use append operations and UUID identifiers. The application expects one administrative initialization at a time and avoids overwriting populated tracker tabs.

## Checks

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start an isolated local sample server on port 3100; a second production server checks that sample authentication is disabled. Production tests require a completed build. The real Google OAuth consent flow and Sheet permissions must be verified with the user's credentials after deployment.

## Deployment

Import this repository into Vercel, choose Next.js, and configure the variables in `.env.example`. Set `NEXTAUTH_URL` to your stable deployment URL and add the matching Google callback URI. Use your stable deployment or a separately configured Google OAuth client for previews; arbitrary Vercel preview URLs are not automatically permitted by Google. Redeploy after changing variables. Detailed steps are in [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md).

Automated reminders, reporting schedules, and new-project creation are not included in this first version. New people/projects can be added as properly formed rows in the corresponding Sheet tabs; keep IDs unique and stable. Members are admitted only when their exact verified Google email is present, or their email is listed in `ADMIN_EMAILS`.
