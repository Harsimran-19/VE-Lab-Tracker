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

For cloud sample testing, keep `NEXTAUTH_URL=http://localhost:3000` and `DEMO_MODE=true`. That runs sample data; it does not provide a public browser URL or real Google login.

## Step 2 — Create a new Google Sheet

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

Use your actual ID, not this example. Keep the Sheet open for Step 4. Your original workbook stays unchanged; the app imports its projects later.

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

## Step 7 — Save, restart, and initialize

You should now have all nine variables:

| Variable                       | You obtained it in               |
| ------------------------------ | -------------------------------- |
| `NEXTAUTH_URL`                 | Step 1: app URL                  |
| `ADMIN_EMAILS`                 | Step 1: your admin email         |
| `DEMO_MODE`                    | Step 1: `false` for the real app |
| `GOOGLE_SHEET_ID`              | Step 2: Sheet URL                |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Step 4: JSON `client_email`      |
| `GOOGLE_PRIVATE_KEY`           | Step 4: JSON `private_key`       |
| `GOOGLE_CLIENT_ID`             | Step 5: OAuth Client ID          |
| `GOOGLE_CLIENT_SECRET`         | Step 5: OAuth Client secret      |
| `NEXTAUTH_SECRET`              | Step 6: generated random line    |

1. **Vercel:** save the variables, then **redeploy** your project.
2. Open your app URL from Step 1 and sign in as `harsimran1869@gmail.com`.
3. Click **Initialize lab spreadsheet** once. It fills the new Sheet with the workbook's projects and responsibilities; real reports start empty.
4. In Google Cloud, open **Google Auth Platform → Audience → Publish app** and confirm **In production** before inviting the lab. If Google blocks a test account before publication, add it under **Audience → Test users**.
5. On **Dashboard**, click **Invite the lab** and share the website. Google sign-in creates member accounts automatically.
6. Test a different Google account in a private browser window. Open **Projects**, open a project, click **Join project**, then **Weekly update → Publish update**.
7. Confirm the report appears in the Sheet’s **Updates** tab and in that project’s **Weekly updates**. All lab members can see the shared history. Your dashboard shows your projects; the admin dashboard shows reporting gaps and blockers.
8. Open **account menu → My profile** to add your position, expertise and email preference. Search **People** to find collaborators.
9. For an imported person with a blank email, the admin can use **People → pencil button** to add their exact Google email before their first login. This connects their existing workbook history. Everyone else can self-register.

**Already using the app?** Keep your current Sheet and its records. Do not initialize it again. The new `Profiles` and `Reminders` tabs are added automatically when first needed.

For cloud settings, review/save the changes and publish the environment configuration; I can then restart and check the connection here. Actual Google browser login still needs a reachable app URL with the matching redirect URI.

## Step 8 — Activate email alerts

The app uses **Resend to send mail** and **Vercel Cron to check deadlines daily**. All tracker records and delivery logs stay in Google Sheets. There is no database to create.

### 8A. Choose and verify the sender

1. Create an account at [Resend](https://resend.com).
2. Open **Domains → Add domain**. Enter a domain you own, such as `your-lab.org`.
3. Copy **each DNS record Resend shows** into that domain’s DNS settings. Return to Resend and click **Verify**.
4. Choose a sender at that domain, for example `lab@your-lab.org`.

**Copy → paste into Vercel → Settings → Environment Variables → Production:**

| Copy from                          | Variable name | Exactly what to paste                              |
| ---------------------------------- | ------------- | -------------------------------------------------- |
| The sender at your verified domain | `EMAIL_FROM`  | `VE Lab <lab@your-lab.org>` using your real domain |

You cannot use a Gmail address as a Resend sender because you do not own `gmail.com`. Resend’s default test sender can send only to your own Resend account email; it is suitable for a first personal test, not the whole lab.

### 8B. Create the email service key

1. In Resend, open **API Keys → Create API key**.
2. Give it **Sending access** for your verified domain.
3. Copy the key shown once.

| Copy from            | Variable name    | Destination                                 |
| -------------------- | ---------------- | ------------------------------------------- |
| Resend’s new API key | `RESEND_API_KEY` | Vercel → Environment Variables → Production |

Keep the key private. Do not paste it in chat or GitHub.

### 8C. Protect the scheduler

1. Open Google Cloud Shell again.
2. Run `openssl rand -hex 32`.
3. Copy the single output line.

| Copy from                   | Variable name | Destination                                 |
| --------------------------- | ------------- | ------------------------------------------- |
| This new random output line | `CRON_SECRET` | Vercel → Environment Variables → Production |

This is a separate secret from `NEXTAUTH_SECRET`. Vercel uses it automatically to authenticate the scheduler. The app rejects unauthorized requests.

### 8D. Set the timezone and deploy

| Variable name  | Exactly what to paste                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| `LAB_TIMEZONE` | `Asia/Kolkata` for India, or `Asia/Hong_Kong` if the lab follows Hong Kong time |

1. Save the variables and **redeploy**.
2. In Vercel → **Cron Jobs**, confirm `/api/cron/reminders` appears. The included `vercel.json` schedules one daily check at **04:00 UTC** (09:30 India / 12:00 Hong Kong). Hobby scheduling can run anywhere within that hour.
3. Admins create deadline dates using **Projects → open project → Manage project**, or **Team & responsibilities → Assign/Edit**.
4. Members opt in or out in **My profile**. The default is enabled. Recipients must have an actual Google email and belong to the project.
5. For a first real test, join a project with your own Google account and set a milestone due tomorrow. Use the next scheduled run or the **Run** control in Vercel’s Cron Jobs view. Check **Resend → Emails** for acceptance/delivery and your inbox. Do not infer delivery from the app’s “configured” label alone.

Each deadline gets **one upcoming reminder within three days**, **one on its due date**, and **one overdue reminder within seven days after**. Missing a daily run can recover within those windows. Completed responsibilities stop their reminders. Changing a deadline creates a new reminder cycle. The scheduler does not send email in local sample mode.

The admin Dashboard shows email configuration and counts of accepted/pending deliveries. If a delivery remains unconfirmed for 23 hours, the app holds it for review to avoid sending a duplicate after Resend’s 24-hour idempotency window. Inspect the corresponding email in Resend. If delivered, fill that `Reminders` row’s `sentAt` and `providerId`; if you confirm it was never accepted, delete only that pending row so a future run can retry. Never delete the whole tab or initialize the Sheet again.

Email service credentials were not available during development. Automated delivery was tested with mocked provider responses; real sender verification, delivery and Vercel scheduling require the steps above.

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

EMAIL_FROM="VE Lab <lab@fictional-lab.org>"
RESEND_API_KEY=re_FICTIONAL_EMAIL_KEY_NOT_VALID
CRON_SECRET=FICTIONAL_CRON_SECRET_REPLACE_WITH_64_RANDOM_HEX_CHARACTERS
LAB_TIMEZONE=Asia/Kolkata
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
| Original workbook attached directly  | Step 2: use a new blank Sheet, then initialize it in Step 7                                                 |
| Existing app Sheet / changed headers | Restore the expected headers from `lib/sheets.ts`. Keep the current Sheet and records; do not reinitialize  |
| Deadline emails not arriving         | Step 8: verified sender, all three mail variables, redeploy, Cron Jobs and Resend delivery logs             |
