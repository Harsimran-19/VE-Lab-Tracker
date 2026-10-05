import { AppError, requireAdmin } from "./access";
import type { Identity, Store } from "./types";
export function rosterCandidate(store: Store, id: string, identity: Identity) {
  const person = store.people.find((p) => p.id === id);
  const reservation = store.onboarding?.find(
    (r) => r.id === id && ["linking", "archived"].includes(r.status),
  );
  if (
    !person ||
    person.role !== "member" ||
    person.email.trim() ||
    (reservation && reservation.rosterId !== identity.personId)
  )
    throw new AppError(
      "This existing lab profile is already connected. Choose your own name instead.",
      409,
    );
  return person;
}
export function connectionRequest(store: Store, admin: Identity, id: string) {
  requireAdmin(admin);
  const request = store.onboarding?.find((r) => r.id === id);
  const member = store.people.find((p) => p.id === id);
  if (
    !request ||
    request.status !== "pending" ||
    !member ||
    member.role !== "member" ||
    member.email.toLowerCase() !== request.requesterEmail.toLowerCase()
  )
    throw new AppError("This connection request is no longer available.", 409);
  return { request, member };
}
export function linkRequest(store: Store, admin: Identity, id: string) {
  const { request, member } = connectionRequest(store, admin, id);
  const roster = rosterCandidate(store, request.rosterId, {
    ...admin,
    personId: member.id,
  });
  return { request, member, roster };
}
export function requireUnstartedConnection(
  store: Store,
  id: string,
  memberId: string,
) {
  if (
    store.onboarding?.some(
      (r) =>
        r.id === id &&
        r.rosterId === memberId &&
        ["linking", "archived"].includes(r.status),
    )
  )
    throw new AppError(
      "This connection has already started. Finish connecting it instead of keeping the profiles separate.",
      409,
    );
}
