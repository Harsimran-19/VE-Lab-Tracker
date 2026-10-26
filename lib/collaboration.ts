import { randomUUID } from "node:crypto";
import { AppError, requireAdmin, requireProjectAccess } from "./access";
import { membershipId } from "./membership";
import { folderChangeSchema, teamChangeSchema, versionedRequestSchema } from "./schema";
import type { Activity, Identity, Membership, Project, Store } from "./types";

export function versionedInput(raw: unknown) {
  const { expectedVersion, ...input } = versionedRequestSchema.parse(raw);
  return { expectedVersion, input };
}
export function checkVersion(actual: number | undefined, expected: number) {
  if ((actual ?? 0) !== expected)
    throw new AppError("Someone changed this record. Review the latest version, then retry with your input.", 409);
}
// Only recorded leads can be backfilled. No historical type, supervisor,
// reporting link, author or date is inferred.
export function upgradeStore(source: Store): Store {
  const store = structuredClone(source);
  store.folders ??= [];
  store.activities ??= [];
  store.versions ??= [];
  store.invitations ??= [];
  store.logins ??= [];
  store.revision ??= 0;
  store.projects = store.projects.map(p => ({ ...p, version: p.version ?? 0, type: p.type ?? "", folderId: p.folderId ?? "", reporting: [...(p.reporting ?? [])].sort((a,b)=>a.researcherId.localeCompare(b.researcherId) || a.supervisorId.localeCompare(b.supervisorId)), ...(p.workstreams ? {workstreams:p.workstreams.map(w=>({...w,archived:w.archived ?? false}))} : {}) }));
  store.memberships = store.memberships.map(m => ({ ...m, contributor: m.contributor ?? true, supervisor: m.supervisor ?? false }));
  for (const p of store.projects) {
    if (p.leadId && store.people.some(person => person.id === p.leadId) && !store.memberships.some(m => m.projectId === p.id && m.personId === p.leadId))
      store.memberships.push({ id: membershipId(p.leadId, p.id), projectId: p.id, personId: p.leadId, joinedAt: "", contributor: true, supervisor: false });
  }
  store.updates = store.updates.map(u => ({ ...u, version: u.version ?? 0 }));
  return store;
}
export function memberFor(store: Store, projectId: string, personId: string) {
  const member = store.memberships.find(m => m.projectId === projectId && m.personId === personId);
  if (!member || !store.people.some(p => p.id === personId)) throw new AppError("Choose a member of this project.");
  return member;
}
export function planTeamChange(store: Store, identity: Identity, raw: unknown, now = new Date()) {
  const input = teamChangeSchema.parse(raw);
  const project = store.projects.find(p => p.id === input.projectId);
  if (!project) throw new AppError("Project not found.", 404);
  requireProjectAccess(store, identity, project, true);
  if (input.action === "add") {
    if (!store.people.some(p => p.id === input.personId)) throw new AppError("Choose a person from this lab.");
    if (store.memberships.some(m => m.projectId === project.id && m.personId === input.personId)) throw new AppError("This person already belongs to this project.", 409);
    if (!input.contributor && !input.supervisor) throw new AppError("Choose at least one responsibility.");
    store.memberships.push({ id: membershipId(input.personId, project.id), projectId: project.id, personId: input.personId, joinedAt: now.toISOString(), contributor: input.contributor, supervisor: input.supervisor });
    return project;
  }
  if (input.action === "reporting") {
    const researcher = memberFor(store, project.id, input.researcherId);
    if (researcher.contributor === false) throw new AppError("Choose a contributor for this reporting relationship.");
    if (new Set(input.supervisorIds).size !== input.supervisorIds.length) throw new AppError("Each supervisor can be assigned only once.");
    for (const id of input.supervisorIds) {
      if (id === input.researcherId) throw new AppError("A person cannot report to themselves.");
      if (!memberFor(store, project.id, id).supervisor) throw new AppError("Reporting targets must be project supervisors.");
    }
    project.reporting = [...(project.reporting ?? []).filter(r => r.researcherId !== input.researcherId), ...input.supervisorIds.map(supervisorId => ({ researcherId: input.researcherId, supervisorId }))].sort((a,b)=>a.researcherId.localeCompare(b.researcherId) || a.supervisorId.localeCompare(b.supervisorId));
    return project;
  }
  const membership = memberFor(store, project.id, input.personId);
  if (input.action === "lead") project.leadId = membership.personId;
  if (input.action === "responsibilities") {
    if (!input.contributor && !input.supervisor) throw new AppError("Choose at least one responsibility.");
    membership.contributor = input.contributor;
    membership.supervisor = input.supervisor;
    project.reporting = (project.reporting ?? []).filter(r => (r.researcherId !== membership.personId || input.contributor) && (r.supervisorId !== membership.personId || input.supervisor));
  }
  if (input.action === "remove") {
    if (project.leadId === membership.personId) {
      if (!input.replacementLeadId || input.replacementLeadId === membership.personId) throw new AppError("Choose a replacement lead before removing the current lead.");
      memberFor(store, project.id, input.replacementLeadId);
      project.leadId = input.replacementLeadId;
    }
    store.memberships = store.memberships.filter(m => m.id !== membership.id);
    project.reporting = (project.reporting ?? []).filter(r => r.researcherId !== membership.personId && r.supervisorId !== membership.personId);
    // Responsibilities and reports keep their historical owner attribution.
  }
  return project;
}
export function planFolderChange(store: Store, identity: Identity, raw: unknown, expected: number) {
  requireAdmin(identity);
  if (!store.people.some(p => p.id === identity.personId && p.email.toLowerCase() === identity.email.toLowerCase())) throw new AppError("This account is outside the lab.", 403);
  const input = folderChangeSchema.parse(raw);
  const existing = store.folders.find(f => f.id === input.id);
  checkVersion(existing?.version, expected);
  if (input.action === "remove") {
    if (!existing) throw new AppError("Folder not found.", 404);
    store.folders = store.folders.filter(f => f.id !== input.id);
    for (const project of store.projects) if (project.folderId === input.id) project.folderId = "";
  } else {
    if (store.folders.some(f => f.id !== input.id && f.name.toLowerCase() === input.name.toLowerCase())) throw new AppError("A folder with this name already exists.");
    const folder = { id: input.id, name: input.name, description: input.description, version: existing?.version ?? 0 };
    if (existing?.name === folder.name && existing.description === folder.description) return;
    folder.version++;
    store.folders = [...store.folders.filter(f => f.id !== input.id), folder];
  }
}
const labels: Record<string, string> = { approval: "Approval", requestedBy: "Requested by", reviewNote: "Review note", attributes: "Project attributes", value: "Value", proposedBy: "Proposed by", reviewedBy: "Reviewed by", hours: "Hours", files: "Reference files", piMeeting: "Meeting with the PI", piMeetingDate: "PI meeting date", collaboratorMeeting: "Meeting with collaborators", collaboratorMeetingDate: "Collaborator meeting date", collaboratorNames: "Collaborators met", meetingNotes: "Meeting notes", name: "Project name", goal: "Goal", phase: "Project phase", milestone: "Milestone", due: "Due date", state: "Project state", leadId: "Project lead", type: "Project type", folderId: "Folder", fullTitle: "Full title", priority: "Priority", methods: "Methods", publicationStatus: "Publication status", targetJournal: "Target journal", altJournal: "Alternative journal", targetConference: "Target conference", notes: "Notes", links: "Resources", workstreams: "Responsibilities", collaborators: "External collaborators", reporting: "Reporting relationships", progress: "Progress", nextPlan: "Next step", needsHelp: "Help needed", blockers: "Blockers", contributor: "Contributor", supervisor: "Supervisor", personId: "Member", joinedAt: "Joined", description: "Description", weekStart:"Reporting week", archived:"Archived", status:"Status", ownerId:"Owner", label:"Link name", url:"URL", affiliation:"Affiliation", role:"Contact role", email:"Email", contactVia:"Contact through" };
const ignored = new Set(["id", "projectId", "version", "createdAt", "updatedAt", "updatedBy", "proposedAt", "reviewedAt"]);
function display(value: unknown, store: Store): string {
  if (value === undefined || value === null || value === "") return "Unassigned";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return store.people.find(p => p.id === value)?.name ?? store.folders.find(f => f.id === value)?.name ?? value;
  if (Array.isArray(value)) return value.length ? value.map(v => display(v, store)).join("; ") : "None";
  if (typeof value === "object") return Object.entries(value).filter(([k]) => !ignored.has(k)).map(([k,v]) => `${k === "name" ? "Name" : labels[k] ?? (k === "researcherId" ? "Contributor" : k === "supervisorId" ? "Supervisor" : k)}: ${display(v,store)}`).join(", ");
  return String(value);
}
function equivalentValue(value: unknown): string {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return "";
  return JSON.stringify(value);
}
export function changesBetween(before: object | undefined, after: object | undefined, previous: Store, next: Store): Activity["changes"] {
  const a: Record<string, unknown> = before ? { ...before } : {};
  const b: Record<string, unknown> = after ? { ...after } : {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !ignored.has(k) && equivalentValue(a[k]) !== equivalentValue(b[k])).map(k => ({ label: labels[k] ?? k, before: display(a[k], previous), after: display(b[k], next) }));
}
export function recordChanges(before: Store, next: Store, identity: Identity, area: string, action: string, now = new Date()) {
  const actor = before.people.find(p => p.id === identity.personId && p.email.toLowerCase() === identity.email.toLowerCase());
  if (!actor) throw new AppError("This account is outside the lab.", 403);
  for (const project of next.projects) {
    const previous = before.projects.find(p => p.id === project.id);
    const changes = changesBetween(previous, project, before, next);
    if (project.folderId && previous?.folderId === project.folderId) {
      const oldFolder=before.folders.find(f=>f.id===project.folderId), newFolder=next.folders.find(f=>f.id===project.folderId);
      if (oldFolder?.name !== newFolder?.name || oldFolder?.description !== newFolder?.description) changes.push(...changesBetween(oldFolder,newFolder,before,next).map(c=>({...c,label:c.label === "Project name" ? "Folder name" : "Folder description"})));
    }
    const domain: [Membership[] | Store["updates"], Membership[] | Store["updates"]][] = [
      [before.memberships.filter(m => m.projectId === project.id), next.memberships.filter(m => m.projectId === project.id)],
      [before.updates.filter(u => u.projectId === project.id), next.updates.filter(u => u.projectId === project.id)],
    ];
    for (const [oldRows, newRows] of domain) for (const id of new Set([...oldRows, ...newRows].map(r => r.id))) {
      const old = oldRows.find(r => r.id === id), fresh = newRows.find(r => r.id === id);
      const details = changesBetween(old, fresh, before, next);
      if (details.length) {
        changes.push(...details);
        if (fresh && "progress" in fresh) fresh.version = (old && "progress" in old ? old.version ?? 0 : 0) + 1;
      }
    }
    if (!changes.length) continue;
    project.version = (previous?.version ?? 0) + 1;
    project.updatedAt = now.toISOString();
    project.updatedBy = actor.id;
    next.activities.push({ id: randomUUID(), projectId: project.id, area, action, actorId: actor.id, actorName: actor.name, at: now.toISOString(), changes });
  }
}
