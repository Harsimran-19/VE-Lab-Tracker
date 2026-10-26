import { AppError, requireAdmin, requireProjectAccess } from "./access";
import { invitationSchema, formRequestSchema } from "./schema";
import { membershipId } from "./membership";
import type { Identity, Invitation, Store } from "./types";
import { createHash } from "node:crypto";

function invitationAccess(store: Store, identity: Identity, projectId: string) {
  if (!store.people.some(p => p.id === identity.personId && p.email.toLowerCase() === identity.email.toLowerCase())) throw new AppError("This account is outside the lab.", 403);
  if (!projectId) return requireAdmin(identity);
  const project = store.projects.find(p => p.id === projectId);
  if (!project) throw new AppError("Project not found.", 404);
  requireProjectAccess(store, identity, project, true);
}
export function planInvitation(store: Store, identity: Identity, raw: unknown, now = new Date()): Invitation {
  const input = invitationSchema.parse(raw);
  invitationAccess(store, identity, input.projectId);
  const repeated = store.invitations.find(i => i.id === input.id);
  if (repeated) {
    if (repeated.email !== input.email || repeated.projectId !== input.projectId || repeated.invitedBy !== identity.personId) throw new AppError("This invitation ID is already in use.", 409);
    return repeated;
  }
  const existing = store.invitations.find(i => i.email === input.email && i.projectId === input.projectId && !i.acceptedAt && !i.revokedAt && i.expiresAt > now.toISOString());
  if (existing) return existing;
  const invitation: Invitation = { ...input, invitedBy: identity.personId, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 14 * 86400000).toISOString(), acceptedAt: "", revokedAt: "" };
  store.invitations.push(invitation);
  return invitation;
}
export function acceptInvitation(store: Store, identity: Identity, id: string, now = new Date()) {
  const invitation = store.invitations.find(i => i.id === id);
  if (!invitation) throw new AppError("Invitation not found.", 404);
  if (identity.email.toLowerCase() !== invitation.email) throw new AppError("Sign in with the Google account this invitation was addressed to.", 403);
  if (invitation.acceptedAt) return invitation;
  if (invitation.revokedAt || invitation.expiresAt <= now.toISOString()) throw new AppError("This invitation has expired or was revoked. Ask for a new invitation.", 409);
  if (invitation.projectId) {
    const project = store.projects.find(p => p.id === invitation.projectId);
    if (!project) throw new AppError("This project is no longer available.", 404);
    // An invitation only grants contributor access; it never grants supervisor or admin rights.
    if (!store.memberships.some(m => m.projectId === project.id && m.personId === identity.personId)) store.memberships.push({ id: membershipId(identity.personId, project.id), projectId: project.id, personId: identity.personId, joinedAt: now.toISOString(), contributor: true, supervisor: false });
  }
  invitation.acceptedAt = now.toISOString();
  return invitation;
}
export function revokeInvitation(store: Store, identity: Identity, id: string, now = new Date()) {
  const invitation = store.invitations.find(i => i.id === id);
  if (!invitation) throw new AppError("Invitation not found.", 404);
  invitationAccess(store, identity, invitation.projectId);
  if (invitation.acceptedAt) throw new AppError("This invitation has already been accepted.", 409);
  invitation.revokedAt ||= now.toISOString();
}
export function planFormRequest(store: Store, identity: Identity, raw: unknown, now = new Date()) {
  const input = formRequestSchema.parse(raw);
  const project = store.projects.find(p => p.id === input.projectId);
  if (!project) throw new AppError("Project not found.", 404);
  requireProjectAccess(store, identity, project, input.action === "request");
  project.formRequests ??= [];
  if (input.action === "complete") {
    const request = project.formRequests.find(r => r.id === input.id);
    if (!request) throw new AppError("Form request not found.", 404);
    if (request.personId !== identity.personId) throw new AppError("Only the assigned member can complete this request.", 403);
    request.completedAt ||= now.toISOString();
    return project;
  }
  const additions = [];
  for (const personId of new Set(input.personIds)) {
    if (!store.memberships.some(m => m.projectId === project.id && m.personId === personId)) throw new AppError("Add each recipient to this project first.");
    const hash = createHash("sha256").update(`${input.id}:${personId}`).digest("hex");
    const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    const previous = project.formRequests.find(r => r.id === id);
    if (previous) {
      if (previous.personId !== personId || previous.kind !== input.kind || previous.message !== input.message || previous.requestedBy !== identity.personId) throw new AppError("This form request already exists. Start a new request.", 409);
      continue;
    }
    additions.push({ id, personId, kind: input.kind, message: input.message, requestedBy: identity.personId, createdAt: now.toISOString(), completedAt: "" });
  }
  if (project.formRequests.length + additions.length > 100) throw new AppError("This project has reached its 100 form requests.");
  project.formRequests.push(...additions);
  return project;
}
