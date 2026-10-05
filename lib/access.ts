import type { Identity, Person, Store, Workspace } from "./types";
import { dateInZone, startOfWeek } from "./calendar";

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
  const person = store.people.find(
    (p) => p.email.trim().toLowerCase() === normalized && p.email.trim(),
  );
  if (admins.includes(normalized))
    return {
      email: normalized,
      name: person?.name || name,
      role: "admin",
      personId: person?.id ?? "admin",
    };
  if (!person)
    throw new AppError(
      "Your account could not be loaded. Sign out and sign in again to finish joining the lab.",
      403,
    );
  return {
    email: normalized,
    name: person.name,
    role: person.role,
    personId: person.id,
  };
}
export function scopeStore(store: Store, identity: Identity): Store {
  // Lab members collaborate through shared project history and expertise.
  // Delivery logs remain server-only; write permission is checked separately.
  void identity;
  const { reminders: _reminders, ...shared } = store;
  void _reminders;
  return { ...shared, profiles: store.profiles ?? [] };
}
export function requireAdmin(identity: Identity) {
  if (identity.role !== "admin")
    throw new AppError("Administrator access is required.", 403);
}
export function validatePersonChange(
  store: Store,
  identity: Identity,
  person: Person,
  admins: string[],
) {
  requireAdmin(identity);
  const existing = store.people.find((p) => p.id === person.id);
  if (
    store.people.some(
      (p) =>
        p.id !== person.id &&
        person.email &&
        p.email.trim().toLowerCase() === person.email.trim().toLowerCase(),
    )
  )
    throw new AppError(
      "That email is already assigned to another person.",
      409,
    );
  if (admins.includes(person.email.toLowerCase()) && person.role !== "admin")
    throw new AppError(
      "This email has administrator access. Choose the Administrator role.",
    );
  if (
    existing &&
    (admins.includes(existing.email.toLowerCase()) ||
      existing.id === identity.personId)
  ) {
    if (
      person.role !== "admin" ||
      person.email.toLowerCase() !== existing.email.toLowerCase()
    )
      throw new AppError(
        "Keep your own account and the workspace owner active as administrators.",
      );
  }
  if (
    existing?.role === "admin" &&
    (!person.email || person.role !== "admin") &&
    !admins.length &&
    !store.people.some(
      (p) => p.id !== person.id && p.role === "admin" && p.email,
    )
  )
    throw new AppError(
      "The workspace needs at least one active administrator.",
    );
}
export function workspaceFor(
  store: Store,
  identity: Identity,
  demo: boolean,
  admins: string[],
): Workspace {
  const scoped = scopeStore(store, identity);
  const timezone = process.env.LAB_TIMEZONE || "Asia/Kolkata";
  const today = dateInZone(new Date(), timezone);
  return {
    ...scoped,
    people: scoped.people.map((p) =>
      admins.includes(p.email.toLowerCase())
        ? { ...p, role: "admin" as const }
        : p,
    ),
    availableProjects: store.projects.map(({ id, name }) => ({ id, name })),
    identity,
    demo,
    needsSetup: !store.projects.length && !store.people.length,
    timezone,
    today,
    weekStart: startOfWeek(today),
    emailReady: Boolean(
      process.env.RESEND_API_KEY &&
        process.env.EMAIL_FROM &&
        (process.env.CRON_SECRET?.length ?? 0) >= 32 &&
        !demo,
    ),
    ...(identity.role === "admin"
      ? {
          reminderHealth: {
            sent: (store.reminders ?? []).filter((r) => r.sentAt).length,
            pending: (store.reminders ?? []).filter((r) => !r.sentAt).length,
          },
        }
      : {}),
    ...(identity.role === "admin"
      ? {
          protectedPersonIds: store.people
            .filter(
              (p) =>
                p.id === identity.personId ||
                admins.includes(p.email.toLowerCase()),
            )
            .map((p) => p.id),
        }
      : {}),
  };
}
export function memberPreview(
  store: Store,
  identity: Identity,
  personId: string,
  demo: boolean,
  admins: string[],
): Workspace {
  requireAdmin(identity);
  const person = store.people.find(
    (p) =>
      p.id === personId &&
      p.role === "member" &&
      !admins.includes(p.email.toLowerCase()),
  );
  if (!person) throw new AppError("Choose a lab member to preview.", 404);
  const memberIdentity: Identity = {
    email: person.email,
    name: person.name,
    role: "member",
    personId: person.id,
  };
  return {
    ...workspaceFor(store, memberIdentity, demo, admins),
    preview: { adminName: identity.name },
  };
}
export function requireAssignment(
  store: Store,
  identity: Identity,
  id: string,
) {
  const assignment = store.assignments.find((a) => a.id === id);
  if (!assignment || assignment.personId !== identity.personId)
    throw new AppError(
      "You can report only on your assigned responsibilities.",
      403,
    );
  return assignment;
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : new URL(request.url).origin;
  if (origin !== expected)
    throw new AppError("This request must come from the app.", 403);
}
