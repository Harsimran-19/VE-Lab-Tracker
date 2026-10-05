# VE Lab Tracker

A simple weekly research tracker for one Venture Engineering Lab team. Google handles sign-in; Google Sheets stores all persistent data; Vercel hosts the app. Zoho SMTP sends reminders using the existing InternUp mailbox. No new domain is needed.

## Workflow

Manager: sign in → create a project with its name and goal → share the website → review weekly progress, missing updates, help requests and deadlines.

Member: Google sign-in → confirm name → choose projects → My work → report accomplishments and next step. “I need help” reveals a required blocker explanation. Saving again edits the same current-week report.

- **Home:** manager lab overview or the member's own work.
- **Projects:** discover and join active projects, read shared reports, or review completed projects.
- **Project page:** latest reports and real members. Managers change research phase, set a milestone and date, or complete/reopen the project. Earlier weeks are available when history exists.
- **Team:** every actual signup, including people without projects. Both roles can open a member’s contact details and project links from this directory or a report/project member name.
- **Account:** name and email preference. Managers also set the reporting day, time and timezone and test their email delivery.

Projects start in Idea and Active automatically. New projects have only two creation inputs: name and goal. There are no publication fields, affiliation/biography forms, imported people, roster linking or responsibility assignment. Team is a shared directory; members sign themselves up. Reports derive the author, timestamps and week server-side. Managers cannot edit another member's report.

## Testing both roles on your deployment

1. Sign in as the manager. Open **Team** to see everyone who has signed in; click a name for email and project links.
2. In a separate private browser window, sign in with a different Google email, confirm the name and choose projects later.
3. Reload the manager’s Team page. The new person appears even without joining a project.
4. As the member, open Projects, join your test project and submit a weekly update. As the manager, open that project to read the report and click the author’s name to see their details.

Creating a project does not create members. Members appear after their own Google sign-in.

## Fresh Google Sheets data

The app creates **LabProjects, LabMembers, LabMemberships, LabReports, LabSettings, LabDeliveries** automatically when needed. Old tracker tabs are neither read nor imported; production starts with zero projects and only actual Google signups. A fresh blank spreadsheet is supported, and the existing connected spreadsheet can host these separate clean tabs without altering its old records. No initialization/reset step is needed.

Google signup requires a verified email. Manager permissions come from `ADMIN_EMAILS`; users cannot choose their role. `harsimran1869@gmail.com` is the designated test manager. Google login requests only `openid`, `email`, `profile`; the service account writes to Sheets. Writes use RAW values. Delivery logs stay server-side.

One deterministic report ID per person/project/week prevents duplicate logical reports on retries. Current-week reports can be edited; past weeks cannot be backdated by the client. Membership IDs are stable. Sheets has no transactions: concurrent edits to the same report may overwrite one another. Last rows with matching IDs are the logical record.

## Email policy

- Outstanding weekly updates: one combined reminder per member/week during the 24 hours before the cutoff.
- Project milestones: one reminder the day before and one on the due date.
- Managers: one weekly summary after the reporting cutoff, including missing reports and unresolved help.
- Completed projects and opted-out recipients are excluded. Members joining after the cutoff are not counted missing until next week.

`vercel.json` runs a daily check at 04:00 UTC. The manager summary arrives on the first scheduled run after the cutoff; exact-minute delivery is not promised. The schedule defaults to Friday 18:00 Asia/Kolkata and is changed in the app.

Email uses `ZOHO_EMAIL` and `ZOHO_PASSWORD` in private ENV settings. `lib/mail-config.ts` fixes InternUp’s endpoint at `smtp.zoho.com:587` with required STARTTLS; host and port are not ENV inputs. A separate strong `CRON_SECRET` protects scheduling. SMTP has no idempotency guarantee: a delivery is reserved before sending; any uncertain attempt is held for review instead of automatically resent. Avoid overlapping cron runs. Test emails can go only to the signed-in manager's Google address. See [the setup guide](docs/GOOGLE_SETUP.md) for exact copy/paste instructions and recovery steps.

## Development and verification

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Do not copy the example over an existing private ENV file. Set `DEMO_MODE=true` for credential-free local testing: the test workspace starts empty, and you create its projects. The development-only switch lets you try a new member. In-memory test data resets on restart; sample emails are simulated. Demo authentication is unavailable in production or on Vercel.

```bash
npm test
npm run build
npm run typecheck
npm run test:e2e
```

Stop this checkout's dev server before browser tests, which start dev on 3100 and production on 3101. Chromium uses `/usr/bin/chromium` if present; otherwise install the Playwright browser. Tests verify real browser journeys, authorization, report editing, fresh Sheets contracts, local cutoff rules and mocked SMTP. Actual Google consent, Sheets permissions, inbox delivery and Vercel cron need deployment credentials.

## Deployment

The user handles Vercel deployment. Set the private variables from `.env.example`, configure the matching Google callback, set `DEMO_MODE=false`, and redeploy. Credentials belong in private Vercel/cloud settings or ignored `.env.local`; never in Git or chat. Cloud and Vercel configuration are separate. [fictional.env](docs/fictional.env) demonstrates invalid example values.
