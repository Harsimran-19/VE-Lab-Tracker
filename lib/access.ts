import type { Identity, Store, Workspace, Project } from "./types";
import { dateInZone, reportingDeadline, startOfWeek } from "./calendar";
import { smtpSettings } from "./mail-config";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function resolveIdentity(
  email: string,
  name: string,
  store: Store,
  admins: string[],
): Identity {
  const normalized = email.trim().toLowerCase();
  const person = store.people.find((p) => p.email.toLowerCase() === normalized);
  if (!person)
    throw new AppError(
      "Sign out and sign in again to finish joining the lab.",
      403,
    );
  return {
    email: normalized,
    name: person.name || name,
    personId: person.id,
    role: admins.includes(normalized) ? "admin" : "member",
  };
}
export function requireAdmin(identity: Identity) {
  if (identity.role !== "admin")
    throw new AppError("Manager access is required.", 403);
}
// The existing workspace is one shared lab per configured spreadsheet. All
// registered accounts retain read access; memberships grant project-scoped edits.
export function canManageProject(store: Pick<Store, "memberships">, identity: Identity, project: Project) {
  return identity.role === "admin" || store.memberships.some(m =>
    m.projectId === project.id && m.personId === identity.personId &&
    (project.leadId === m.personId || m.supervisor === true));
}
export function canEditProject(store: Pick<Store, "memberships">, identity: Identity, project: Project) {
  return identity.role === "admin" || store.memberships.some(m => m.projectId === project.id && m.personId === identity.personId);
}
export function requireProjectAccess(store: Store, identity: Identity, project: Project, manage = false) {
  if (!store.people.some(p => p.id === identity.personId && p.email.toLowerCase() === identity.email.toLowerCase()))
    throw new AppError("This account is outside the lab.", 403);
  if (!(manage ? canManageProject(store, identity, project) : canEditProject(store, identity, project)))
    throw new AppError(manage ? "Only the project lead, supervisors or lab manager can manage this project." : "Join this project before editing its details.", 403);
}
export function requireSameOrigin(request: Request) {
  const expected = new URL(process.env.NEXTAUTH_URL || request.url).origin;
  if (request.headers.get("origin") !== expected)
    throw new AppError("This request must come from the app.", 403);
}
export function workspaceFor(
  store: Store,
  identity: Identity,
  demo: boolean,
  now = new Date(),
): Workspace {
  const { reminders, revision: _revision, activities, ...shared } = store;
  const today = dateInZone(now, store.settings.timezone);
  return {
    ...shared,
    revision: store.revision,
    activities: store.projects.flatMap(p => activities.filter(a => a.projectId === p.id).slice(-20)),
    identity,
    demo,
    needsOnboarding:
      identity.role === "member" &&
      store.people.find((p) => p.id === identity.personId)?.setupComplete !==
        "true",
    today,
    weekStart: startOfWeek(today),
    reportingDue: reportingDeadline(store.settings, now),
    emailReady: Boolean(smtpSettings() && !demo),
    cronReady: Boolean((process.env.CRON_SECRET?.length ?? 0) >= 32 && !demo),
    ...(identity.role === "admin"
      ? {
          reminderHealth: {
            sent: reminders.filter((r) => r.sentAt).length,
            pending: reminders.filter((r) => !r.sentAt).length,
          },
        }
      : {}),
  };
}
