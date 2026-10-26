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
  // Without the shared Apps Script writer, fall back to a direct atomic batch so
  // lab members are never blocked by deployment configuration they cannot change.
  if (!endpoint || !secret || secret.length < 32) return commitDirect(before, next);
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)) throw new AppError("Configure the Google Apps Script transaction URL.", 503);
  const data = domainRows(before, next);
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
// Only project-domain tables are written here. Account settings, signup and
// delivery logs keep their existing isolated write paths.
function domainRows(before: Store, next: Store) {
  return {
    LabProjects: next.projects.map(p => cells("LabProjects", p)),
    LabMemberships: next.memberships.map(m => cells("LabMemberships", m)),
    LabReports: next.updates.map(u => cells("LabReports", u)),
    LabFolders: next.folders.map(f => cells("LabFolders", f)),
    LabInvitations: next.invitations.map(i => cells("LabInvitations", i)),
    LabActivity: next.activities.slice(before.activities.length).map(a => cells("LabActivity", a)),
  };
}
type Tab = { sheetId: number; title: string; gridProperties?: { rowCount?: number } };
const stringCells = (row: string[]) => ({ values: row.map(value => ({ userEnteredValue: { stringValue: value } })) });
// Mirrors docs/sheets-transaction-writer.gs as one atomic Sheets batchUpdate.
// The revision is re-checked just before writing; unlike the locked writer this
// cannot serialize separate instances, so two near-simultaneous saves can race.
async function commitDirect(before: Store, next: Store) {
  const data = domainRows(before, next);
  for (const rows of Object.values(data)) {
    const ids = rows.map(r => r[0]);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length || rows.some(r => r.some(v => v.length > 45000)))
      throw new AppError("This save contains invalid or oversized data and was not applied.", 400);
  }
  const titles = [...Object.keys(data), "LabRevision"];
  const query = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE" });
  for (const title of titles) query.append("ranges", `'${title}'!A:AZ`);
  const [meta, values] = await Promise.all([
    sheetRequest("?fields=sheets.properties(sheetId,title,gridProperties.rowCount)"),
    sheetRequest(`/values:batchGet?${query}`),
  ]);
  const existing = Object.fromEntries(titles.map((t, i) => [t, (values.valueRanges?.[i]?.values ?? []) as unknown[][]]));
  if (Number(existing.LabRevision[1]?.[1] ?? 0) !== before.revision)
    throw new AppError("The lab changed while saving. Review the latest version and retry.", 409);
  const tabs = new Map((meta.sheets as { properties: Tab }[]).map(s => [s.properties.title, s.properties]));
  const requests: unknown[] = [];
  for (const [title, rows] of Object.entries(data)) {
    const tab = tabs.get(title);
    const headers = TABLES[title as keyof typeof TABLES];
    if (!tab || headers.some((h, i) => existing[title][0]?.[i] !== h))
      throw new AppError("Lab spreadsheet headers do not match. Restore the headers from lib/sheets.ts; existing records were not changed.", 409);
    const lastRow = existing[title].length;
    const start = title === "LabActivity" ? lastRow : 1;
    const end = Math.max(start + rows.length, title === "LabActivity" ? start : lastRow);
    const maxRows = tab.gridProperties?.rowCount ?? 0;
    if (end > maxRows) requests.push({ appendDimension: { sheetId: tab.sheetId, dimension: "ROWS", length: end - maxRows } });
    if (end > start) requests.push({ updateCells: {
      range: { sheetId: tab.sheetId, startRowIndex: start, endRowIndex: end, startColumnIndex: 0, endColumnIndex: headers.length },
      rows: rows.map(stringCells),
      fields: "userEnteredValue",
    } });
  }
  const revisionTab = tabs.get("LabRevision");
  if (!revisionTab) throw new AppError("The lab spreadsheet is missing its LabRevision tab.", 409);
  requests.push({ updateCells: {
    range: { sheetId: revisionTab.sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 },
    rows: [stringCells(["lab", String(before.revision + 1)])],
    fields: "userEnteredValue",
  } });
  // Sheets batchUpdate is atomic: data, audit rows and revision land together or not at all.
  await sheetRequest(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
}
