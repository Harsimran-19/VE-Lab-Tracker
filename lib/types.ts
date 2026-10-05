export const STAGES = [
  "Idea",
  "Literature review",
  "Data collection",
  "Data analysis",
  "Findings",
  "Writing",
  "Submission",
] as const;
export interface Project {
  id: string;
  name: string;
  goal: string;
  phase: string;
  milestone: string;
  due: string;
  state: "active" | "completed";
}
export interface Person {
  id: string;
  name: string;
  email: string;
  setupComplete: string;
  reminders: string;
}
export interface Membership {
  id: string;
  projectId: string;
  personId: string;
  joinedAt: string;
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
  };
}
