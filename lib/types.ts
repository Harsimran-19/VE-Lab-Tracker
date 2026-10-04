export const STAGES = ["Idea", "Literature review", "Data collection", "Data analysis", "Findings", "Writing", "Submission"] as const;
export const PIPELINES = ["Not submitted", "In preparation", "Under review", "R&R", "Rejected - repositioning", "Resubmitted", "Accepted"] as const;
export const PRIORITIES = ["P1 - push", "P2 - steady", "P3 - background"] as const;
export const STATUSES = ["On track", "Blocked", "Done"] as const;
export interface Project {
  id: string; name: string; title: string; stage: string; pipeline: string;
  methods: string; journal: string; conference: string; priority: string;
  milestone: string; due: string; notes: string;
}
export interface Person { id: string; name: string; email: string; affiliation: string; role: "admin" | "member" }
export interface Assignment { id: string; projectId: string; personId: string; responsibility: string; status: string; due: string }
export interface Collaborator { id: string; projectId: string; name: string; affiliation: string; role: string }
export interface Update { id: string; createdAt: string; projectId: string; assignmentId: string; personId: string; progress: string; blockers: string; nextPlan: string; status: string }
export interface Store { projects: Project[]; people: Person[]; assignments: Assignment[]; collaborators: Collaborator[]; updates: Update[] }
export interface Identity { email: string; name: string; role: "admin" | "member"; personId: string }
export interface Workspace extends Store {
  identity: Identity; demo: boolean; needsSetup: boolean;
  availableProjects: Pick<Project,"id"|"name">[];
  protectedPersonIds?: string[];
  preview?: { adminName: string };
}
