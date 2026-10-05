import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveIdentity,
  requireAdmin,
  requireSameOrigin,
  workspaceFor,
  AppError,
} from "../lib/access";
import { isDemo } from "../lib/config";
import {
  profileSchema,
  settingsSchema,
  entrySchema,
  newProjectSchema,
  projectChangeSchema,
  onboardingSchema,
} from "../lib/schema";
import { fixture, manager, member, now } from "./fixture";

test("only configured manager emails receive management rights", () => {
  const s = fixture();
  assert.equal(
    resolveIdentity(manager.email, "", s, [manager.email]).role,
    "admin",
  );
  assert.equal(resolveIdentity(manager.email, "", s, []).role, "member");
  assert.throws(() => requireAdmin(member), AppError);
  assert.throws(
    () => resolveIdentity("outsider@example.com", "", s, []),
    AppError,
  );
});
test("shared progress is visible but delivery logs remain server-only", () => {
  const s = fixture();
  s.reminders = [
    {
      id: "private",
      personId: "manager",
      projectId: "",
      due: "",
      phase: "test",
      createdAt: now.toISOString(),
      sentAt: "",
      providerId: "",
    },
  ];
  const w = workspaceFor(s, member, false, now);
  assert.equal(w.projects.length, 1);
  assert.equal(w.memberships.length, 1);
  assert.equal("reminders" in w, false);
  assert.equal(w.reminderHealth, undefined);
  assert.equal(workspaceFor(s, manager, false, now).reminderHealth!.pending, 1);
});
test("members must confirm their own name once, with no roster linking", () => {
  const s = fixture();
  s.people[1].setupComplete = "false";
  assert.equal(workspaceFor(s, member, false, now).needsOnboarding, true);
  assert.equal(workspaceFor(s, manager, false, now).needsOnboarding, false);
  assert.equal(
    onboardingSchema.safeParse({ name: "Preferred name", projectIds: [] })
      .success,
    true,
  );
  assert.equal(
    onboardingSchema.safeParse({
      name: "Name",
      projectIds: [],
      rosterId: "someone",
    }).success,
    false,
  );
});
test("account edits cannot change Google identity or grant management access", () => {
  const valid = { name: "New name", reminders: false };
  assert.equal(profileSchema.safeParse(valid).success, true);
  for (const key of ["id", "email", "role", "setupComplete"])
    assert.equal(
      profileSchema.safeParse({ ...valid, [key]: "admin" }).success,
      false,
    );
});
test("forms accept only the fields needed for their action", () => {
  const input = {
    id: fixture().projects[0].id,
    name: "Project",
    goal: "A useful outcome",
  };
  assert.equal(newProjectSchema.safeParse(input).success, true);
  assert.equal(
    newProjectSchema.safeParse({ ...input, goal: " " }).success,
    false,
  );
  assert.equal(
    newProjectSchema.safeParse({ ...input, journal: "Unused" }).success,
    false,
  );
  assert.equal(
    projectChangeSchema.safeParse({
      id: input.id,
      action: "phase",
      phase: "Writing",
    }).success,
    true,
  );
  assert.equal(
    projectChangeSchema.safeParse({
      id: input.id,
      action: "milestone",
      milestone: "Pilot",
      due: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    projectChangeSchema.safeParse({
      id: input.id,
      action: "milestone",
      milestone: "",
      due: "2026-10-09",
    }).success,
    false,
  );
});
test("help explanation is required only when a member asks for help", () => {
  const input = {
    projectId: fixture().projects[0].id,
    weekStart: "2026-10-05",
    progress: "Completed interviews",
    nextPlan: "Code the interviews",
    needsHelp: false,
    blockers: "",
  };
  assert.equal(entrySchema.safeParse(input).success, true);
  assert.equal(
    entrySchema.safeParse({ ...input, nextPlan: " " }).success,
    false,
  );
  assert.equal(
    entrySchema.safeParse({ ...input, needsHelp: true }).success,
    false,
  );
  assert.equal(
    entrySchema.safeParse({
      ...input,
      needsHelp: true,
      blockers: "Need recordings",
    }).success,
    true,
  );
  for (const key of ["personId", "id", "status", "createdAt"])
    assert.equal(
      entrySchema.safeParse({ ...input, [key]: "manager" }).success,
      false,
    );
});
test("reporting schedule validates weekday, local time and timezone", () => {
  const valid = {
    reportingDay: "5",
    reportingTime: "18:00",
    timezone: "Asia/Hong_Kong",
  };
  assert.equal(settingsSchema.safeParse(valid).success, true);
  for (const patch of [
    { reportingDay: "8" },
    { reportingTime: "24:00" },
    { timezone: "Invented/Zone" },
  ])
    assert.equal(
      settingsSchema.safeParse({ ...valid, ...patch }).success,
      false,
    );
});
test("cross-origin mutations fail closed", () => {
  const saved = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://lab.example.com";
  try {
    requireSameOrigin(
      new Request("https://lab.example.com/api/projects", {
        headers: { Origin: "https://lab.example.com" },
      }),
    );
    assert.throws(
      () =>
        requireSameOrigin(new Request("https://lab.example.com/api/projects")),
      AppError,
    );
    assert.throws(
      () =>
        requireSameOrigin(
          new Request("https://lab.example.com/api/projects", {
            headers: { Origin: "https://other.example.com" },
          }),
        ),
      AppError,
    );
  } finally {
    if (saved === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = saved;
  }
});
test("local test authentication is unavailable in production or on Vercel", () => {
  assert.equal(isDemo({ NODE_ENV: "production", DEMO_MODE: "true" }), false);
  assert.equal(
    isDemo({ NODE_ENV: "development", DEMO_MODE: "true", VERCEL: "1" }),
    false,
  );
  assert.equal(isDemo({ NODE_ENV: "development", DEMO_MODE: "true" }), true);
});
