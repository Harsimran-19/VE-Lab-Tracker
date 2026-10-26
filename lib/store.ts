import "server-only";
import { isDemo } from "./config";
import { readSheet, upsertSheet, ensureTables } from "./sheets";
import { emptyStore } from "./types";
import { upgradeStore, recordChanges } from "./collaboration";
import { AppError, resolveIdentity } from "./access";
import { adminEmails } from "./config";
import { commitSheetTransaction, readSheetRevision } from "./sheet-transactions";
import { requireSeparateSpreadsheet } from "./environment";
import type { Identity } from "./types";
import type {
  OutputVersion,
  Person,
  Settings,
  Reminder,
  Store,
} from "./types";
const globals = globalThis as unknown as { veLabFreshDemo?: Store };
function demoStore() {
  return (globals.veLabFreshDemo ??= emptyStore());
}
export async function readStore(): Promise<Store> {
  if (isDemo()) return upgradeStore(demoStore());
  requireSeparateSpreadsheet();
  if (!process.env.SHEETS_TRANSACTION_URL) return upgradeStore(await readSheet());
  // Bootstrap a blank spreadsheet before reading its revision. Bracket the
  // domain snapshot so concurrent writes cannot yield mixed data and versions.
  await ensureTables();
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = await readSheetRevision();
    const snapshot = await readSheet();
    if (snapshot.revision === revision && await readSheetRevision() === revision) return upgradeStore(snapshot);
  }
  throw new AppError("The lab is being updated. Try loading it again.", 409);
}
export async function mutateProjectDomain<T>(identity: Identity, area: string, action: string, plan: (store: Store, current: Identity) => T) {
  // Planning is synchronous in demo mode, so no promise yields between the
  // current membership/version checks and the single replacement commit.
  const before = isDemo() ? upgradeStore(demoStore()) : await readStore();
  const current = resolveIdentity(identity.email, identity.name, before, adminEmails());
  const next = structuredClone(before);
  const result = plan(next, current);
  for (const folder of next.folders) {
    const old = before.folders.find(f=>f.id===folder.id);
    if (old && before.projects.filter(p=>p.folderId===folder.id).map(p=>p.id).sort().join(",") !== next.projects.filter(p=>p.folderId===folder.id).map(p=>p.id).sort().join(",")) folder.version = Math.max(folder.version,old.version + 1);
  }
  recordChanges(before, next, current, area, action);
  if (next.activities.length === before.activities.length && JSON.stringify(before.folders) === JSON.stringify(next.folders) && JSON.stringify(before.invitations) === JSON.stringify(next.invitations)) return result;
  next.revision = before.revision + 1;
  if (isDemo()) globals.veLabFreshDemo = next;
  else await commitSheetTransaction(before, next);
  return result;
}
function upsert<T extends { id: string }>(rows: T[], record: T) {
  return [...rows.filter((r) => r.id !== record.id), record];
}
export async function savePerson(person: Person) {
  if (isDemo()) {
    demoStore().people = upsert(demoStore().people, person);
    return;
  }
  return upsertSheet("LabMembers", person);
}
export const addPerson = savePerson;
export async function recordLogin(personId: string, now = new Date()) {
  const record = { id: personId, at: now.toISOString() };
  if (isDemo()) { demoStore().logins = upsert(demoStore().logins, record); return; }
  return upsertSheet("LabLogins", record);
}
export async function saveSettings(settings: Settings) {
  if (isDemo()) {
    demoStore().settings = settings;
    return;
  }
  return upsertSheet("LabSettings", settings);
}
export async function addReminder(reminder: Reminder) {
  if (isDemo()) {
    demoStore().reminders = upsert(demoStore().reminders, reminder);
    return;
  }
  return upsertSheet("LabDeliveries", reminder);
}
export const saveReminder = addReminder;
// Versions are immutable rows with unique IDs, so appending needs no lock.
export async function addVersion(version: OutputVersion) {
  if (isDemo()) {
    demoStore().versions = [...(demoStore().versions ?? []), version];
    return;
  }
  return upsertSheet("LabVersions", version);
}
