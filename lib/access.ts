import type { Identity, Store, Workspace } from "./types";
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
  const { reminders, ...shared } = store;
  const today = dateInZone(now, store.settings.timezone);
  return {
    ...shared,
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
