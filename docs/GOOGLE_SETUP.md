# Setup: what to copy and where to paste it

**You do not need to create an ENV file.** Enter each name and value in your environment settings.

Choose the destination first:

- **To use the deployed app yourself:** Vercel → your project → **Settings → Environment Variables**. Select **Production**.
- **For me to test in the cloud:** this cloud environment's settings → its environment-variable fields. These are separate from Vercel; values are not synced between them.

Below, **“Add a variable” means enter its exact name and value in your chosen destination**. Use the Vercel path for the complete browser-login walkthrough. Keep credentials in those private fields.

## Step 1 — Set the app URL and your admin account

1. Open your Vercel project and copy its stable production URL, including `https://`.
2. Use the URL without a final `/` or any page path.
3. Add these three variables now:

| Variable name  | Exactly what to paste                                      |
| -------------- | ---------------------------------------------------------- |
| `NEXTAUTH_URL` | Your Vercel URL, for example `https://YOUR-APP.vercel.app` |
| `ADMIN_EMAILS` | `harsimran1869@gmail.com`                                  |
| `DEMO_MODE`    | `false`                                                    |

**Keep this URL for Step 5.** Google login must use the same address.

If you do not have a Vercel project yet, the application code must first be pushed to `Harsimran-19/VE-Lab-Tracker`, then imported into Vercel as a Next.js project. An initial deployment can show the setup screen until you finish these steps.

For cloud sample testing, keep `NEXTAUTH_URL=http://localhost:3000` and `DEMO_MODE=true`. That runs an empty local test workspace; it does not provide a public browser URL or real Google login.

## Step 2 — Create a new Google Sheet

**Already connected a Sheet?** Keep its `GOOGLE_SHEET_ID` and skip creating a new one. The app will use separate, empty Lab tabs in that spreadsheet.

1. Open [Google Sheets](https://sheets.google.com) and create a **blank spreadsheet**.
2. Name it **VE Lab Tracker — App**. Leave its blank tab alone.
3. Look at its address. Copy **only the part between `/d/` and `/edit`**.

Example address:

```text
https://docs.google.com/spreadsheets/d/1FICTIONAL_SHEET_ID_ABC123/edit
```

**Copy → paste now:**

| Copy from                                    | Variable name     | Example value                |
| -------------------------------------------- | ----------------- | ---------------------------- |
| The Sheet address, between `/d/` and `/edit` | `GOOGLE_SHEET_ID` | `1FICTIONAL_SHEET_ID_ABC123` |

Use your actual ID, not this example. Keep the Sheet open for Step 4. The app starts fresh in separate Lab tabs; it does not import old projects or people.

## Step 3 — Enable Google's Sheet connection

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Open the project selector at the top → **New Project**.
3. Name it **VE Lab Tracker**, create it, and select it.
4. Open **APIs & Services → Library**.
5. Search **Google Sheets API** → **Enable**.

**Copy → ENV: nothing in this step.** Keep this Google Cloud project selected for Steps 4–6. Its project ID is not your `GOOGLE_SHEET_ID`.

## Step 4 — Give the app permission to edit your Sheet

1. In the same Google Cloud project, open **IAM & Admin → Service Accounts**.
2. Click **Create service account**. Name it **ve-lab-sheets**, create it, and skip the optional role/access steps.
3. Open that account → **Keys → Add key → Create new key → JSON**.
4. Open the downloaded JSON file in a text editor. Find `client_email` and `private_key`.

It will resemble this **fictional** example:

```json
{
  "client_email": "ve-lab-sheets@fictional-lab-123.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nFICTIONAL_KEY_NOT_VALID\n-----END PRIVATE KEY-----\n"
}
```

**Copy → paste now:**

| Copy from the JSON file     | Variable name                  | What to include                                                                                     |
| --------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| The value of `client_email` | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The complete email address                                                                          |
| The value of `private_key`  | `GOOGLE_PRIVATE_KEY`           | The complete key, including `BEGIN PRIVATE KEY`, `END PRIVATE KEY`, and line breaks or `\n` escapes |

In environment-settings fields, paste **only the value**, without the JSON's surrounding quotation marks or trailing comma. Do not upload the JSON file to GitHub or send it in chat.

**Copy → Google Sheet sharing:**

5. Return to the new Sheet from Step 2 → **Share**.
6. Paste the **same `client_email` value** into the people field.
7. Give it **Editor** access. Keep general access **Restricted**.

If Google disables key creation or service-account sharing, your Google administrator must enable an approved method before this connection can work.

## Step 5 — Set up Google login

1. In the same Cloud project, open **Google Auth Platform**. It may also appear as **APIs & Services → OAuth consent screen**.
2. Complete **Get started / Branding**: app name **VE Lab Tracker**, plus your support and contact email.
3. Choose **External** audience. Start in **Testing** while configuring login.
4. Under **Audience → Test users**, add `harsimran1869@gmail.com`.
5. Use basic login scopes only: `openid`, `email`, `profile`. Before sharing with the whole lab, choose **Audience → Publish app** and confirm **In production**. Then users can join without being individually added as Google Test users.
6. Open **Clients → Create client → Web application**.

**Copy from Step 1 → paste into Google's client form:**

| Google form field             | What to paste                                        |
| ----------------------------- | ---------------------------------------------------- |
| Authorized JavaScript origins | The exact `NEXTAUTH_URL` from Step 1                 |
| Authorized redirect URIs      | That same URL with `/api/auth/callback/google` added |

For example, if Step 1's URL were `https://ve-lab-fictional.vercel.app`:

```text
Authorized JavaScript origin:
https://ve-lab-fictional.vercel.app

Authorized redirect URI:
https://ve-lab-fictional.vercel.app/api/auth/callback/google
```

7. Create the client. Google will give you a **Client ID** and a **Client secret**.

**Copy → paste now:**

| Copy from Google's OAuth client | Variable name          |
| ------------------------------- | ---------------------- |
| Client ID                       | `GOOGLE_CLIENT_ID`     |
| Client secret                   | `GOOGLE_CLIENT_SECRET` |

These come from the **OAuth client**. They are different from the service-account email and private key copied in Step 4.

## Step 6 — Create the login-session secret

1. In Google Cloud Console, click **Activate Cloud Shell** (`>_`) at the top.
2. Run this command in its terminal:

```bash
openssl rand -base64 32
```

**Copy → paste now:**

| Copy from                                     | Variable name     |
| --------------------------------------------- | ----------------- |
| The single random line printed by the command | `NEXTAUTH_SECRET` |

Paste only that output line, not the command. This requires no local file creation. Keep the output private.

## Step 7 — Sign in and start a fresh lab

| Variable                       | Value to copy from                |
| ------------------------------ | --------------------------------- |
| `NEXTAUTH_URL`                 | Step 1: your exact website URL    |
| `ADMIN_EMAILS`                 | Step 1: your manager Google email |
| `GOOGLE_SHEET_ID`              | Step 2: spreadsheet ID            |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Step 4: JSON `client_email`       |
| `GOOGLE_PRIVATE_KEY`           | Step 4: entire JSON `private_key` |
| `GOOGLE_CLIENT_ID`             | Step 5: OAuth Client ID           |
| `GOOGLE_CLIENT_SECRET`         | Step 5: OAuth Client secret       |
| `NEXTAUTH_SECRET`              | Step 6: random output line        |

1. Save the variables in Vercel and **redeploy**.
2. Sign in as `harsimran1869@gmail.com` (or your configured manager email).
3. The lab starts empty. Click **Create project** and enter only its **Project name** and **Goal**.
4. Click **Share website** and send the link to your team. Publish the Google OAuth audience **In production** before inviting members; during initial testing, add them under Google's **Test users**.
5. Members sign in with Google, confirm their name, and choose their projects. No roster selection, account approval or manual registration is needed.
6. A member clicks **Write update**, enters accomplishments and next step, and checks **I need help** only when relevant. Their name, date and week are automatic.
7. Saving again edits that member's current-week report. Earlier weeks remain available in the project; nobody edits another member's report.
8. The manager sees reporting gaps and help requests on **Lab overview**. Research phase and milestone changes happen inside the relevant project.
9. Under **Account & settings**, set the reporting day, time and lab timezone once. Defaults: Friday, 18:00, Asia/Kolkata.

The app automatically creates six clean tabs: **LabProjects, LabMembers, LabMemberships, LabReports, LabSettings, LabDeliveries**. They start empty except for actual Google signups and the reporting schedule. Old tracker tabs, names, projects and reports are never imported or displayed. Use a new blank spreadsheet from Step 2 if desired; an already connected workbook can also host these separate fresh tabs without changing its old data. There is no initialization or reset button to click.

<a id="gmail-reminders"></a>

## Step 8 — Email: use Gmail, no domain needed

**Email is optional. You can deploy and test Google login, projects and reports before enabling it.**

1. Open [Google App passwords](https://myaccount.google.com/apppasswords) while signed into **harsimran1869@gmail.com**. If asked, enable **2-Step Verification**. Create an app password named **VE Lab Tracker**.
2. In the prepared private **`.env.email.local`** file, paste that password after **`GMAIL_APP_PASSWORD=`**. The sender and a random scheduler secret are already filled in. Do not paste the password in chat.
3. Open **Vercel → your project → Settings → Environment Variables → Import .env**. Import/paste that file's contents, select **Production**, save, then **redeploy**.
4. In the app, open **Account & settings → Send me a test email**. Check your Gmail inbox/spam.

If entering the fields directly instead of importing:

| Vercel variable | Value |
| --- | --- |
| `GMAIL_USER` | `harsimran1869@gmail.com` |
| `GMAIL_APP_PASSWORD` | The app password from step 1 |
| `CRON_SECRET` | The generated value from your private file |

The private file is prepared in this cloud workspace and excluded from Git. Existing Google login and Sheet variables remain unchanged in Vercel. Cloud settings and Vercel settings are separate; a local file does not update Vercel automatically.

If Google does not offer App passwords, check [account eligibility](https://support.google.com/accounts/answer/185833) before choosing another Gmail sender. Use an app password, never your ordinary Google password.

<details>
<summary>Reminder timing and delivery troubleshooting</summary>

Email policy:

- **Weekly update reminder:** one email per member and week, combining only outstanding updates, in the 24-hour window before the reporting cutoff.
- **Milestone reminder:** one the day before and one on the due date, only for members of that active project.
- **Weekly manager summary:** one after the cutoff, listing reporting gaps and unresolved help requests. With daily scheduling, this arrives on the first scheduled run after the deadline.
- **Completed projects** stop report expectations and reminders. Members who join after the weekly cutoff start being counted next week. Account preferences can disable emails.

Gmail sending limits apply; this is intended for the small team. Daily cron is suitable for these reminder windows; it does not promise delivery at the exact reporting cutoff time.

**If a send is uncertain:** Gmail SMTP cannot guarantee duplicate suppression. The app reserves a Sheet row before sending and holds unconfirmed rows instead of resending automatically. An admin should check the sender’s Gmail mail history and the recipient before resolving the row. If accepted, fill `sentAt` and `providerId` (the message ID); delete only that specific pending row if you have confirmed it was not accepted and want another attempt. Never delete the whole tab or reinitialize the Sheet. Concurrent scheduler runs should be avoided because Sheets has no transaction lock.

Old `RESEND_API_KEY`, `EMAIL_FROM` and `LAB_TIMEZONE` settings are unused. Automated tests mock Gmail; real delivery and Vercel scheduling require the configuration above.

</details>

## Complete fictional ENV example

**Every value below is fictional. It shows the format only; it cannot authenticate with Google.** The variable names are the real names the app expects.

You can also open [fictional.env](fictional.env). The existing `.env.example` remains a blank template for real configuration.

```dotenv
NEXTAUTH_URL=https://ve-lab-fictional.vercel.app
ADMIN_EMAILS=admin@example.com
DEMO_MODE=false

GOOGLE_SHEET_ID=1FICTIONAL_SHEET_ID_ABC123
GOOGLE_SERVICE_ACCOUNT_EMAIL=ve-lab-sheets@fictional-lab-123.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nFICTIONAL_KEY_NOT_VALID\n-----END PRIVATE KEY-----\n"

GOOGLE_CLIENT_ID=123456789000-fictional-client.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-FICTIONAL-NOT-A-REAL-SECRET
NEXTAUTH_SECRET=FICTIONAL_SESSION_SECRET_REPLACE_WITH_GENERATED_VALUE

GMAIL_USER=fictional-sender@gmail.com
GMAIL_APP_PASSWORD=FICTIONAL_APP_PASSWORD_NOT_VALID
CRON_SECRET=FICTIONAL_CRON_SECRET_REPLACE_WITH_64_RANDOM_HEX_CHARACTERS
```

The quotes around `GOOGLE_PRIVATE_KEY` are for an **ENV file**. When entering the key in Vercel or cloud settings, omit the surrounding quotes; actual line breaks and literal `\n` escapes are both supported.

## If something fails

| Error                                | Check this step                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch`              | Step 5: Google redirect URI must use Step 1's exact URL plus `/api/auth/callback/google`                    |
| Google refuses your account          | Step 5: publish the Google audience In production, or add the account as a Test user during initial testing |
| App cannot edit the Sheet            | Step 3: enable Sheets API; Step 4: share the Sheet with `client_email` as Editor                            |
| Spreadsheet not found                | Step 2: copy only the ID; Step 4: check sharing                                                             |
| Invalid private key                  | Step 4: copy the entire `private_key` value, preserving header, footer, and newlines                        |
| Existing app Sheet / changed headers | Restore the six Lab tab headers from `lib/sheets.ts`; never overwrite existing records                      |
| Deadline emails not arriving         | Step 8: Gmail address + app password + cron secret, redeploy, test email, then Cron Jobs                    |
