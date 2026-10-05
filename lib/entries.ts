import type { z } from "zod";
import type { Assignment, Identity, Project, Store, Update } from "./types";
import { AppError, requireAdmin, requireAssignment } from "./access";
import type { entrySchema } from "./schema";
import { membershipId } from "./membership";

type Entry = z.infer<typeof entrySchema>;
export function planEntry(
  store: Store,
  identity: Identity,
  input: Entry,
  now = new Date().toISOString(),
) {
  const saved = store.updates.find((u) => u.id === input.entryId);
  if (saved) {
    if (saved.personId !== identity.personId)
      throw new AppError("This entry belongs to another person.", 403);
    return { update: saved, alreadySaved: true };
  }
  if (!input.projectId) requireAdmin(identity);
  const projectId = input.projectId || `P-${input.entryId}`;
  const existingProject = store.projects.find((p) => p.id === projectId);
  if (input.projectId && !existingProject)
    throw new AppError("Project not found. Refresh and try again.", 404);
  if (
    !input.projectId &&
    existingProject &&
    existingProject.name !== input.newProjectName
  )
    throw new AppError(
      "This project was already created. Retry with the same project name.",
      409,
    );
  const project: Project | undefined = existingProject
    ? undefined
    : {
        id: projectId,
        name: input.newProjectName,
        title: "",
        stage: "Idea",
        pipeline: "Not submitted",
        methods: "",
        journal: "",
        conference: "",
        priority: "P2 - steady",
        milestone: "",
        due: "",
        notes: "",
      };
  const existingAssignment = input.assignmentId
    ? requireAssignment(store, identity, input.assignmentId)
    : store.assignments.find(
        (a) => a.projectId === projectId && a.personId === identity.personId,
      );
  if (existingAssignment && existingAssignment.projectId !== projectId)
    throw new AppError("Choose your work on the selected project.");
  const assignmentId =
    existingAssignment?.id ?? membershipId(identity.personId, projectId);
  if (
    store.assignments.some(
      (a) => a.id === assignmentId && a.personId !== identity.personId,
    )
  )
    throw new AppError("This work belongs to another person.", 403);
  const assignment: Assignment | undefined = existingAssignment
    ? undefined
    : {
        id: assignmentId,
        projectId,
        personId: identity.personId,
        responsibility: "Project work",
        status: "In progress",
        due: "",
      };
  const update: Update = {
    id: input.entryId,
    projectId,
    assignmentId,
    personId: identity.personId,
    createdAt: now,
    progress: input.progress,
    blockers: input.blockers,
    nextPlan: input.nextPlan,
    status: input.status,
  };
  return { project, assignment, update, alreadySaved: false };
}
export async function persistEntry(
  plan: ReturnType<typeof planEntry>,
  storage: {
    addProject: (p: Project) => Promise<unknown>;
    addAssignment: (a: Assignment) => Promise<unknown>;
    addUpdate: (u: Update) => Promise<unknown>;
  },
) {
  if (plan.alreadySaved) return;
  if (plan.project) await storage.addProject(plan.project);
  if (plan.assignment) await storage.addAssignment(plan.assignment);
  await storage.addUpdate(plan.update);
}
