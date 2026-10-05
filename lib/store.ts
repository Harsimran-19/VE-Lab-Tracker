import "server-only";
import { isDemo } from "./config";
import { readSheet, upsertSheet } from "./sheets";
import { emptyStore } from "./types";
import type {
  Project,
  Person,
  Membership,
  Update,
  Settings,
  Reminder,
  Store,
} from "./types";
const globals = globalThis as unknown as { veLabFreshDemo?: Store };
function demoStore() {
  return (globals.veLabFreshDemo ??= emptyStore());
}
export async function readStore(): Promise<Store> {
  return isDemo() ? structuredClone(demoStore()) : readSheet();
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
export async function saveProject(project: Project) {
  if (isDemo()) {
    demoStore().projects = upsert(demoStore().projects, project);
    return;
  }
  return upsertSheet("LabProjects", project);
}
export async function saveMembership(membership: Membership) {
  if (isDemo()) {
    demoStore().memberships = upsert(demoStore().memberships, membership);
    return;
  }
  return upsertSheet("LabMemberships", membership);
}
export async function saveUpdate(update: Update) {
  if (isDemo()) {
    demoStore().updates = upsert(demoStore().updates, update);
    return;
  }
  return upsertSheet("LabReports", update);
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
