# Production, test and dev versions

The tracker runs as three versions from one Vercel project. Each version has
its own data so changes can be tried before they reach the live lab.

| Version | Git branch | URL | Data | Sign-in |
| --- | --- | --- | --- | --- |
| Production | `main` | https://venture-lab-tracker.vercel.app | Live spreadsheet | Google |
| Test | `test` | Vercel branch URL for `test` | A copy of the spreadsheet | Google |
| Dev | `dev` | Vercel branch URL for `dev` | In-memory sample data | None (sample workspace) |

Every page of the test and dev versions shows a yellow **Test version** or blue
**Dev version** bar. Vercel only runs the daily reminder cron on production, so
the test and dev versions never send scheduled emails.

## Release flow

1. Build on a feature branch. Vercel gives every pushed branch and pull request
   its own preview URL, which uses the **Preview** settings below.
2. Merge into `dev` to try a change quickly with sample data.
3. Merge into `test` when the PI or lab members should try it with real sign-in.
4. Merge into `main` to release. Production redeploys automatically.

## One-time setup

### 1. Create the branches

```bash
git checkout main && git pull
git branch test && git branch dev
git push -u origin test dev
```

Vercel then shows stable branch URLs under **Project → Deployments**, in the
form `https://<project>-git-test-<team>.vercel.app` and
`https://<project>-git-dev-<team>.vercel.app`. Use those exact URLs below.

### 2. Keep production settings on production only

In **Vercel → Project → Settings → Environment Variables**, open each existing
variable and make sure it applies to **Production** only. A variable that also
applies to **Preview** makes previews use the live spreadsheet. Then add
`PRODUCTION_GOOGLE_SHEET_ID` with the live spreadsheet ID to **Preview** (all
branches). Any test or dev version pointed at that spreadsheet then refuses to
load instead of writing to live data.

### 3. Test version (`test` branch)

1. In Google Sheets, open the live spreadsheet and choose **File → Make a copy**.
   Share the copy with the service account email as an **Editor**.
2. If the live app uses the locked writer, repeat
   [the writer setup](COLLABORATION_SETUP.md) inside the copy, with its own
   `TRANSACTION_KEY`. Never point the test version at the live writer.
3. In Google Cloud **APIs & Services → Credentials**, open the OAuth client and
   add `https://<test branch URL>/api/auth/callback/google` to **Authorized
   redirect URIs**.
4. In Vercel, add these variables for **Preview**, limited to the `test` branch:

   | Variable | Value |
   | --- | --- |
   | `APP_ENV` | `test` |
   | `NEXTAUTH_URL` | `https://<test branch URL>` |
   | `NEXTAUTH_SECRET` | A new random secret |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Same OAuth client as production |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Same service account |
   | `GOOGLE_SHEET_ID` | The **copy's** ID |
   | `ADMIN_EMAILS` | Same managers as production |
   | `SHEETS_TRANSACTION_URL`, `SHEETS_TRANSACTION_KEY` | The copy's writer, if used |

   Leave `ZOHO_EMAIL`, `ZOHO_PASSWORD` and `CRON_SECRET` unset so the test
   version cannot email anyone.
5. Redeploy the `test` branch.

### 4. Dev version (`dev` branch)

Add these variables for **Preview**, limited to the `dev` branch, then redeploy:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `development` |
| `DEMO_MODE` | `true` |
| `NEXTAUTH_URL` | `https://<dev branch URL>` |
| `NEXTAUTH_SECRET` | A new random secret |

The dev version opens straight into a sample workspace as the lab manager.
**Try new member** switches to a member's view, which is how to try project
requests and approvals. Sample data lives in server memory, so it resets when
Vercel starts a new instance. `DEMO_MODE` has no effect on production.

### 5. Let reviewers open previews

Vercel protects preview URLs by default, so only members of the Vercel team can
open them. To let someone outside the team open the test version, either add them to the Vercel
team or use **Share** on the deployment to create a link that skips the check.

## Local development

```bash
cp .env.example .env.local   # only if .env.local does not exist yet
npm run dev
```

With `DEMO_MODE=true` the local app uses the same sample workspace as the dev
version. Without it, point `GOOGLE_SHEET_ID` at your own copy of the spreadsheet.
