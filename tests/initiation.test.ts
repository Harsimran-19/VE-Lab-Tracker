import test from "node:test";
import assert from "node:assert/strict";
import { fixture, manager, member, now } from "./fixture";
import { addInitialProjectTeam, planProjectChange, planProjectCreation } from "../lib/project-details";
import { acceptInvitation, planFormRequest, planInvitation, revokeInvitation } from "../lib/invitations";
import { workspaceFor } from "../lib/access";
import { enrollGoogleAccount } from "../lib/enrollment";
import { mutateProjectDomain, readStore, recordLogin } from "../lib/store";
import { STAGES } from "../lib/types";
import { cells } from "../lib/sheets";

const id = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";
test("all project types use the seven requested phases and creation saves overlapping team selections", () => {
  assert.deepEqual(STAGES, ["Ideation", "Design", "Alpha prototype", "Alpha prototype testing", "Beta prototype", "Beta prototype testing", "In use"]);
  const s = fixture();
  const input = { id, name: "Tool", goal: "Help the lab", type: "Lab Management", memberIds: [member.personId, member.personId], supervisorIds: [member.personId] };
  const p = planProjectCreation(s, manager, input);
  assert.equal(p.phase, "Ideation"); assert.equal(p.milestone, ""); assert.equal(p.publicationStatus, "");
  s.projects.push(p); addInitialProjectTeam(s, manager, p, input, now);
  assert.equal(s.memberships.filter(m => m.projectId === id).length, 2);
  assert.equal(s.memberships.find(m => m.projectId === id && m.personId === member.personId)?.supervisor, true);
  assert.equal(s.memberships.find(m => m.projectId === id && m.personId === member.personId)?.contributor, true);
  assert.throws(() => planProjectCreation(s, manager, { ...input, supervisorIds: ["unknown"] }), /from the lab/);
  assert.equal(planProjectChange(s, member, { id: s.projects[0].id, action: "phase", phase: "Idea" }).phase, "Idea");
  assert.throws(() => planProjectChange(s, member, { id: s.projects[0].id, action: "phase", phase: "invented" }), /supported project phase/);
});
test("invitations do not fabricate accounts and only the addressed account can accept", () => {
  const s = fixture(), count = s.people.length;
  const invitation = planInvitation(s, manager, { id, email: member.email.toUpperCase(), projectId: "" }, now);
  assert.equal(s.people.length, count); assert.equal(invitation.email, member.email);
  assert.throws(() => acceptInvitation(s, manager, id, now), /Google account/);
  acceptInvitation(s, member, id, now); acceptInvitation(s, member, id, now);
  assert.equal(invitation.acceptedAt, now.toISOString()); assert.equal(s.memberships.length, 1);
  assert.throws(() => planInvitation(s, member, { id: requestId, email: "new@example.com", projectId: "" }, now), /Manager access/);
});
test("project invitations enforce management access, expiry and revocation and grant contributor access once", () => {
  const s = fixture(), projectId = s.projects[0].id;
  s.memberships = [];
  assert.throws(() => planInvitation(s, member, { id, email: member.email, projectId }, now), /manage this project/);
  const invitation = planInvitation(s, manager, { id, email: member.email, projectId }, now);
  assert.throws(() => acceptInvitation(s, member, id, new Date(invitation.expiresAt)), /expired/);
  acceptInvitation(s, member, id, now); acceptInvitation(s, member, id, now);
  assert.equal(s.memberships.length, 1); assert.equal(s.memberships[0].supervisor, false);
  planInvitation(s, manager, { id: requestId, email: "new@example.com", projectId }, now);
  revokeInvitation(s, manager, requestId, now);
  const other = { ...member, email: "new@example.com" };
  assert.throws(() => acceptInvitation(s, other, requestId, now), /revoked/);
});
test("form requests support several members, are idempotent, and only the assignee completes them", () => {
  const s = fixture(), projectId = s.projects[0].id;
  s.memberships.push({ id: "manager-membership", projectId, personId: manager.personId, joinedAt: now.toISOString() });
  const input = { action: "request", id: requestId, projectId, personIds: [member.personId, manager.personId], kind: "task", message: "Define your next task" };
  assert.throws(() => planFormRequest(s, member, input, now), /manage this project/);
  planFormRequest(s, manager, input, now); planFormRequest(s, manager, input, now);
  const requests = s.projects[0].formRequests!; assert.equal(requests.length, 2);
  const mine = requests.find(r => r.personId === member.personId)!;
  assert.throws(() => planFormRequest(s, manager, { action: "complete", id: mine.id, projectId }, now), /assigned member/);
  planFormRequest(s, member, { action: "complete", id: mine.id, projectId }, now);
  assert.equal(mine.completedAt, now.toISOString()); assert.equal(requests.find(r => r.personId === manager.personId)!.completedAt, "");
  assert.throws(() => planFormRequest(s, manager, { ...input, id, personIds: ["unknown"] }, now), /Add each recipient/);
  assert.ok(cells("LabProjects", s.projects[0]).some(v => v.includes("Define your next task")));
});
test("sign-in tracking records only successful verified Google logins and stays admin-only", async () => {
  const s = fixture(), recorded: string[] = [];
  const storage = { read: async () => s, add: async () => {}, recordLogin: async (personId: string) => { recorded.push(personId); } };
  assert.equal(await enrollGoogleAccount("google", { email: member.email, email_verified: false }, [], storage), false);
  assert.deepEqual(recorded, []);
  assert.equal(await enrollGoogleAccount("google", { email: member.email, email_verified: true }, [], storage), true);
  assert.deepEqual(recorded, [member.personId]);
  s.logins = [{ id: member.personId, at: now.toISOString() }];
  planInvitation(s, manager, { id, email: "private@example.com", projectId: "" }, now);
  assert.equal(workspaceFor(s, manager, true, now).logins.length, 1);
  assert.deepEqual(workspaceFor(s, member, true, now).logins, []);
  assert.deepEqual(workspaceFor(s, member, true, now).invitations, []);
});
test("lab-only invitations persist through transactions even without a project activity change", async () => {
  const keys = ["DEMO_MODE", "ADMIN_EMAILS", "NODE_ENV", "VERCEL"];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const globals = globalThis as unknown as { veLabFreshDemo?: ReturnType<typeof fixture> };
  const original = globals.veLabFreshDemo;
  try {
    Object.assign(process.env, { DEMO_MODE: "true", ADMIN_EMAILS: manager.email, NODE_ENV: "development", VERCEL: "" }); globals.veLabFreshDemo = fixture();
    await mutateProjectDomain(manager, "Invitations", "Invited member", (s, actor) => planInvitation(s, actor, { id, email: member.email, projectId: "" }, now));
    assert.equal((await readStore()).invitations.length, 1); assert.equal((await readStore()).revision, 1);
    await recordLogin(member.personId, now); assert.equal((await readStore()).logins[0].at, now.toISOString());
    await mutateProjectDomain(member, "Invitations", "Accepted invitation", (s, actor) => acceptInvitation(s, actor, id, now));
    assert.equal((await readStore()).invitations[0].acceptedAt, now.toISOString());
  } finally {
    globals.veLabFreshDemo = original;
    for (const k of keys) { if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k]; }
  }
});
