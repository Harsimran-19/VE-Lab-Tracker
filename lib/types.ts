export const STAGES = [
  "Idea",
  "Literature review",
  "Data collection",
  "Data analysis",
  "Findings",
  "Writing",
  "Submission",
] as const;
export const PUBLICATION_STATUSES = [
  "Not submitted",
  "In preparation",
  "Under review",
  "Revise and resubmit",
  "Rejected — repositioning",
  "Resubmitted",
  "Accepted",
  "Published",
] as const;
export const PRIORITIES = ["Push", "Steady", "Background"] as const;
export const PROJECT_TYPES = ["Research", "Startup", "Lab Management"] as const;
export const WORKSTREAM_STATUSES = [
  "Not started",
  "In progress",
  "Blocked",
  "Done",
] as const;
export interface ResourceLink {
  label: string;
  url: string;
}
export interface Workstream {
  id: string;
  name: string;
  ownerId: string;
  status: (typeof WORKSTREAM_STATUSES)[number];
  due: string;
  notes: string;
  archived?: boolean;
}
export interface Collaborator {
  id: string;
  name: string;
  affiliation: string;
  role: string;
  email: string;
  contactVia: string;
  notes: string;
}
export interface Project {
  id: string;
  name: string;
  goal: string;
  phase: string;
  milestone: string;
  due: string;
  state: "active" | "completed" | "on-hold";
  fullTitle?: string;
  leadId?: string;
  priority?: string;
  methods?: string;
  publicationStatus?: string;
  targetJournal?: string;
  altJournal?: string;
  targetConference?: string;
  notes?: string;
  links?: ResourceLink[];
  workstreams?: Workstream[];
  collaborators?: Collaborator[];
  type?: (typeof PROJECT_TYPES)[number] | "";
  folderId?: string;
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
  reporting?: { researcherId: string; supervisorId: string }[];
}
export interface Person {
  id: string;
  name: string;
  email: string;
  setupComplete: string;
  reminders: string;
  academicRole?: string;
  affiliation?: string;
}
export interface Membership {
  id: string;
  projectId: string;
  personId: string;
  joinedAt: string;
  contributor?: boolean;
  supervisor?: boolean;
}
export interface Update {
  id: string;
  createdAt: string;
  updatedAt: string;
  weekStart: string;
  projectId: string;
  personId: string;
  progress: string;
  nextPlan: string;
  needsHelp: string;
  blockers: string;
  workstreams?: { id: string; name: string }[];
  version?: number;
}
export interface Folder {
  id: string;
  name: string;
  description: string;
  version: number;
}
export interface Activity {
  id: string;
  projectId: string;
  area: string;
  action: string;
  actorId: string;
  actorName: string;
  at: string;
  changes: { label: string; before: string; after: string }[];
}
export interface Settings {
  id: string;
  reportingDay: string;
  reportingTime: string;
  timezone: string;
}
export interface Reminder {
  id: string;
  personId: string;
  projectId: string;
  due: string;
  phase: string;
  createdAt: string;
  sentAt: string;
  providerId: string;
}
export interface Store {
  projects: Project[];
  people: Person[];
  memberships: Membership[];
  updates: Update[];
  settings: Settings;
  reminders: Reminder[];
  folders: Folder[];
  activities: Activity[];
  revision: number;
}
export interface Identity {
  email: string;
  name: string;
  role: "admin" | "member";
  personId: string;
}
export interface Workspace extends Omit<Store, "reminders"> {
  identity: Identity;
  demo: boolean;
  needsOnboarding: boolean;
  today: string;
  weekStart: string;
  reportingDue: { date: string; time: string; passed: boolean };
  emailReady: boolean;
  cronReady: boolean;
  reminderHealth?: { sent: number; pending: number };
}
export const defaultSettings: Settings = {
  id: "lab",
  reportingDay: "5",
  reportingTime: "18:00",
  timezone: "Asia/Kolkata",
};
export function emptyStore(): Store {
  return {
    projects: [],
    people: [],
    memberships: [],
    updates: [],
    settings: { ...defaultSettings },
    reminders: [],
    folders: [],
    activities: [],
    revision: 0,
  };
}
