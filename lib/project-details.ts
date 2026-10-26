import { AppError, requireAdmin, requireProjectAccess } from "./access";
import type { ProjectAttribute } from "./types";
import { STAGES } from "./types";
import { membershipId } from "./membership";
import type { Identity, Project, Store } from "./types";
import {
  newProjectSchema,
  projectChangeSchema,
  workstreamChangeSchema,
} from "./schema";

export function planProjectCreation(
  store: Store,
  identity: Identity,
  raw: unknown,
): Project {
  // Any lab member can propose a project; the manager's projects start approved.
  if (!store.people.some(p => p.id === identity.personId && p.email.toLowerCase() === identity.email.toLowerCase()))
    throw new AppError("This account is outside the lab.", 403);
  const input = newProjectSchema.parse(raw);
  const { memberIds = [], supervisorIds = [], ...details } = input;
  for (const personId of [...memberIds, ...supervisorIds])
    if (!store.people.some(p => p.id === personId)) throw new AppError("Choose project members and supervisors from the lab.");
  if (input.leadId && !store.people.some((p) => p.id === input.leadId))
    throw new AppError("Choose a lead from the lab.");
  const existing = store.projects.find((p) => p.id === input.id);
  if (existing) {
    if (
      Object.entries(details).some(
        ([key, value]) => existing[key as keyof Project] !== value,
      )
    )
      throw new AppError(
        "This project already exists. Refresh to review it.",
        409,
      );
    return existing;
  }
  return {
    priority: "Steady",
    methods: "",
    milestone: "",
    due: "",
    fullTitle: "",
    publicationStatus: "",
    targetJournal: "",
    altJournal: "",
    targetConference: "",
    ...details,
    type: input.type ?? "Research",
    phase: input.phase ?? "Ideation",
    leadId: input.leadId || identity.personId,
    state: "active",
    approval: identity.role === "admin" ? "approved" : "pending",
    requestedBy: identity.personId,
    reviewNote: "",
    attributes: [],
  };
}

export function addInitialProjectTeam(store: Store, identity: Identity, project: Project, raw: unknown, now = new Date()) {
  const { memberIds = [], supervisorIds = [] } = newProjectSchema.parse(raw);
  const contributors = new Set([identity.personId, project.leadId!, ...memberIds]);
  for (const personId of new Set([...contributors, ...supervisorIds])) {
    if (store.memberships.some(m => m.projectId === project.id && m.personId === personId)) continue;
    store.memberships.push({ id: membershipId(personId, project.id), personId, projectId: project.id, joinedAt: now.toISOString(), contributor: contributors.has(personId), supervisor: supervisorIds.includes(personId) });
  }
}

export function planProjectChange(
  store: Store,
  identity: Identity,
  raw: unknown,
  now = new Date(),
): Project {
  const input = projectChangeSchema.parse(raw);
  const existing = store.projects.find((p) => p.id === input.id);
  if (!existing) throw new AppError("Project not found.", 404);
  if (input.action === "review" || input.action === "attribute-review") requireAdmin(identity);
  const administrative = ["classification", "complete", "reopen", "pause"].includes(input.action) ||
    ((input.action === "settings" || input.action === "details") && input.leadId !== (existing.leadId ?? ""));
  requireProjectAccess(store, identity, existing, administrative);
  const project = { ...existing };
  switch (input.action) {
    case "settings": {
      if (input.phase && input.phase !== existing.phase && !STAGES.some(s => s === input.phase)) throw new AppError("Choose a supported project phase.");
      if (input.leadId && input.leadId !== existing.leadId && !store.people.some((p) => p.id === input.leadId))
        throw new AppError("Choose a lead from the lab.");
      const { id: _id, action: _action, ...settings } = input;
      Object.assign(project, settings);
      break;
    }
    case "goal":
      project.name = input.name;
      project.goal = input.goal;
      break;
    case "phase":
      if (input.phase && input.phase !== existing.phase && !STAGES.some(s => s === input.phase)) throw new AppError("Choose a supported project phase.");
      project.phase = input.phase;
      break;
    case "milestone":
      project.milestone = input.milestone;
      project.due = input.due;
      break;
    case "clear-milestone":
      project.milestone = "";
      project.due = "";
      break;
    case "complete":
      project.state = "completed";
      break;
    case "reopen":
      project.state = "active";
      break;
    case "pause":
      project.state = "on-hold";
      break;
    case "details": {
      if (input.leadId && input.leadId !== existing.leadId && !store.people.some((p) => p.id === input.leadId))
        throw new AppError("Choose a lead from the lab.");
      const { id: _id, action: _action, ...details } = input;
      Object.assign(project, details);
      break;
    }
    case "publication": {
      const { id: _id, action: _action, ...publication } = input;
      Object.assign(project, publication);
      break;
    }
    case "collaborator": {
      const list = project.collaborators ?? [];
      if (
        list.length >= 50 &&
        !list.some((c) => c.id === input.collaborator.id)
      )
        throw new AppError("This project already has 50 collaborators.");
      project.collaborators = list.some(c=>c.id===input.collaborator.id) ? list.map(c=>c.id===input.collaborator.id ? input.collaborator : c) : [...list,input.collaborator];
      break;
    }
    case "remove-collaborator":
      project.collaborators = (project.collaborators ?? []).filter(
        (c) => c.id !== input.collaboratorId,
      );
      break;
    case "classification":
      if (input.folderId && !store.folders.some(f => f.id === input.folderId))
        throw new AppError("Choose a folder from this lab.");
      project.type = input.type;
      project.folderId = input.folderId;
      break;
    case "review":
      project.approval = input.decision === "approve" ? "approved" : "rejected";
      project.reviewNote = input.note;
      break;
    case "resubmit":
      if (existing.approval !== "rejected") throw new AppError("Only a project that was not approved can be resubmitted.", 409);
      project.approval = "pending";
      break;
    case "attribute": {
      const list = project.attributes ?? [];
      const previous = list.find(a => a.id === input.attribute.id);
      if (!previous && list.length >= 30) throw new AppError("This project already has 30 attributes.");
      if (list.some(a => a.id !== input.attribute.id && a.label.toLowerCase() === input.attribute.label.toLowerCase()))
        throw new AppError("This project already has an attribute with that name.");
      if (previous && previous.label === input.attribute.label && previous.value === input.attribute.value) break;
      // A member's new or changed attribute waits for the manager's approval.
      const approved = identity.role === "admin";
      const attribute: ProjectAttribute = {
        ...input.attribute,
        status: approved ? "approved" : "pending",
        proposedBy: identity.personId,
        proposedAt: now.toISOString(),
        reviewedBy: approved ? identity.personId : "",
        reviewedAt: approved ? now.toISOString() : "",
      };
      project.attributes = previous ? list.map(a => a.id === attribute.id ? attribute : a) : [...list, attribute];
      break;
    }
    case "remove-attribute": {
      const attribute = (project.attributes ?? []).find(a => a.id === input.attributeId);
      if (!attribute) throw new AppError("Attribute not found.", 404);
      if (attribute.status === "approved" && identity.role !== "admin")
        throw new AppError("Ask the lab manager to remove an approved attribute.", 403);
      project.attributes = (project.attributes ?? []).filter(a => a.id !== input.attributeId);
      break;
    }
    case "attribute-review": {
      const attribute = (project.attributes ?? []).find(a => a.id === input.attributeId);
      if (!attribute) throw new AppError("Attribute not found.", 404);
      const status = input.decision === "approve" ? "approved" : "rejected";
      if (attribute.status === status) break;
      project.attributes = (project.attributes ?? []).map(a => a.id === attribute.id ? { ...a, status, reviewedBy: identity.personId, reviewedAt: now.toISOString() } : a);
      break;
    }
  }
  if (project.leadId !== existing.leadId) {
    if (existing.leadId && !project.leadId) throw new AppError("Choose a replacement lead.");
    if (project.leadId && !store.memberships.some(m => m.projectId === project.id && m.personId === project.leadId))
      throw new AppError("Add the lead to this project’s team first.");
  }
  return project;
}

export function planWorkstreamChange(
  store: Store,
  identity: Identity,
  raw: unknown,
): Project {
  const input = workstreamChangeSchema.parse(raw);
  const project = store.projects.find((p) => p.id === input.projectId);
  if (!project) throw new AppError("Project not found.", 404);
  requireProjectAccess(store, identity, project);
  if (project.state !== "active")
    throw new AppError(
      "Reopen this project before changing responsibilities.",
      409,
    );
  const list = project.workstreams ?? [];
  if (input.action === "save") {
    // Ordinary assigned members can update progress, including responsibilities.
    if (
      !store.memberships.some(
        (m) =>
          m.projectId === project.id && m.personId === input.workstream.ownerId,
      )
    )
      throw new AppError("Choose an owner who has joined this project.");
    if (list.length >= 100 && !list.some((w) => w.id === input.workstream.id))
      throw new AppError("This project already has 100 responsibilities.");
    const existing = list.find((w) => w.id === input.workstream.id);
    return {
      ...project,
      workstreams: existing ? list.map(w=>w.id===input.workstream.id ? {...input.workstream,archived:existing.archived ?? false} : w) : [...list,{...input.workstream,archived:false}],
    };
  }
  const stream = list.find((w) => w.id === input.workstreamId);
  if (!stream) throw new AppError("Responsibility not found.", 404);
  if (input.action === "status") {
    if (stream.archived)
      throw new AppError(
        "Restore this responsibility before changing its status.",
        409,
      );
  }
  return {
    ...project,
    workstreams: list.map((w) =>
      w.id !== stream.id
        ? w
        : input.action === "status"
          ? { ...w, status: input.status }
          : { ...w, archived: input.action === "archive" },
    ),
  };
}
