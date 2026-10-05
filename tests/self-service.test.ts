import test from "node:test";
import assert from "node:assert/strict";
import {
  googleMember,
  enrollGoogleAccount,
  verifiedGoogleLogin,
} from "../lib/enrollment";
import { planEntry, reportId } from "../lib/entries";
import { latestReports } from "../lib/format";
import { membershipId } from "../lib/membership";
import { emptyStore } from "../lib/types";
import { fixture, manager, member, now } from "./fixture";
const input = () => ({
  projectId: fixture().projects[0].id,
  weekStart: "2026-10-05",
  progress: "Completed pilot interviews",
  nextPlan: "Code interview notes",
  needsHelp: true,
  blockers: "Need access to recordings",
});
test("only verified Google login registers; supplied identity and roles are ignored", async () => {
  const store = emptyStore();
  let calls = 0;
  const storage = {
    read: async () => store,
    add: async (person: ReturnType<typeof googleMember>) => {
      store.people.push(person);
      calls++;
    },
  };
  assert.equal(
    verifiedGoogleLogin("google", {
      email: "bad@example.com",
      email_verified: false,
    }),
    null,
  );
  assert.equal(
    await enrollGoogleAccount(
      "other",
      { email: "a@example.com", email_verified: true },
      [],
      storage,
    ),
    false,
  );
  assert.equal(
    await enrollGoogleAccount(
      "google",
      {
        email: " NEW@example.com ",
        email_verified: true,
        name: "New",
        role: "admin",
        id: "manager",
      },
      [],
      storage,
    ),
    true,
  );
  assert.equal(store.people[0].email, "new@example.com");
  assert.notEqual(store.people[0].id, "manager");
  assert.equal(store.people[0].setupComplete, "false");
  await enrollGoogleAccount(
    "google",
    { email: "new@example.com", email_verified: true },
    [],
    storage,
  );
  assert.equal(calls, 1);
});
test("manager signup also creates a fresh real account without importing a roster", async () => {
  const store = emptyStore();
  await enrollGoogleAccount(
    "google",
    { email: manager.email, name: "Google name", email_verified: true },
    [manager.email],
    {
      read: async () => store,
      add: async (person) => {
        store.people.push(person);
      },
    },
  );
  assert.equal(store.people.length, 1);
  assert.equal(store.people[0].name, "Google name");
  assert.equal(store.people[0].setupComplete, "true");
  assert.equal(store.projects.length, 0);
});
test("weekly reports derive authorship and preserve the first submission date on edits", () => {
  const store = fixture(),
    first = planEntry(store, member, input(), now);
  assert.equal(first.personId, member.personId);
  assert.equal(first.createdAt, now.toISOString());
  store.updates = [first];
  const edit = planEntry(
    store,
    member,
    {
      ...input(),
      progress: "Finished coding",
      needsHelp: false,
      blockers: "Old problem",
    },
    new Date("2026-10-06T04:00:00Z"),
  );
  assert.equal(edit.id, first.id);
  assert.equal(edit.createdAt, first.createdAt);
  assert.notEqual(edit.updatedAt, first.updatedAt);
  assert.equal(edit.blockers, "");
  assert.equal(edit.needsHelp, "false");
  assert.equal(latestReports([first, edit])[0].id, edit.id);
});
test("a duplicate submission reuses the same report and timestamp", () => {
  const store = fixture();
  const report = planEntry(store, member, input(), now);
  store.updates = [report];
  assert.deepEqual(
    planEntry(store, member, input(), new Date("2026-10-05T05:00:00Z")),
    report,
  );
  assert.equal(
    reportId(member.personId, store.projects[0].id, "2026-10-05"),
    report.id,
  );
  assert.notEqual(
    reportId(member.personId, store.projects[0].id, "2026-10-12"),
    report.id,
  );
});
test("members and managers cannot report on work they have not joined", () => {
  const store = fixture();
  assert.throws(() => planEntry(store, manager, input(), now));
  store.memberships = [];
  assert.throws(() => planEntry(store, member, input(), now));
});
test("completed projects stop reporting and clients cannot backdate a report", () => {
  const store = fixture();
  assert.throws(() =>
    planEntry(store, member, { ...input(), weekStart: "2026-09-28" }, now),
  );
  store.projects[0].state = "completed";
  assert.throws(() => planEntry(store, member, input(), now));
});
test("membership IDs isolate people and prevent duplicate joining records", () => {
  assert.equal(
    membershipId("member", "project"),
    membershipId("member", "project"),
  );
  assert.notEqual(
    membershipId("manager", "project"),
    membershipId("member", "project"),
  );
});
