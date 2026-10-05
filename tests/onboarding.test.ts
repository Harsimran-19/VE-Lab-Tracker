import test from "node:test";
import assert from "node:assert/strict";
import seed from "../lib/seed.json";
import { rosterCandidate, linkRequest } from "../lib/onboarding";
import { workspaceFor } from "../lib/access";
import { onboardingSchema } from "../lib/schema";
import type { Store, Identity } from "../lib/types";
const admin: Identity = {
  personId: "harsimran",
  name: "Admin",
  email: "harsimran1869@gmail.com",
  role: "admin",
};
const member: Identity = {
  personId: "new-member",
  name: "New member",
  email: "new@example.com",
  role: "member",
};
function fixture(): Store {
  const store = structuredClone(seed) as Store;
  store.people.push({
    id: member.personId,
    name: member.name,
    email: member.email,
    affiliation: "",
    role: "member",
  });
  store.onboarding = [
    {
      id: member.personId,
      completedAt: "2026-10-05T00:00:00Z",
      rosterId: "lin",
      status: "pending",
      requesterEmail: member.email,
    },
  ];
  return store;
}
test("new members start with name setup and choosing a name does not change Google identity", () => {
  const store = fixture();
  store.onboarding = [];
  assert.equal(
    workspaceFor(store, member, false, [admin.email]).needsOnboarding,
    true,
  );
  assert.equal(
    workspaceFor(store, admin, false, [admin.email]).needsOnboarding,
    false,
  );
  assert.equal(rosterCandidate(store, "lin", member).name, "Lin");
  assert.equal(member.personId, "new-member");
  assert.equal(store.people.find((p) => p.id === "lin")!.email, "");
  const own = {
    id: member.personId,
    completedAt: "2026-10-05",
    rosterId: "lin",
    status: "pending",
    requesterEmail: member.email,
  };
  store.onboarding = [
    own,
    { ...own, id: "other", requesterEmail: "private@example.com" },
  ];
  const ws = workspaceFor(store, member, false, []);
  assert.equal(ws.needsOnboarding, false);
  assert.deepEqual(ws.onboarding, [own]);
});
test("imported history can be connected only by admin and cannot claim an active account", () => {
  const store = fixture();
  assert.equal(linkRequest(store, admin, member.personId).roster.id, "lin");
  assert.throws(() => linkRequest(store, member, member.personId));
  assert.throws(() => rosterCandidate(store, admin.personId, member));
  store.people.find((p) => p.id === "lin")!.email = "lin@example.com";
  assert.throws(() => linkRequest(store, admin, member.personId));
  store.people.find((p) => p.id === "lin")!.email = "";
  store.onboarding!.push({
    id: "lin",
    completedAt: "",
    rosterId: "another-member",
    status: "linking",
    requesterEmail: "another@example.com",
  });
  assert.throws(() => linkRequest(store, admin, member.personId));
  store.onboarding![1].rosterId = member.personId;
  assert.equal(linkRequest(store, admin, member.personId).roster.id, "lin");
});
test("onboarding rejects access spoofing and invalid selections", () => {
  const input = {
    name: "Lin",
    position: "PhD",
    expertise: "Interviews",
    rosterId: "lin",
    projectIds: ["P04"],
  };
  assert.equal(onboardingSchema.safeParse(input).success, true);
  for (const key of ["id", "role", "email", "status"])
    assert.equal(
      onboardingSchema.safeParse({ ...input, [key]: "admin" }).success,
      false,
    );
  assert.equal(
    onboardingSchema.safeParse({ ...input, name: " " }).success,
    false,
  );
  assert.equal(
    onboardingSchema.safeParse({ ...input, projectIds: Array(31).fill("P04") })
      .success,
    false,
  );
});

test("a rejected duplicate request can stay separate, but an interrupted migration must finish", async () => {
  const { connectionRequest, requireUnstartedConnection } = await import(
    "../lib/onboarding"
  );
  const store = fixture();
  store.onboarding!.push({
    id: "lin",
    completedAt: "",
    rosterId: "someone-else",
    status: "archived",
    requesterEmail: "other@example.com",
  });
  assert.equal(
    connectionRequest(store, admin, member.personId).member.id,
    member.personId,
  );
  requireUnstartedConnection(store, "lin", member.personId);
  store.onboarding![1].rosterId = member.personId;
  store.onboarding![1].status = "linking";
  assert.throws(() =>
    requireUnstartedConnection(store, "lin", member.personId),
  );
});
