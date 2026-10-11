import "server-only";
import { createHmac } from "node:crypto";
import { AppError } from "./access";
import { cells, sheetRequest, TABLES } from "./sheets";
import type { Store } from "./types";

export async function readSheetRevision(): Promise<number> {
  const data = await sheetRequest(`/values/${encodeURIComponent("'LabRevision'!A2:B2")}?valueRenderOption=UNFORMATTED_VALUE`);
  const version = Number(data.values?.[0]?.[1] ?? 0);
  if (!Number.isSafeInteger(version) || version < 0) throw new AppError("Invalid lab revision.", 409);
  return version;
}
export async function commitSheetTransaction(before: Store, next: Store) {
  const endpoint = process.env.SHEETS_TRANSACTION_URL;
  const secret = process.env.SHEETS_TRANSACTION_KEY;
  if (!endpoint || !secret || secret.length < 32)
    throw new AppError("Collaborative writes need the locked Sheets writer. Follow docs/COLLABORATION_SETUP.md.", 503);
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)) throw new AppError("Configure the Google Apps Script transaction URL.", 503);
  // Only project-domain tables are written here. Account settings, signup and
  // delivery logs keep their existing isolated write paths.
  const data = {
    LabProjects: next.projects.map(p => cells("LabProjects", p)),
    LabMemberships: next.memberships.map(m => cells("LabMemberships", m)),
    LabReports: next.updates.map(u => cells("LabReports", u)),
    LabFolders: next.folders.map(f => cells("LabFolders", f)),
    LabActivity: next.activities.slice(before.activities.length).map(a => cells("LabActivity", a)),
  };
  const payload = JSON.stringify({ schema: 1, sheetId: process.env.GOOGLE_SHEET_ID, expectedRevision: before.revision, headers: Object.fromEntries(Object.keys(data).map(k => [k, TABLES[k as keyof typeof TABLES]])), data, issuedAt: Date.now() });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({payload, signature}), cache: "no-store", signal: AbortSignal.timeout(25000) });
  } catch {
    throw new AppError("The save could not be confirmed. Refresh to review the latest state before retrying.", 503);
  }
  if (!response.ok) throw new AppError("The locked Sheets writer is unavailable.", 503);
  let result: { ok?: boolean; conflict?: boolean; revision?: number };
  try { result = await response.json(); } catch { throw new AppError("The locked Sheets writer returned an invalid response.", 503); }
  if (result.conflict) throw new AppError("The lab changed while saving. Review the latest version and retry.", 409);
  if (!result.ok || result.revision !== before.revision + 1) throw new AppError("The locked Sheets writer could not confirm this save.", 503);
}
