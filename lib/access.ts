import type { Identity, Store } from "./types";

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function resolveIdentity(email: string, name: string, store: Store, admins: string[]): Identity {
  const normalized = email.trim().toLowerCase();
  const person = store.people.find(p => p.email.trim().toLowerCase() === normalized && p.email.trim());
  if (admins.includes(normalized)) return { email: normalized, name: person?.name || name, role: "admin", personId: person?.id ?? "admin" };
  if (!person) throw new AppError("Your Google account has not been added to the lab. Ask the administrator to add your email.", 403);
  return { email: normalized, name: person.name, role: person.role, personId: person.id };
}
export function scopeStore(store: Store, identity: Identity): Store {
  if (identity.role === "admin") return store;
  const assignments = store.assignments.filter(a => a.personId === identity.personId);
  const ids = new Set(assignments.map(a => a.projectId));
  return {
    projects: store.projects.filter(p => ids.has(p.id)), assignments,
    people: store.people, collaborators: store.collaborators.filter(c => ids.has(c.projectId)),
    updates: store.updates.filter(u => u.personId === identity.personId && ids.has(u.projectId))
  };
}
export function requireAdmin(identity: Identity) {
  if (identity.role !== "admin") throw new AppError("Administrator access is required.", 403);
}
export function requireAssignment(store: Store, identity: Identity, id: string) {
  const assignment = store.assignments.find(a => a.id === id);
  if (!assignment || assignment.personId !== identity.personId) throw new AppError("You can report only on your assigned responsibilities.", 403);
  return assignment;
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : new URL(request.url).origin;
  if (origin !== expected) throw new AppError("This request must come from the app.", 403);
}
