# VE Lab Tracker

A Next.js application for a research lab, deployed on Vercel. Google login creates member accounts automatically; Google Sheets is the only persistent data store.

## Start locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

For a credential-free local sample workspace, set `DEMO_MODE=true` in `.env.local`. Sample reports are clearly labeled and live only in the development server's memory. Use **Member view** to try an existing member, **New member view** to test self-registration with no assigned work, and **Admin view** to review the sample lab. This mode is disabled whenever `NODE_ENV` is not `development` or `VERCEL` is set, even if `DEMO_MODE=true`.

For the real app, follow [Google and Vercel setup](docs/GOOGLE_SETUP.md). Google credentials belong in `.env.local` or Vercel environment variables, never in tracked files. No database, Apps Script deployment, or Google Form is required.

## Included

- Google sign-in with verified emails and automatic member registration in Sheets.
- Admin testing account: `harsimran1869@gmail.com`.
- Fifteen projects and twenty-one responsibilities transcribed from the supplied workbook.
- One admin overview showing people, projects, entries, progress, and blockers; person/status/search filters.
- Responsibility assignment and editing, including multiple responsibilities within a shared project.
- Member progress reports, blockers, next plans, previous-plan context, and automatic author/timestamp recording.
- Members choose existing projects or create their own and submit entries without admin assignments.
- Optional admin corrections to Google emails, roles, project details, and legacy responsibilities.
- Admin-only, read-only member previews that work in production without changing the signed-in account.
- A member home page with one Add entry action and their own saved entries.
- One-click initialization of a **new blank Sheet**, preserving the source workbook.
- Responsive screens, keyboard-accessible dialogs, empty states, and connection errors.

## Self-service workflow

1. The administrator initializes the new Sheet once and shares the website using **Copy invite link**.
2. Anyone who can access the external Google login signs in with their verified Google account. A member row is created automatically; they cannot choose an administrator role.
3. The member chooses **Add entry**, selects an existing project or creates a new one, describes their progress, and saves. The app records their name, date, and project membership automatically. No admin-created account or assignment is required.
4. The administrator sees everyone and all entries on **Lab overview**, with filters for people, progress, and blockers. Members see their own saved entries. Existing project names are available to all signed-in members so they can choose where to contribute.

**Google audience:** after initial testing, go to **Google Auth Platform → Audience → Publish app** and confirm the publishing status is **In production**. If Google restricts an account while the audience is in Testing, add it under Test users for initial testing. This is a one-time Google configuration, not an ongoing app approval step. Login uses only `openid`, `email`, and `profile`; the service account performs Sheet access separately.

Existing workbook rows and responsibilities remain intact. An existing matching Google email retains its original identity and role. Blank-email workbook records are never claimed automatically by display name. An admin can optionally edit that imported person’s email to link their existing workbook history before they first sign in.

Admins can make occasional corrections with a person’s edit button or a project’s details. The eye button previews a member’s experience without changing the administrator session; previews remain read-only. `ADMIN_EMAILS` defines the workspace owner. Self-signup always grants Member access, and the owner and active administrator cannot be demoted through the app.

## Storage

The app uses five normalized Sheet tabs: `Projects`, `People`, `Assignments`, `Collaborators`, `Updates`. Initialize them through the app; the original six-tab workbook uses a different schema and cannot be connected directly. Do not rename the tabs, alter headers, sort rows during writes, or insert formulas into the stored records. Use the app for routine edits.

All reads and writes happen on the server. Text is written with Sheets `valueInputOption=RAW`, preventing user input from becoming spreadsheet formulas. Session cookies do not contain service-account credentials. Signed-in members receive their assigned projects and their own reports; administrators see the full workspace. The people overview and other members’ contact details are available only to administrators.

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

Automated reminders and reporting schedules are not included. Accounts and projects are created through the app and stored in the existing five Sheet tabs; no schema migration is needed. Entry retries reuse their submission ID to recover partial writes without duplicating an already saved entry.
