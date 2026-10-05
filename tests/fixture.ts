import { emptyStore } from "../lib/types";
import type { Identity, Store } from "../lib/types";
export const now = new Date("2026-10-05T04:00:00Z");
export const manager: Identity = {
  personId: "manager",
  email: "manager@example.com",
  name: "Manager",
  role: "admin",
};
export const member: Identity = {
  personId: "member",
  email: "member@example.com",
  name: "Member",
  role: "member",
};
export function fixture(): Store {
  const s = emptyStore();
  s.people = [
    {
      id: "manager",
      name: "Manager",
      email: manager.email,
      setupComplete: "true",
      reminders: "true",
    },
    {
      id: "member",
      name: "Member",
      email: member.email,
      setupComplete: "true",
      reminders: "true",
    },
  ];
  s.projects = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Pilot study",
      goal: "Understand interview patterns",
      phase: "Idea",
      milestone: "Pilot interviews",
      due: "2026-10-09",
      state: "active",
    },
  ];
  s.memberships = [
    {
      id: "membership",
      projectId: s.projects[0].id,
      personId: member.personId,
      joinedAt: now.toISOString(),
    },
  ];
  return s;
}
