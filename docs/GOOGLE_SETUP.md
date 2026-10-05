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
5. On **Lab overview**, click **Invite the lab** and share the website. Members sign in with their own Google account.
6. Test another Google account in a private browser window. The welcome screen asks for **Your name**, then **Your projects**. Select a project and click **Open my workspace**.
7. On **My work**, click **Write update**. Write progress, choose a status, and **Publish update**. The report appears in the Sheet’s **Updates** tab and the project’s **Weekly progress**.
8. **My profile** is always visible in navigation. Add expertise and reminder preferences. **Teammates** lets people find collaborators.
9. A member already listed in the spreadsheet can select **Existing lab name** during welcome. Their account works immediately. The admin confirms the previous-history connection under **Teammates → Connect existing lab profiles**; selecting a name alone never grants another person’s identity or admin role.

**Already using the app?** Keep the current Sheet and its records. Do not initialize it again. Optional `Profiles`, `Onboarding`, and `Reminders` tabs are created automatically when needed. Existing members complete the welcome steps once; their existing Google email and reports remain attached to them.

For cloud settings, review/save the changes and publish the environment configuration; I can then restart and check the connection here. Actual Google browser login still needs a reachable app URL with the matching redirect URI.

## Step 8 — Free Gmail reminders (no purchased domain)

Use an existing Gmail account as the sender. Google Sheets stores every record; Vercel checks deadlines daily. Keep using your free `.vercel.app` website URL.

### 8A. Copy your Gmail sender address

1. Choose the Gmail account to send lab reminders from. For testing, you can use `harsimran1869@gmail.com`.
2. Open **Vercel → your project → Settings → Environment Variables → Production**.
3. Create this variable:

| Copy                                 | Paste into variable | Example                   |
| ------------------------------------ | ------------------- | ------------------------- |
| The complete Gmail address you chose | `GMAIL_USER`        | `harsimran1869@gmail.com` |

### 8B. Create and copy a Google app password

1. Sign in to the **same Gmail account** from 8A.
2. Open [Google Account Security](https://myaccount.google.com/security).
3. Open **2-Step Verification** and turn it on if it is not already enabled.
4. Open [App passwords](https://myaccount.google.com/apppasswords).
5. Enter **VE Lab Tracker** as the app name and click **Create**.
6. Google shows a **16-character app password**. Copy it now.
7. Back in **Vercel → Settings → Environment Variables → Production**, create:

| Copy                                                | Paste into variable  | Example (fictional) |
| --------------------------------------------------- | -------------------- | ------------------- |
| The 16-character app password Google just generated | `GMAIL_APP_PASSWORD` | `abcdefghijklmnop`  |

Paste only the app password, without quotes. Spaces are accepted. **Do not paste your regular Google login password.** Keep this value in private environment settings, never chat or GitHub. App passwords may be unavailable for accounts restricted by their organization or Advanced Protection; in that case, choose an eligible Gmail account.

### 8C. Copy a scheduler secret

1. Open Google Cloud Shell.
2. Run `openssl rand -hex 32`.
3. Copy the single output line.
4. In the same Vercel environment settings, create:

| Copy                       | Paste into variable |
| -------------------------- | ------------------- |
| The new random output line | `CRON_SECRET`       |

Keep it separate from `NEXTAUTH_SECRET`. Vercel automatically includes this secret when invoking the daily scheduler.

### 8D. Set the timezone, redeploy and test

1. Create `LAB_TIMEZONE` with value **`Asia/Kolkata`** (or **`Asia/Hong_Kong`** if that is the lab’s timezone).
2. Save the variables and **redeploy** in Vercel.
3. Sign in as the admin, open **My profile → Lab email reminders**, and click **Send me a test email**.
4. Check your Google inbox and spam folder. The app confirms Gmail acceptance, which does not by itself prove inbox delivery. Sample mode only previews the message.
5. For a real deadline test, join a project yourself. Under **Manage project**, set a milestone due tomorrow. Keep **My profile → Send me deadline reminders** checked.
6. In Vercel → **Cron Jobs**, confirm `/api/cron/reminders` appears. Use its **Run** control, if available, or wait for the next daily run. The schedule is **04:00 UTC** (09:30 India / 12:00 Hong Kong); Hobby execution can occur within that hour.
7. Confirm the deadline email arrives and a `Reminders` row has `sentAt` filled in your Sheet.

Each active deadline gets one upcoming reminder within three days, one on its due date, and one overdue reminder within seven days after. Completed work and opted-out members are excluded. This uses ordinary Gmail sending limits, suitable for a small team.

**If a send is uncertain:** Gmail SMTP cannot guarantee duplicate suppression. The app reserves a Sheet row before sending and holds unconfirmed rows instead of resending automatically. An admin should check the sender’s Gmail mail history and the recipient before resolving the row. If accepted, fill `sentAt` and `providerId` (the message ID); delete only that specific pending row if you have confirmed it was not accepted and want another attempt. Never delete the whole tab or reinitialize the Sheet. Concurrent scheduler runs should be avoided because Sheets has no transaction lock.

Old `RESEND_API_KEY` and `EMAIL_FROM` settings are no longer used and can be removed. Automated tests mock Gmail; real delivery and Vercel scheduling require the configuration above.

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
| Deadline emails not arriving         | Step 8: Gmail address + app password + cron secret, redeploy, test email, then Cron Jobs                    |
