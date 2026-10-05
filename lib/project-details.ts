import { AppError, requireAdmin } from "./access";
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
    phase: "Idea",
    leadId: "",
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
    state: "active",
  };
}

export function planProjectChange(
  store: Store,
  identity: Identity,
  raw: unknown,
): Project {
  requireAdmin(identity);
  const input = projectChangeSchema.parse(raw);
  const existing = store.projects.find((p) => p.id === input.id);
  if (!existing) throw new AppError("Project not found.", 404);
  const project = { ...existing };
  switch (input.action) {
    case "settings": {
      if (input.leadId && !store.people.some((p) => p.id === input.leadId))
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
      if (input.leadId && !store.people.some((p) => p.id === input.leadId))
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
      project.collaborators = [
        ...list.filter((c) => c.id !== input.collaborator.id),
        input.collaborator,
      ];
      break;
    }
    case "remove-collaborator":
      project.collaborators = (project.collaborators ?? []).filter(
        (c) => c.id !== input.collaboratorId,
      );
      break;
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
  if (project.state !== "active")
    throw new AppError(
      "Reopen this project before changing responsibilities.",
      409,
    );
  const list = project.workstreams ?? [];
  if (input.action === "save") {
    requireAdmin(identity);
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
      workstreams: [
        ...list.filter((w) => w.id !== input.workstream.id),
        { ...input.workstream, archived: existing?.archived ?? false },
      ],
    };
  }
  const stream = list.find((w) => w.id === input.workstreamId);
  if (!stream) throw new AppError("Responsibility not found.", 404);
  if (input.action === "status") {
    if (identity.role !== "admin" && stream.ownerId !== identity.personId)
      throw new AppError(
        "Only the owner or manager can change this status.",
        403,
      );
    if (stream.archived)
      throw new AppError(
        "Restore this responsibility before changing its status.",
        409,
      );
  } else requireAdmin(identity);
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
