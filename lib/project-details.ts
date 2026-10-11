import { AppError, requireAdmin, requireProjectAccess } from "./access";
import { STAGES } from "./types";
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
  requireAdmin(identity);
  const input = newProjectSchema.parse(raw);
  if (input.leadId && !store.people.some((p) => p.id === input.leadId))
    throw new AppError("Choose a lead from the lab.");
  const existing = store.projects.find((p) => p.id === input.id);
  if (existing) {
    if (
      Object.entries(input).some(
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
    ...input,
    type: input.type ?? "Research",
    phase: input.phase ?? (input.type && input.type !== "Research" ? "" : "Idea"),
    leadId: input.leadId || identity.personId,
    state: "active",
  };
}

export function planProjectChange(
  store: Store,
  identity: Identity,
  raw: unknown,
): Project {
  const input = projectChangeSchema.parse(raw);
  const existing = store.projects.find((p) => p.id === input.id);
  if (!existing) throw new AppError("Project not found.", 404);
  const administrative = ["classification", "complete", "reopen", "pause"].includes(input.action) ||
    ((input.action === "settings" || input.action === "details") && input.leadId !== (existing.leadId ?? ""));
  requireProjectAccess(store, identity, existing, administrative);
  const project = { ...existing };
  switch (input.action) {
    case "settings": {
      if (input.phase && input.phase !== existing.phase && !STAGES.some(s => s === input.phase)) throw new AppError("Choose a supported research phase.");
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
