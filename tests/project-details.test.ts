import test from "node:test";
import assert from "node:assert/strict";
import { fixture, manager, member, now } from "./fixture";
import {
  planProjectChange,
  planWorkstreamChange,
} from "../lib/project-details";
import { planEntry } from "../lib/entries";
import { planReminders } from "../lib/reminders";
import type { Workstream } from "../lib/types";

const stream: Workstream = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Literature review",
  ownerId: member.personId,
  status: "In progress",
  due: "2026-10-06",
  notes: "Focus on the sampling methods.",
};
function withStream() {
  const s = fixture();
  s.projects[0].workstreams = [{ ...stream }];
  return s;
}
const entry = {
  projectId: fixture().projects[0].id,
  weekStart: "2026-10-05",
  progress: "Reviewed papers",
  nextPlan: "Summarize findings",
  needsHelp: false,
  blockers: "",
};

test("research details are optional, lead must be real, and resource links must be safe", () => {
  const s = fixture();
  const details = {
    id: s.projects[0].id,
    action: "details",
    fullTitle: "Pilot research study",
    leadId: manager.personId,
    priority: "Push",
    methods: "Interviews",
    notes: "Context",
    links: [{ label: "Dataset", url: "https://example.com/data" }],
  };
  const project = planProjectChange(s, manager, details);
  assert.equal(project.leadId, manager.personId);
  assert.equal(project.goal, s.projects[0].goal);
  assert.equal(s.memberships.length, 1);
  assert.throws(() => planProjectChange(s, member, details), /Manager access/);
  assert.throws(
    () => planProjectChange(s, manager, { ...details, leadId: "missing" }),
    /lead/,
  );
  for (const url of [
    "javascript:alert(1)",
    "file:///private/file",
    "data:text/html,hello",
  ])
    assert.throws(() =>
      planProjectChange(s, manager, {
        ...details,
        links: [{ label: "Link", url }],
      }),
    );
});

test("publication status is separate from research phase and collaborators need no account", () => {
  const s = fixture();
  const p = planProjectChange(s, manager, {
    id: s.projects[0].id,
    action: "publication",
    publicationStatus: "Under review",
    targetJournal: "Research Journal",
    altJournal: "",
    targetConference: "",
  });
  assert.equal(p.phase, "Idea");
  assert.equal(p.publicationStatus, "Under review");
  const c = {
    id: stream.id,
    name: "External co-author",
    affiliation: "Partner university",
    role: "Co-author",
    email: "",
    contactVia: "Project lead",
    notes: "",
  };
  const result = planProjectChange(s, manager, {
    id: p.id,
    action: "collaborator",
    collaborator: c,
  });
  assert.equal(result.collaborators?.length, 1);
  assert.equal(s.people.length, 2);
  s.projects[0] = result;
  assert.equal(
    planProjectChange(s, manager, {
      id: p.id,
      action: "collaborator",
      collaborator: c,
    }).collaborators?.length,
    1,
  );
});

test("managers assign responsibilities only to members of that project", () => {
  const s = fixture();
  const body = {
    projectId: s.projects[0].id,
    action: "save",
    workstream: stream,
  };
  assert.equal(
    planWorkstreamChange(s, manager, body).workstreams?.[0].ownerId,
    member.personId,
  );
  assert.throws(() => planWorkstreamChange(s, member, body), /Manager access/);
  assert.throws(
    () =>
      planWorkstreamChange(s, manager, {
        ...body,
        workstream: { ...stream, ownerId: manager.personId },
      }),
    /joined/,
  );
});

test("owners can update only their own status; archive is reversible", () => {
  const s = withStream();
  const body = {
    projectId: s.projects[0].id,
    action: "status",
    workstreamId: stream.id,
    status: "Blocked",
  };
  assert.equal(
    planWorkstreamChange(s, member, body).workstreams?.[0].status,
    "Blocked",
  );
  assert.throws(
    () =>
      planWorkstreamChange(s, { ...member, personId: "someone-else" }, body),
    /owner or manager/,
  );
  s.projects[0] = planWorkstreamChange(s, manager, {
    projectId: s.projects[0].id,
    action: "archive",
    workstreamId: stream.id,
  });
  assert.equal(s.projects[0].workstreams?.[0].archived, true);
  assert.throws(() => planWorkstreamChange(s, member, body), /Restore/);
  const restored = planWorkstreamChange(s, manager, {
    projectId: s.projects[0].id,
    action: "restore",
    workstreamId: stream.id,
  });
  assert.equal(restored.workstreams?.[0].archived, false);
});

test("one weekly report covers multiple owned responsibilities and keeps their names", () => {
  const s = withStream();
  const second = {
    ...stream,
    id: "33333333-3333-4333-8333-333333333333",
    name: "Data collection",
  };
  s.projects[0].workstreams!.push(second);
  const report = planEntry(
    s,
    member,
    { ...entry, workstreamIds: [stream.id, second.id, stream.id] },
    now,
  );
  assert.deepEqual(report.workstreams, [
    { id: stream.id, name: stream.name },
    { id: second.id, name: second.name },
  ]);
  s.updates.push(report);
  s.projects[0].workstreams![0].archived = true;
  s.projects[0].workstreams![1].name = "Interviews";
  const edited = planEntry(
    s,
    member,
    {
      ...entry,
      progress: "Updated progress",
      workstreamIds: [stream.id, second.id],
    },
    now,
  );
  assert.equal(edited.id, report.id);
  assert.equal(edited.workstreams?.[0].name, "Literature review");
  assert.equal(edited.workstreams?.[1].name, "Interviews");
  assert.throws(
    () =>
      planEntry(
        s,
        member,
        { ...entry, workstreamIds: ["44444444-4444-4444-8444-444444444444"] },
        now,
      ),
    /responsibilities/,
  );
});

test("reports reject another owner's responsibility and old clients preserve selections", () => {
  const s = withStream();
  s.projects[0].workstreams![0].ownerId = manager.personId;
  assert.throws(
    () => planEntry(s, member, { ...entry, workstreamIds: [stream.id] }, now),
    /responsibilities/,
  );
  s.projects[0].workstreams![0].ownerId = member.personId;
  s.updates.push(
    planEntry(s, member, { ...entry, workstreamIds: [stream.id] }, now),
  );
  assert.equal(
    planEntry(
      s,
      member,
      { ...entry, progress: "Edited by existing client" },
      now,
    ).workstreams?.[0].id,
    stream.id,
  );
  assert.deepEqual(
    planEntry(s, member, { ...entry, workstreamIds: [] }, now).workstreams,
    [],
  );
});

test("responsibility reminders go to their owner and exclude finished, archived and paused work", () => {
  const s = withStream();
  const reminders = () =>
    planReminders(s, now, [manager.email], "https://lab.example.com").filter(
      (r) => r.reminder.phase.startsWith("responsibility-"),
    );
  assert.equal(reminders().length, 1);
  assert.equal(reminders()[0].email, member.email);
  s.projects[0].workstreams![0].status = "Blocked";
  assert.ok(
    planReminders(
      s,
      new Date("2026-10-09T16:00:00Z"),
      [manager.email],
      "https://lab.example.com",
    )
      .find((r) => r.reminder.phase === "weekly-summary")
      ?.text.includes("Literature review is blocked"),
  );
  s.projects[0].workstreams![0].status = "Done";
  assert.equal(reminders().length, 0);
  s.projects[0].workstreams![0].status = "In progress";
  s.projects[0].workstreams![0].archived = true;
  assert.equal(reminders().length, 0);
  s.projects[0].workstreams![0].archived = false;
  s.projects[0] = planProjectChange(s, manager, {
    id: s.projects[0].id,
    action: "pause",
  });
  assert.equal(reminders().length, 0);
  assert.throws(() => planEntry(s, member, entry, now), /not active/);
  assert.throws(
    () =>
      planWorkstreamChange(s, manager, {
        projectId: s.projects[0].id,
        action: "save",
        workstream: stream,
      }),
    /Reopen/,
  );
  assert.equal(
    planProjectChange(s, manager, { id: s.projects[0].id, action: "reopen" })
      .state,
    "active",
  );
});
