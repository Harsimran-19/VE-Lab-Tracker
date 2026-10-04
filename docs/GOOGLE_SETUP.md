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

| Variable name | Exactly what to paste |
| --- | --- |
| `NEXTAUTH_URL` | Your Vercel URL, for example `https://YOUR-APP.vercel.app` |
| `ADMIN_EMAILS` | `harsimran1869@gmail.com` |
| `DEMO_MODE` | `false` |

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

| Copy from | Variable name | Example value |
| --- | --- | --- |
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

| Copy from the JSON file | Variable name | What to include |
| --- | --- | --- |
| The value of `client_email` | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The complete email address |
| The value of `private_key` | `GOOGLE_PRIVATE_KEY` | The complete key, including `BEGIN PRIVATE KEY`, `END PRIVATE KEY`, and line breaks or `\n` escapes |

In environment-settings fields, paste **only the value**, without the JSON's surrounding quotation marks or trailing comma. Do not upload the JSON file to GitHub or send it in chat.

**Copy → Google Sheet sharing:**

5. Return to the new Sheet from Step 2 → **Share**.
6. Paste the **same `client_email` value** into the people field.
7. Give it **Editor** access. Keep general access **Restricted**.

If Google disables key creation or service-account sharing, your Google administrator must enable an approved method before this connection can work.

## Step 5 — Set up Google login

1. In the same Cloud project, open **Google Auth Platform**. It may also appear as **APIs & Services → OAuth consent screen**.
2. Complete **Get started / Branding**: app name **VE Lab Tracker**, plus your support and contact email.
3. Choose **External** audience. Leave publishing status as **Testing**.
4. Under **Audience → Test users**, add `harsimran1869@gmail.com`.
5. Use basic login scopes only: `openid`, `email`, `profile`.
6. Open **Clients → Create client → Web application**.

**Copy from Step 1 → paste into Google's client form:**

| Google form field | What to paste |
| --- | --- |
| Authorized JavaScript origins | The exact `NEXTAUTH_URL` from Step 1 |
| Authorized redirect URIs | That same URL with `/api/auth/callback/google` added |

For example, if Step 1's URL were `https://ve-lab-fictional.vercel.app`:

```text
Authorized JavaScript origin:
https://ve-lab-fictional.vercel.app

Authorized redirect URI:
https://ve-lab-fictional.vercel.app/api/auth/callback/google
```

7. Create the client. Google will give you a **Client ID** and a **Client secret**.

**Copy → paste now:**

| Copy from Google's OAuth client | Variable name |
| --- | --- |
| Client ID | `GOOGLE_CLIENT_ID` |
| Client secret | `GOOGLE_CLIENT_SECRET` |

These come from the **OAuth client**. They are different from the service-account email and private key copied in Step 4.

## Step 6 — Create the login-session secret

1. In Google Cloud Console, click **Activate Cloud Shell** (`>_`) at the top.
2. Run this command in its terminal:

```bash
openssl rand -base64 32
```

**Copy → paste now:**

| Copy from | Variable name |
| --- | --- |
| The single random line printed by the command | `NEXTAUTH_SECRET` |

Paste only that output line, not the command. This requires no local file creation. Keep the output private.

## Step 7 — Save, restart, and initialize

You should now have all nine variables:

| Variable | You obtained it in |
| --- | --- |
| `NEXTAUTH_URL` | Step 1: app URL |
| `ADMIN_EMAILS` | Step 1: your admin email |
| `DEMO_MODE` | Step 1: `false` for the real app |
| `GOOGLE_SHEET_ID` | Step 2: Sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Step 4: JSON `client_email` |
| `GOOGLE_PRIVATE_KEY` | Step 4: JSON `private_key` |
| `GOOGLE_CLIENT_ID` | Step 5: OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Step 5: OAuth Client secret |
| `NEXTAUTH_SECRET` | Step 6: generated random line |

1. **Vercel:** save the variables, then **redeploy** your project.
2. Open your app URL from Step 1 and sign in as `harsimran1869@gmail.com`.
3. Click **Initialize lab spreadsheet** once. It fills the new Sheet with the workbook's projects and responsibilities; real reports start empty.
4. In **People**, add each member's exact Google email. While Google login is in Testing, also add those accounts to Google's **Test users**, as in Step 5.
5. Test a member report and confirm its new row appears in the Sheet's **Updates** tab.

For cloud settings, review/save the changes and publish the environment configuration; I can then restart and check the connection here. Actual Google browser login still needs a reachable app URL with the matching redirect URI.

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
```

The quotes around `GOOGLE_PRIVATE_KEY` are for an **ENV file**. When entering the key in Vercel or cloud settings, omit the surrounding quotes; actual line breaks and literal `\n` escapes are both supported.

## If something fails

| Error | Check this step |
| --- | --- |
| `redirect_uri_mismatch` | Step 5: Google redirect URI must use Step 1's exact URL plus `/api/auth/callback/google` |
| Google refuses your account | Step 5: add it as a Test user; Step 7: add members' emails in People |
| App cannot edit the Sheet | Step 3: enable Sheets API; Step 4: share the Sheet with `client_email` as Editor |
| Spreadsheet not found | Step 2: copy only the ID; Step 4: check sharing |
| Invalid private key | Step 4: copy the entire `private_key` value, preserving header, footer, and newlines |
| Old workbook / changed headers | Step 2: use a new blank Sheet, then initialize it in Step 7 |
