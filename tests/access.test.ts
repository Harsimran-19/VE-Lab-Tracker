import test from "node:test";
import assert from "node:assert/strict";
import {
  AppError,
  requireAdmin,
  requireAssignment,
  requireSameOrigin,
  resolveIdentity,
  scopeStore,
  memberPreview,
  validatePersonChange,
  workspaceFor,
} from "../lib/access";
import { isDemo } from "../lib/config";
import {
  assignmentSchema,
  newPersonSchema,
  personSchema,
  projectSchema,
  reportSchema,
} from "../lib/schema";
import { latestByAssignment } from "../lib/format";
import seed from "../lib/seed.json";
import type { Store } from "../lib/types";

function fixture(): Store {
  const data = structuredClone(seed) as Store;
  data.people.find((p) => p.id === "hars")!.email = "member@example.com";
  return data;
}
test("an admin can sign in before spreadsheet initialization", () => {
  const identity = resolveIdentity(
    "Harsimran1869@Gmail.com",
    "Harsimran",
    {
      projects: [],
      people: [],
      assignments: [],
      updates: [],
      collaborators: [],
    },
    ["harsimran1869@gmail.com"],
  );
  assert.equal(identity.role, "admin");
});
test("unknown accounts are refused and matched members receive their own identity", () => {
  assert.throws(
    () => resolveIdentity("outsider@example.com", "Outsider", fixture(), []),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
  const identity = resolveIdentity(
    " MEMBER@example.com ",
    "Google display name",
    fixture(),
    [],
  );
  assert.equal(identity.personId, "hars");
  assert.equal(identity.role, "member");
  assert.equal(identity.name, "Hars");
});
test("members can read shared lab progress while reminder delivery logs stay private", () => {
  const store = fixture();
  store.updates = [
    {
      id: "1",
      createdAt: "2026-10-01T12:00:00Z",
      projectId: "P10",
      assignmentId: "A016",
      personId: "hars",
      progress: "My work",
      blockers: "",
      nextPlan: "",
      status: "On track",
    },
    {
      id: "2",
      createdAt: "2026-10-01T12:00:00Z",
      projectId: "P10",
      assignmentId: "A014",
      personId: "mindy",
      progress: "Someone else's work",
      blockers: "",
      nextPlan: "",
      status: "On track",
    },
  ];
  store.reminders = [
    {
      id: "private-delivery",
      personId: "hars",
      projectId: "P10",
      due: "2026-10-08",
      phase: "upcoming",
      createdAt: "2026-10-05T04:00:00Z",
      sentAt: "",
      providerId: "",
    },
  ];
  store.profiles = [
    {
      id: "mindy",
      position: "PhD",
      expertise: "LLMs",
      bio: "Research",
      reminders: "true",
    },
  ];
  const identity = resolveIdentity("member@example.com", "", store, []);
  const scoped = scopeStore(store, identity);
  assert.equal(scoped.projects.length, 15);
  assert.equal(scoped.assignments.length, 21);
  assert.deepEqual(
    scoped.updates.map((u) => u.id),
    ["1", "2"],
  );
  assert.deepEqual(scoped.collaborators, store.collaborators);
  assert.equal(scoped.reminders, undefined);
  assert.equal(scoped.profiles![0].expertise, "LLMs");
  assert.equal(scoped.people.length, store.people.length);
});
test("members cannot edit admin data or report another person's responsibility", () => {
  const data = fixture();
  const identity = resolveIdentity("member@example.com", "", data, []);
  assert.throws(() => requireAdmin(identity), AppError);
  assert.throws(() => requireAssignment(data, identity, "A014"), AppError);
  assert.throws(() => requireAssignment(data, identity, "not-real"), AppError);
  assert.equal(requireAssignment(data, identity, "A016").projectId, "P10");
});
test("sample authentication is disabled in production and on Vercel", () => {
  assert.equal(isDemo({ NODE_ENV: "production", DEMO_MODE: "true" }), false);
  assert.equal(
    isDemo({ NODE_ENV: "development", DEMO_MODE: "true", VERCEL: "1" }),
    false,
  );
  assert.equal(isDemo({ NODE_ENV: "development", DEMO_MODE: "true" }), true);
  assert.equal(isDemo({ NODE_ENV: "development", DEMO_MODE: "false" }), false);
});
test("cross-origin writes are rejected", () => {
  const original = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://lab.example.com";
  try {
    assert.throws(
      () =>
        requireSameOrigin(
          new Request("https://lab.example.com/api/updates", {
            headers: { origin: "https://other.example.com" },
          }),
        ),
      AppError,
    );
    assert.throws(
      () =>
        requireSameOrigin(new Request("https://lab.example.com/api/updates")),
      AppError,
    );
    requireSameOrigin(
      new Request("https://lab.example.com/api/updates", {
        headers: { origin: "https://lab.example.com" },
      }),
    );
  } finally {
    if (original === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = original;
  }
});
test("reports reject blank progress, spoofed authors, unknown statuses, and oversized input", () => {
  const valid = {
    assignmentId: "A016",
    progress: "Reviewed two papers",
    blockers: "",
    nextPlan: "",
    status: "On track",
  };
  assert.equal(reportSchema.safeParse(valid).success, true);
  assert.equal(
    reportSchema.safeParse({ ...valid, progress: "  " }).success,
    false,
  );
  assert.equal(
    reportSchema.safeParse({ ...valid, personId: "fanny" }).success,
    false,
  );
  assert.equal(
    reportSchema.safeParse({ ...valid, status: "Anything" }).success,
    false,
  );
  assert.equal(
    reportSchema.safeParse({ ...valid, progress: "x".repeat(4001) }).success,
    false,
  );
});
test("admin forms reject invalid dates, roles, and email addresses", () => {
  assert.equal(
    projectSchema.safeParse({ ...seed.projects[0], due: "2026-02-30" }).success,
    false,
  );
  assert.equal(projectSchema.safeParse(seed.projects[0]).success, true);
  assert.equal(
    personSchema.safeParse({
      id: "hars",
      name: "Hars",
      email: "invalid",
      affiliation: "",
    }).success,
    false,
  );
  assert.equal(
    personSchema.safeParse({
      id: "hars",
      name: "Hars",
      email: "test@example.com",
      affiliation: "",
      role: "owner",
    }).success,
    false,
  );
  assert.equal(
    assignmentSchema.safeParse({ ...seed.assignments[0], due: "not-a-date" })
      .success,
    false,
  );
});
test("newer reports resolve old blockers in the dashboard", () => {
  const base = {
    projectId: "P10",
    assignmentId: "A016",
    personId: "hars",
    progress: "Work",
    nextPlan: "",
  };
  const rows = [
    {
      ...base,
      id: "old",
      createdAt: "2026-10-01T00:00:00Z",
      blockers: "Need access",
      status: "Blocked",
    },
    {
      ...base,
      id: "new",
      createdAt: "2026-10-02T00:00:00Z",
      blockers: "",
      status: "On track",
    },
  ];
  const latest = latestByAssignment(rows);
  assert.equal(latest.length, 1);
  assert.equal(latest[0].id, "new");
  assert.equal(latest[0].blockers, "");
});

test("new members require a Google email, normalize it, and cannot choose their ID", () => {
  const person = newPersonSchema.parse({
    name: " New Member ",
    email: " TEST@EXAMPLE.COM ",
  });
  assert.equal(person.name, "New Member");
  assert.equal(person.email, "test@example.com");
  assert.equal(person.role, "member");
  assert.equal(
    newPersonSchema.safeParse({ name: "Test", email: "" }).success,
    false,
  );
  assert.equal(
    newPersonSchema.safeParse({ ...person, id: "harsimran" }).success,
    false,
  );
  assert.equal(
    newPersonSchema.safeParse({ ...person, role: "admin" }).success,
    true,
  );
});
test("member management refuses duplicate emails and protects administrator accounts", () => {
  const store = fixture();
  const identity = resolveIdentity("harsimran1869@gmail.com", "", store, [
    "harsimran1869@gmail.com",
  ]);
  const member = store.people.find((p) => p.id === "hars")!;
  validatePersonChange(store, identity, { ...member, role: "admin" }, [
    identity.email,
  ]);
  assert.throws(
    () =>
      validatePersonChange(
        store,
        identity,
        { ...member, id: "new", email: "MEMBER@example.com" },
        [identity.email],
      ),
    (e: unknown) => e instanceof AppError && e.status === 409,
  );
  const owner = store.people.find((p) => p.id === identity.personId)!;
  assert.throws(
    () =>
      validatePersonChange(store, identity, { ...owner, role: "member" }, [
        identity.email,
      ]),
    AppError,
  );
  assert.throws(
    () =>
      validatePersonChange(
        store,
        identity,
        { ...owner, email: "replacement@example.com" },
        [identity.email],
      ),
    AppError,
  );
  assert.throws(
    () =>
      validatePersonChange(store, { ...identity, role: "member" }, member, []),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
});
test("changing a sheet member's role changes authorization on the next request", () => {
  const store = fixture();
  const member = store.people.find((p) => p.id === "hars")!;
  member.role = "admin";
  assert.equal(resolveIdentity(member.email, "", store, []).role, "admin");
  member.role = "member";
  assert.equal(resolveIdentity(member.email, "", store, []).role, "member");
  member.email = "";
  assert.throws(
    () => resolveIdentity("member@example.com", "", store, []),
    AppError,
  );
});
test("member preview uses shared read access without granting administrator tools", () => {
  const store = fixture();
  const identity = resolveIdentity("harsimran1869@gmail.com", "", store, [
    "harsimran1869@gmail.com",
  ]);
  const original = structuredClone(store);
  const preview = memberPreview(store, identity, "hars", false, [
    identity.email,
  ]);
  assert.equal(preview.identity.role, "member");
  assert.equal(preview.identity.personId, "hars");
  assert.equal(preview.projects.length, 15);
  assert.equal(
    preview.assignments.filter((a) => a.personId === preview.identity.personId)
      .length,
    1,
  );
  assert.deepEqual(preview.updates, store.updates);
  assert.equal(preview.demo, false);
  assert.equal(preview.preview?.adminName, identity.name);
  assert.equal(preview.protectedPersonIds, undefined);
  assert.equal(identity.role, "admin");
  assert.deepEqual(store, original);
  assert.throws(() => requireAssignment(store, identity, "A016"), AppError);
  assert.throws(
    () => memberPreview(store, preview.identity, "hars", false, []),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
  assert.throws(
    () => memberPreview(store, identity, "harsimran", false, [identity.email]),
    (e: unknown) => e instanceof AppError && e.status === 404,
  );
  assert.throws(
    () => memberPreview(store, identity, "missing", false, []),
    AppError,
  );
});
test("members without a Google email can be previewed and owners show their effective role", () => {
  const store = fixture();
  const identity = resolveIdentity("harsimran1869@gmail.com", "", store, [
    "harsimran1869@gmail.com",
  ]);
  store.people.find((p) => p.id === "hars")!.email = "";
  assert.equal(
    memberPreview(store, identity, "hars", false, []).identity.role,
    "member",
  );
  store.people.find((p) => p.id === identity.personId)!.role = "member";
  const workspace = workspaceFor(store, identity, false, [identity.email]);
  assert.equal(
    workspace.people.find((p) => p.id === identity.personId)!.role,
    "admin",
  );
  assert.ok(workspace.protectedPersonIds?.includes(identity.personId));
});
