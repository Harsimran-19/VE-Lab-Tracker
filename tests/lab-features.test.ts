import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JWT } from "google-auth-library";
import { fixture, manager, member, now } from "./fixture";
import { planProjectChange, planProjectCreation } from "../lib/project-details";
import { planEntry } from "../lib/entries";
import { planReminders } from "../lib/reminders";
import { planVersion, versionHistory } from "../lib/versions";
import { isLive } from "../lib/access";
import { isDemo } from "../lib/config";
import { appEnvironment, requireSeparateSpreadsheet } from "../lib/environment";
import { columnName, readSheet, TABLES } from "../lib/sheets";
import { profileSchema } from "../lib/schema";
import type { Store } from "../lib/types";

const PROJECT = "77777777-7777-4777-8777-777777777777";
const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
function proposed() {
  const s = fixture();
  const project = planProjectCreation(s, member, { id: PROJECT, name: "Fund search", goal: "Find a grant", type: "Fund Sourcing", milestone: "Submit letter of intent", due: "2026-10-06" });
  s.projects.push(project);
  s.memberships.push({ id: "proposer", projectId: PROJECT, personId: member.personId, joinedAt: now.toISOString() });
  return s;
}
const report = { projectId: PROJECT, weekStart: "2026-10-05", progress: "Drafted aims", nextPlan: "Send to the PI", needsHelp: false, blockers: "" };

test("members propose projects that wait for the manager's approval before reporting starts", () => {
  const s = proposed();
  const project = s.projects.find(p => p.id === PROJECT)!;
  assert.equal(project.approval, "pending");
  assert.equal(project.type, "Fund Sourcing");
  assert.equal(project.phase, "Ideation");
  assert.equal(project.requestedBy, member.personId);
  assert.equal(isLive(project), false);
  assert.throws(() => planEntry(s, member, report, now), /once this project is approved/);
  const reminded = (store: Store) => planReminders(store, now, [manager.email], "https://lab.example.com").some(r => r.reminder.projectId === PROJECT);
  assert.equal(reminded(s), false);
  assert.throws(() => planProjectChange(s, member, { id: PROJECT, action: "review", decision: "approve", note: "" }), /Manager access/);
  const approved = planProjectChange(s, manager, { id: PROJECT, action: "review", decision: "approve", note: "Go ahead" });
  assert.equal(approved.approval, "approved");
  assert.equal(approved.reviewNote, "Go ahead");
  s.projects = s.projects.map(p => p.id === PROJECT ? approved : p);
  assert.equal(reminded(s), true);
  assert.equal(planEntry(s, member, report, now).progress, "Drafted aims");
});

test("a project that is not approved can be revised and resubmitted by its team", () => {
  const s = proposed();
  const rejected = planProjectChange(s, manager, { id: PROJECT, action: "review", decision: "reject", note: "Narrow the scope" });
  assert.equal(rejected.approval, "rejected");
  s.projects = s.projects.map(p => p.id === PROJECT ? rejected : p);
  assert.throws(() => planProjectChange(s, manager, { id: "11111111-1111-4111-8111-111111111111", action: "resubmit" }), /resubmitted/);
  assert.equal(planProjectChange(s, member, { id: PROJECT, action: "resubmit" }).approval, "pending");
  // Projects created before approvals existed stay live.
  assert.equal(isLive(fixture().projects[0]), true);
});

test("member attributes need approval, and editing an approved attribute asks again", () => {
  const s = fixture();
  const id = fixture().projects[0].id, attributeId = "88888888-8888-4888-8888-888888888888";
  const save = (store: Store, who = member, value = "NSF") => planProjectChange(store, who, { id, action: "attribute", attribute: { id: attributeId, label: "Funding source", value } }, now);
  let project = save(s);
  assert.deepEqual(project.attributes?.map(a => [a.label, a.value, a.status, a.proposedBy]), [["Funding source", "NSF", "pending", member.personId]]);
  s.projects[0] = project;
  assert.throws(() => planProjectChange(s, member, { id, action: "attribute-review", attributeId, decision: "approve" }), /Manager access/);
  project = planProjectChange(s, manager, { id, action: "attribute-review", attributeId, decision: "approve" }, now);
  assert.equal(project.attributes?.[0].status, "approved");
  assert.equal(project.attributes?.[0].reviewedBy, manager.personId);
  s.projects[0] = project;
  assert.throws(() => planProjectChange(s, member, { id, action: "remove-attribute", attributeId }), /lab manager/);
  assert.equal(save(s, member, "NIH").attributes?.[0].status, "pending");
  assert.equal(save(s, manager, "NIH").attributes?.[0].status, "approved");
  assert.throws(() => planProjectChange(s, member, { id, action: "attribute", attribute: { id: "99999999-9999-4999-8999-999999999999", label: "funding SOURCE", value: "x" } }), /already has an attribute/);
  assert.deepEqual(planProjectChange(s, manager, { id, action: "remove-attribute", attributeId }).attributes, []);
});

test("weekly reports record hours, meetings and reference files", () => {
  const s = fixture();
  const projectId = s.projects[0].id;
  const base = { ...report, projectId };
  const saved = planEntry(s, member, {
    ...base, hours: 12.5, files: [{ label: "Interview notes", url: "https://drive.google.com/file/d/abc" }],
    piMeeting: "held", piMeetingDate: "2026-10-06", collaboratorMeeting: "scheduled", collaboratorMeetingDate: "2026-10-09",
    collaboratorNames: "HKUST team", meetingNotes: "Agreed on sample size",
  }, now);
  assert.equal(saved.hours, "12.5");
  assert.equal(saved.piMeeting, "held");
  assert.equal(saved.collaboratorNames, "HKUST team");
  assert.deepEqual(saved.files, [{ label: "Interview notes", url: "https://drive.google.com/file/d/abc" }]);
  s.updates.push(saved);
  // Older clients that omit the new fields keep what was saved.
  const edited = planEntry(s, member, { ...base, progress: "Edited" }, now);
  assert.equal(edited.hours, "12.5");
  assert.equal(edited.meetingNotes, "Agreed on sample size");
  // A meeting marked "none" drops its stale date.
  assert.equal(planEntry(s, member, { ...base, piMeeting: "none" }, now).piMeetingDate, "");
  for (const invalid of [{ hours: 169 }, { hours: -1 }, { hours: 1.1 }, { piMeetingDate: "2026-10-06" }, { files: [{ label: "x", url: "javascript:alert(1)" }] }])
    assert.throws(() => planEntry(fixture(), member, { ...base, ...invalid }, now));
});

test("data, paper and code keep every version in order and only project members add them", () => {
  const s = fixture();
  const projectId = s.projects[0].id, outputId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const add = (id: string, at: string, name = "Survey data") => {
    const v = planVersion(s, member, { id, projectId, outputId, kind: "Data", name, url: `https://drive.google.com/${id}`, notes: `Export ${id}` }, new Date(at));
    s.versions.push(v);
    return v;
  };
  add("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-10-01T00:00:00Z");
  // Later versions cannot rename or retype the item.
  const second = add("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "2026-10-08T00:00:00Z", "Renamed");
  assert.equal(second.name, "Survey data");
  assert.deepEqual(versionHistory(s.versions, outputId).map(v => [v.number, v.notes]), [[1, "Export bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"], [2, "Export cccccccc-cccc-4ccc-8ccc-cccccccccccc"]]);
  assert.throws(() => planVersion(s, member, { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", projectId, outputId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", kind: "Data", name: "survey DATA", url: "https://example.com", notes: "dup" }), /already has data/);
  const outsider = { ...member, personId: "outsider", email: "outsider@example.com" };
  s.people.push({ id: "outsider", name: "Outsider", email: outsider.email, setupComplete: "true", reminders: "true" });
  assert.throws(() => planVersion(s, outsider, { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", projectId, outputId, kind: "Data", name: "x", url: "https://example.com", notes: "x" }), /Join this project/);
});

test("profiles accept a bio, interests, skills and safe links", () => {
  assert.ok(profileSchema.parse({ name: "A", reminders: true, bio: "PhD student", interests: "LLMs", skills: "Python", profileLinks: [{ label: "Site", url: "https://example.com" }] }));
  assert.throws(() => profileSchema.parse({ name: "A", reminders: true, profileLinks: [{ label: "Bad", url: "ftp://example.com" }] }));
});

test("test and dev versions are labelled, never use demo mode in production and refuse the live spreadsheet", () => {
  assert.equal(isDemo(env({ VERCEL: "1", VERCEL_ENV: "preview", DEMO_MODE: "true" })), true);
  assert.equal(isDemo(env({ VERCEL: "1", VERCEL_ENV: "production", DEMO_MODE: "true" })), false);
  assert.equal(isDemo(env({ VERCEL: "1", VERCEL_ENV: "preview" })), false);
  assert.equal(appEnvironment(env({ VERCEL_ENV: "production", APP_ENV: "test" })), "production");
  assert.equal(appEnvironment(env({ VERCEL_ENV: "preview" })), "test");
  assert.equal(appEnvironment(env({ VERCEL_ENV: "preview", APP_ENV: "development" })), "development");
  assert.equal(appEnvironment(env({})), "development");
  assert.throws(() => requireSeparateSpreadsheet(env({ VERCEL_ENV: "preview", GOOGLE_SHEET_ID: "live", PRODUCTION_GOOGLE_SHEET_ID: "live" })), /live spreadsheet/);
  requireSeparateSpreadsheet(env({ VERCEL_ENV: "preview", GOOGLE_SHEET_ID: "copy", PRODUCTION_GOOGLE_SHEET_ID: "live" }));
  requireSeparateSpreadsheet(env({ VERCEL_ENV: "production", GOOGLE_SHEET_ID: "live", PRODUCTION_GOOGLE_SHEET_ID: "live" }));
});

const originalFetch = globalThis.fetch, originalToken = JWT.prototype.getAccessToken;
after(() => { globalThis.fetch = originalFetch; JWT.prototype.getAccessToken = originalToken; });
test("upgrading a 25-column project tab widens the grid before adding headers past column Z", async () => {
  assert.deepEqual([0, 25, 26, 51, 52].map(columnName), ["A", "Z", "AA", "AZ", "BA"]);
  Object.assign(process.env, { GOOGLE_SHEET_ID: "unit-test-sheet", GOOGLE_SERVICE_ACCOUNT_EMAIL: "unit@test.invalid", GOOGLE_PRIVATE_KEY: "not-a-real-key" });
  JWT.prototype.getAccessToken = async () => ({ token: "unit-test-token" });
  const previous = { LabProjects: 25, LabMembers: 7, LabReports: 12 } as Record<string, number>;
  const tabs = new Map(Object.entries(TABLES).map(([title, headers]) => [title, [headers.slice(0, previous[title] ?? headers.length) as string[]]]));
  const columns: Record<string, number> = Object.fromEntries(Object.keys(TABLES).map(t => [t, 26]));
  const log: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = decodeURIComponent(String(input));
    const ok = (v: unknown) => new Response(JSON.stringify(v));
    if (url.includes("?fields=")) return ok({ sheets: Object.keys(TABLES).map((title, sheetId) => ({ properties: { title, sheetId, gridProperties: { columnCount: columns[title] } } })) });
    if (url.includes("values:batchGet")) return ok({ valueRanges: Object.keys(TABLES).map(t => ({ values: tabs.get(t) })) });
    if (url.endsWith(":batchUpdate")) {
      for (const r of JSON.parse(String(init!.body)).requests) {
        const title = Object.keys(TABLES)[r.appendDimension.sheetId];
        columns[title] += r.appendDimension.length;
        log.push(`widen ${title} to ${columns[title]}`);
      }
      return ok({});
    }
    const title = url.match(/'([^']+)'!/)![1];
    if (init?.method === "PUT") {
      const start = url.match(/!([A-Z]+)1\?/)![1];
      const headers = JSON.parse(String(init.body)).values[0];
      assert.ok(tabs.get(title)![0].length + headers.length <= columns[title], `${title} needs a wider grid`);
      log.push(`headers ${title} from ${start}`);
      tabs.get(title)![0].push(...headers);
      return ok({});
    }
    return ok({ values: tabs.get(title) });
  };
  const store = await readSheet();
  assert.deepEqual(log, ["widen LabProjects to 30", "headers LabProjects from Z", "headers LabMembers from H", "headers LabReports from M"]);
  assert.deepEqual(store.versions, []);
  assert.deepEqual(tabs.get("LabProjects")![0], [...TABLES.LabProjects]);
});
