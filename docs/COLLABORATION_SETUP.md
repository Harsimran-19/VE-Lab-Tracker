# Collaborative project storage

Google Sheets remains the sole database. A shared, locked Apps Script writer is
required for production project changes: the Sheets API has no conditional row
update or transaction combining a checked version with dependent writes. A
process-local mutex would not protect separate Vercel instances.

## Deployment-time setup (not performed by this change)

1. Back up the configured spreadsheet. Stop all old application writers and cron
   runs during cutover; do not run old and new app versions concurrently.
2. In that spreadsheet, create a bound Apps Script project. Copy
   `docs/sheets-transaction-writer.gs` into it and enable the **Google Sheets API**
   advanced service. Configure Script Properties `SPREADSHEET_ID` with the same
   spreadsheet ID as the app and `TRANSACTION_KEY` with a newly generated secret
   of at least 32 characters. Keep this secret private.
3. Deploy the script as a web app executing as the spreadsheet owner, accessible
   to anyone. The endpoint authenticates the signed request body with HMAC-SHA256,
   checks its spreadsheet binding and a 60-second expiry, and never accepts
   unsigned requests. If your Workspace policy forbids this deployment mode,
   collaborative production writes are blocked; use an approved trusted gateway
   with the same locking and atomic-batch contract before rollout.
4. Set private app variables `SHEETS_TRANSACTION_URL` to the script `/exec` URL
   and `SHEETS_TRANSACTION_KEY` to the same secret. All app instances must point
   to **one script deployment**, never separate copies. Restrict spreadsheet
   editor access to trusted operators; manual edits bypass application policies.
5. Release the application and inspect a safe test project before allowing live
   writes. No script, production schema change, or release is deployed by this
   coding task. Without these variables the existing lab remains readable, but
   project mutations fail with a setup message instead of making unsafe writes.

## Additive migration and rollback

Existing `LabProjects`, `LabMemberships`, and `LabReports` headers are extended
only when their complete old header sequence matches. `LabFolders`, `LabActivity`
and `LabRevision` are added. Existing IDs, URLs, content, research phase values,
reports, and member accounts are retained. Original non-lab tracker tabs are still
ignored. Unknown leads display Unassigned; project type is Unclassified unless a
new project is created or a manager assigns it. No supervisors or reporting links
are inferred. A valid existing lead receives project membership, with an empty
join date rather than an invented historical timestamp; unknown join dates are
excluded from missing-report calculations until a real report establishes participation. This is persisted on the
first successful project transaction. No human activity is fabricated for
migration. Existing membership join dates and report authors/timestamps survive.

The authenticated Node backend validates current membership, input, and integer
record versions. The writer serializes all project-domain writes across instances,
compares a monotonically increasing lab revision, then commits the project rows,
team, reports, folders, new activity entries, and revision in one atomic Sheets
`batchUpdate`. A concurrent team change invalidates the authorization snapshot.
Reads bracket their snapshot with revision reads. Failed/conflicting saves create
no activity. A timeout is explicitly an unconfirmed save: refresh before retrying.
Unchanged submissions create no events. Full domain tables are updated under the
lock, appropriate to this small lab; growing datasets will need a more scalable
transactional storage design. JSON cells over 45,000 characters are refused safely.

The new app continues the existing lab-wide visibility and self-join behavior;
there is one lab per configured spreadsheet. Ordinary assigned members can edit
project details/progress; lead and supervisors can additionally manage the team,
lead, type, folder and pause/complete/reopen state. Only existing `ADMIN_EMAILS`
managers create projects and manage folders. External contacts never grant access.
A removed member loses write access immediately, but may deliberately rejoin an
active project through the existing self-join flow. Restricting rejoining or
lab-wide viewing requires a separate product policy decision.

Do not roll back to an old writer against this live schema while the gateway is
active. Stop writers first; restore the backup into a separate spreadsheet for
recovery rather than resetting a shared spreadsheet. Signup, profile, settings,
and delivery-log writes remain on their existing separate Sheets paths.

## Testing the deployed app

Use a clearly named test project, such as **Collaboration test**, so existing lab
projects remain intact. For an isolated rehearsal, use a separate Vercel test
project with a copied spreadsheet and its own bound writer. A Vercel preview that
shares production Sheets credentials writes to the production spreadsheet; a
preview URL alone does not isolate data. Google login must allow the test app's
exact callback URL.

1. **Accounts and teams:** Sign in as the configured lab manager in one browser.
   In another browser or private window, sign in with a second Google account and
   finish onboarding. In the manager's **Projects → New project**, create the
   test project. Open **People → Add member** to assign the second account as a
   contributor. Add another signed-in lab account as a supervisor. A person can
   be both contributor and supervisor; add a second supervisor to verify the
   full list. Use **Set supervisors** to give a contributor one or more reporting
   relationships. Check the Projects table, Home and People for matching names.
2. **Permissions:** As the contributor, edit the goal or milestone through
   **Project settings** and save. The contributor must have no team-management
   controls. Leads and supervisors should be able to manage the team. A signed-in
   account that has not joined should be able to read the project under existing
   lab-wide visibility, but have no project editor. Remove the contributor while
   their edit form is open, then try saving from that form: the save must fail.
   Existing self-joining remains available, so do not rejoin during this check.
3. **Types and folders:** Create a Startup or Lab Management test project and
   verify that its research phase starts unset. In **Projects → Folders**, create
   a test folder. Open the project and use **Change type or folder** to assign it.
   Combine the type and folder filters with search. Move the project to another
   folder, then remove that folder using its confirmation dialog. The project
   must remain at its original URL, become ungrouped and retain its content,
   people and reports. Type changes must preserve any existing research phase.
4. **Activity:** Change a goal, milestone, team role and reporting relationship,
   then open **Activity → View changes**. Verify the actual signed-in actor,
   previous/new values and precise timestamp. Save the same values again: no new
   activity should appear. Verify that last-updated attribution matches history.
5. **Conflicts:** Open **Project settings** for the same project in two separate
   browser sessions with edit permission. Both must open their forms before
   either saves. Save a change in the first session, then save from the second.
   The second must show a conflict, keep its input and leave the first save
   intact. Select **Review latest version**, compare the saved values, then
   **Use reviewed version and keep my input**. Save separately to confirm an
   intentional retry. The rejected save must not appear in Activity.
6. **Existing features and persistence:** Add a responsibility, submit a weekly
   update, edit that same current-week report, and edit project notes/resources.
   Reload and sign out/in: the records must remain. Review long names, several
   supervisors and dialogs on a phone-sized screen. Confirm that pre-existing
   project links still work. Pause completed test projects using **Manage
   project** so they stop generating reporting expectations.

For credential-free local testing, copy the blank `.env.example` template only
if no private `.env.local` already exists. Set `DEMO_MODE=true` and
`NEXTAUTH_URL=http://localhost:3000`, then run `npm run dev` and open
`http://localhost:3000`. **Try new member** creates a local test identity;
**Manager view** switches back. Demo data is in memory and resets on restart.
Demo authentication is intentionally unavailable on Vercel and in production.

Automated checks from the repository directory:

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e -- --grep 'project collaboration|non-research|existing responsibilities|removed legacy flows'
```

Stop the checkout's dev server before Playwright runs its own servers. The focused
browser checks cover collaboration, conflict recovery, folder dialogs, existing
report/resource editing and anonymous production denial. The original full
browser suite has a pre-existing assertion expecting four navigation links; the
current application has three, so its dependent serial tests skip after that
failure. These local checks do not replace a real deployed Google-login and
Sheets-writer rehearsal.
