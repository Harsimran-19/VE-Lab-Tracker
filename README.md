# VE Lab Tracker

A weekly project tracker for one Venture Engineering Lab team, supporting Research, Startup, Lab Management and Fund Sourcing work. Google handles sign-in; Google Sheets stores all persistent data; Vercel hosts the app. Zoho SMTP sends reminders using the existing InternUp mailbox. No new domain is needed.

## Workflow

Manager: sign in → create a project with its type, goal, team, supervisors and phase → review project progress, member sign-ins, missing updates and help requests on the Home dashboard.

Member: Google sign-in → confirm name → choose projects → My work → report accomplishments and next step. “I need help” reveals a required blocker explanation. Saving again edits the same current-week report.

- **Home:** manager lab overview or the member's own work.
- **Projects:** discover and join active projects, read shared reports, or review completed projects.
- **Project page:** Overview opens first with the milestone, responsibilities, type and folder. Updates, Resources, People and Activity use the existing tabs. Assigned members can edit ordinary details and progress through **Project settings** and the existing editors. The project lead, supervisors and lab managers additionally manage the team, reporting relationships, lead, type, folder and pause/complete/reopen state. Earlier weekly reports remain available.
- **Team:** every actual signup, including people without projects. Both roles can open a member’s contact details and project links from this directory or a report/project member name.
- **Account:** name, academic role, affiliation and email preference are visible directly. Role and affiliation are optional and appear in the shared team directory. Managers also set the reporting day, time and timezone and test their email delivery.

The creation form asks for the project name and project goal, with project type, lead, priority, project phase and Methods. Project members and supervisors both support multiple selections; a person may hold both roles. Every project type starts at Ideation. The seven phases are Ideation, Design, Alpha prototype, Alpha prototype testing, Beta prototype, Beta prototype testing and In use. Existing historical phase values remain unchanged. Steady is an editable priority default. The creator is the default lead; selecting another lab member gives that person project membership. Milestones and publication details are added later through project settings. A milestone must have both a description and a date. Assigned members can maintain responsibilities for current project members. Responsibilities can be archived and restored. External collaborators remain contacts and grant no access.

Managers can choose **Team → Add lab member** to create an invitation link for a Google email. Project leads, supervisors and managers can also choose **People → Invite new member** within a project. Share the generated link with the recipient; invitations are not emailed automatically. The recipient must sign in with the addressed, verified Google account, accept the invitation and complete their own profile. Project invitations grant contributor access, never supervisor or manager privileges. Invitations expire after 14 days and can be revoked. They do not create placeholder accounts in Team. The existing lab-wide sign-in and self-join policy remains available.

Each project has **Form requests → Request a form** for asking one or more existing project members to complete an initiation or task form. Members see requests on Home, open the form from the project, and complete it by saving. Initiation requests omit milestone and publication sections; task requests use the existing responsibility form. The project tracks each recipient’s completion separately. The manager’s Home dashboard shows all projects, phases, task completion, weekly reporting and the last successful Google sign-in for each member. Sign-in tracking starts with this release; it does not infer historical logins or online presence.

Projects shows the designated lead and all supervisors, with type and folder filters composing with the existing search and project-state filters. Folders group projects at one level; moving a project preserves its URL and content. Only lab managers manage folders. Removing a folder leaves its projects ungrouped. People supports multiple researchers and supervisors, overlapping responsibilities and project-scoped reporting to one or more supervisors. Existing lab-wide visibility and self-join behavior remain unchanged.

Weekly reports still ask for accomplishments, next steps and help needed. Members can optionally tag several of their responsibilities in one report. The server records their names with the report so earlier reports remain understandable after responsibilities change. Hours, meetings and reference files are optional. Reports derive the author, timestamps and week server-side. Managers cannot edit another member's report.

## Approvals, profiles, hours and versions

- **Project requests:** any lab member can choose **Propose a project**. It appears under **Projects → Awaiting approval** and on the manager's Home page until a lab manager (`ADMIN_EMAILS`) approves it or sends feedback. The team can refine a pending project; weekly reports, joining and reminders start once it is approved. A project that was not approved can be edited and resubmitted. Projects that existed before approvals were added stay approved.
- **Project attributes:** project members can propose attributes such as a funding source, dataset or partner institution. A member's new or changed attribute waits for the manager's approval; managers' own attributes are approved immediately. Members cannot remove an approved attribute.
- **Fund Sourcing** is a project type alongside Research, Startup and Lab Management.
- **Profiles:** Account holds an optional bio, research interests, skills and up to five links. Team search covers them, and each member page shows the profile and the hours they have reported.
- **Weekly reports** add optional hours, meetings with the PI and with external collaborators (scheduled or held, with dates and notes), and up to ten reference-file links. Projects show weekly and total hours per member.
- **Data & outputs:** each project tab lists Data, Paper and Code items. Every save adds a numbered version (v1, v2, …) with a link, what changed, who saved it and when; earlier versions are never edited or removed. The tab flags data that has not been versioned for over a week. Versions are stored in the append-only `LabVersions` tab.

## Production, test and dev versions

See [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md). `main` is production, `test` is a Google-login copy for trying changes with lab members, and `dev` is a sample workspace with no sign-in. Non-production versions show a banner and refuse to load against the live spreadsheet when `PRODUCTION_GOOGLE_SHEET_ID` is set.

## Testing both roles on your deployment

1. Sign in as the manager. Open **Team** to see everyone who has signed in; click a name for email and project links.
2. In a separate private browser window, sign in with a different Google email, confirm the name and choose projects later.
3. Reload the manager’s Team page. The new person appears even without joining a project.
4. As the member, open Projects, join your test project and submit a weekly update. As the manager, open that project to read the report and click the author’s name to see their details.

Creating a project does not create members. Members appear after their own Google sign-in.

## Fresh Google Sheets data

The app creates **LabProjects, LabMembers, LabMemberships, LabReports, LabSettings, LabDeliveries, LabFolders, LabActivity, LabRevision, LabVersions, LabInvitations, LabLogins** automatically when needed. Tabs from earlier releases gain the new columns on first load; `LabProjects` grows past column Z, so the app widens that tab's grid first. Old tracker tabs are neither read nor imported. A fresh blank spreadsheet is supported, and the existing connected spreadsheet can host these separate lab tabs without altering its old records. The app saves directly through the Sheets API without Apps Script. The optional locked writer adds protection for simultaneous saves across server instances; no data reset is needed.

Existing lab tabs upgrade additively: supported original Projects, Members, Memberships and Reports headers receive optional columns without changing old data rows. Unexpected headers are refused rather than overwritten. Resource links, responsibilities, collaborators, reporting relationships and report responsibility labels use validated JSON. Existing IDs, URLs, content and phase values survive. Legacy types remain Unclassified; unknown leads remain Unassigned. A recorded lead with a valid lab profile receives membership without an invented join date. No historical supervisors, reporting links, actors or dates are guessed. See [collaboration setup and migration](docs/COLLABORATION_SETUP.md).

Google signup requires a verified email. Manager permissions come from `ADMIN_EMAILS`; users cannot choose their role. `harsimran1869@gmail.com` is the designated test manager. Google login requests only `openid`, `email`, `profile`; the service account writes to Sheets. Writes use RAW values. Delivery logs stay server-side.

One deterministic report ID per person/project/week prevents duplicate logical reports on retries. Current-week reports can be edited; past weeks cannot be backdated by the client. Membership IDs are stable. Project-domain changes use integer record versions and an atomic Sheets batch commit to save the change and append-only activity together. An optional shared, locked Apps Script writer serializes these commits across server instances. Stale saves preserve the newer data; forms retain unsaved input and allow explicit review and retry. The server derives the actor and time. Without the configured writer, the app still saves directly to Sheets, but simultaneous saves on separate server instances can race.

## Email policy

- Outstanding weekly updates: one combined reminder per member/week during the 24 hours before the cutoff.
- Project milestones: one reminder the day before and one on the due date.
- Responsibility deadlines: reminders to the owner the day before and on the due date; done and archived responsibilities are excluded.
- Managers: one weekly summary after the reporting cutoff, including missing reports and unresolved help.
- Completed and paused projects and opted-out recipients are excluded. Members joining after the cutoff are not counted missing until next week. Legacy memberships with unknown join dates are excluded until a real report establishes participation. Removed members receive no responsibility reminders for that project.

`vercel.json` runs a daily check at 04:00 UTC. The manager summary arrives on the first scheduled run after the cutoff; exact-minute delivery is not promised. The schedule defaults to Friday 18:00 Asia/Shanghai (China time) and is changed in the app.

Email uses `ZOHO_EMAIL` and `ZOHO_PASSWORD` in private ENV settings. `lib/mail-config.ts` fixes InternUp’s endpoint at `smtp.zoho.com:587` with required STARTTLS; host and port are not ENV inputs. A separate strong `CRON_SECRET` protects scheduling. SMTP has no idempotency guarantee: a delivery is reserved before sending; any uncertain attempt is held for review instead of automatically resent. Avoid overlapping cron runs. Test emails can go only to the signed-in manager's Google address. See [the setup guide](docs/GOOGLE_SETUP.md) for exact copy/paste instructions and recovery steps.

## Development and verification

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Do not copy the example over an existing private ENV file. Set `DEMO_MODE=true` for credential-free local testing: the test workspace starts empty, and you create its projects. The development-only switch lets you try a new member. In-memory test data resets on restart; sample emails are simulated. Demo authentication is unavailable in production; on Vercel it works only on preview deployments that set `DEMO_MODE=true` (the dev version).

```bash
npm test
npm run build
npm run typecheck
npm run test:e2e
```

Stop this checkout's dev server before browser tests, which start dev on 3100 and production on 3101. Chromium uses `/usr/bin/chromium` if present; otherwise install the Playwright browser. Tests verify real browser journeys, authorization, report editing, fresh Sheets contracts, local cutoff rules and mocked SMTP. Actual Google consent, Sheets permissions, inbox delivery and Vercel cron need deployment credentials.

## Deployment

The user handles Vercel deployment. Keep the existing Google Sheets connection and deploy the updated app; new lab tabs and columns are added automatically. No manual sheet edits or Apps Script deployment are needed when using direct Sheets saves. For a new installation, set the private variables from `.env.example`, configure the matching Google callback and set `DEMO_MODE=false`. The [locked writer setup](docs/COLLABORATION_SETUP.md) is optional; if already configured, update that writer alongside the app and stop old writers during cutover. Credentials belong in private Vercel/cloud settings or ignored `.env.local`; never in Git or chat. Cloud and Vercel configuration are separate. [fictional.env](docs/fictional.env) demonstrates invalid example values.
