# VE Lab Tracker

A research workspace for Venture Engineering Lab’s projects, students, RAs, postdocs and PhDs. It runs on Vercel, uses Google sign-in and stores all persistent application data in Google Sheets.

## Product flow

Google sign-in → Choose your name → Choose your projects → My work → Share weekly progress.

- **Home:** members’ work, updates to share and deadlines. Administrators see lab progress, reporting gaps and blockers.
- **Projects:** searchable research directory and self-service membership. Administrators create projects and set phases, milestones and due dates.
- **Project workspace:** research phase, milestone, team responsibilities, external collaborators and everyone’s weekly updates. Updates record progress, status, blockers and next week’s plan with automatic author/date. History and member filtering support performance reviews.
- **Teammates:** find collaborators through expertise, position, interests and project involvement.
- **My profile:** name, affiliation, position, expertise, research interests and deadline email preference; always visible in navigation.
- **Deadline emails:** daily Vercel scheduler, Gmail SMTP delivery and Google Sheets delivery ledger. One upcoming, due-date and overdue reminder per deadline. Completed responsibilities and opted-out members are excluded.

Accounts are created automatically with Member access. No routine admin registration or assignment is needed. The welcome flow asks members to choose their name and projects. Matching Google emails retain their workbook identity. A blank-email imported name can be selected to request its previous history; the admin confirms the connection before history is moved to the new Google account. `harsimran1869@gmail.com` is the designated test administrator. Administrator corrections and read-only member previews live in Teammates.

## Start locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

For credential-free development, set `DEMO_MODE=true`. Use Member view, New member view and Admin view to test the flow. Sample reports are labeled; in-memory data resets on server restart. Email sending is disabled. Demo authentication is unavailable in production or whenever `VERCEL` is set.

For real Google and email connections, use the exact copy/paste steps in [the setup guide](docs/GOOGLE_SETUP.md). Credentials belong in ignored `.env.local` or private environment settings. Cloud and Vercel variables are separate; configuring one does not configure the other. [fictional.env](docs/fictional.env) demonstrates formatting with invalid example values.

## Google Sheets

A new blank Sheet is initialized once with 15 projects and 21 responsibilities from the supplied workbook. Real weekly updates start empty. Required tabs: `Projects`, `People`, `Assignments`, `Collaborators`, `Updates`. Optional `Profiles`, `Onboarding` and `Reminders` tabs are added on first use; existing normalized app Sheets remain compatible. Do not reinitialize an existing app Sheet or overwrite the source workbook.

Server-side reads and writes use the service account; user login requests only `openid`, `email`, `profile`. Text uses Sheets `RAW` input so it cannot become a formula. All signed-in lab members can read the shared research directory, profiles and team updates. They can write only their own profile, membership and progress. Only administrators can manage projects, accounts and responsibilities. Email delivery records stay server-side; the admin receives counts only.

Google Sheets has quotas and no transactions. The app is intended for the small lab: simultaneous edits to the same record can overwrite each other. Stable membership and signup IDs converge after concurrent appends; report retries reuse submission IDs. Reminder records are reserved before sending, without SMTP idempotency. Any unconfirmed delivery is held for review instead of automatically resending; see the setup guide.

Weeks start Monday in `LAB_TIMEZONE` (default `Asia/Kolkata`), independent of the server’s timezone. Reporting gaps indicate missing updates this week, not grades or automatic performance scores. Research stage is independent of weekly progress status.

## Verify

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Browser checks run sample mode on port 3100 and production on 3101. Stop any development server from this checkout first; Next.js permits one dev process per checkout. Chromium uses `/usr/bin/chromium` where available; otherwise run `npx playwright install chromium`. The production build is required before browser tests.

Tests cover actual UI journeys, shared visibility, write authorization, identity spoofing, Sheet contracts/migration, timezone boundaries, email preferences and retry handling. Google and email services are mocked in unit tests. Actual OAuth consent, Sheet permissions, Gmail delivery and scheduled Vercel execution require deployment credentials.

## Deploy

Import this repository into Vercel as Next.js. Add the private variables from `.env.example`, set `DEMO_MODE=false`, configure Google’s matching callback URI, and redeploy. Email uses an existing Gmail account with `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and a separate strong `CRON_SECRET`. No purchased domain is needed. Admins can test sending in My profile. `vercel.json` registers one daily reminder run at 04:00 UTC, compatible with Vercel’s daily Hobby scheduling. Arbitrary preview deployment URLs do not automatically work with Google OAuth.

The user handles deployment. Full instructions, including fictional values and exactly where each value goes, are in [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md).
