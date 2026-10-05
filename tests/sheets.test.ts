import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { JWT } from "google-auth-library";
import { TABLES, readSheet, ensureTables, upsertSheet } from "../lib/sheets";
import { fixture } from "./fixture";
import { emptyStore } from "../lib/types";
const originalFetch = globalThis.fetch,
  originalToken = JWT.prototype.getAccessToken;
const names = [
    "GOOGLE_SHEET_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
  ],
  saved = Object.fromEntries(names.map((k) => [k, process.env[k]]));
before(() => {
  Object.assign(process.env, {
    GOOGLE_SHEET_ID: "unit-test-sheet",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "unit@test.invalid",
    GOOGLE_PRIVATE_KEY: "not-a-real-key",
  });
  JWT.prototype.getAccessToken = async () => ({ token: "unit-test-token" });
});
after(() => {
  globalThis.fetch = originalFetch;
  JWT.prototype.getAccessToken = originalToken;
  for (const k of names) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const metadata = () => ({
  sheets: Object.keys(TABLES).map((title) => ({ properties: { title } })),
});
function ranges() {
  const s = fixture();
  const records = [
    s.projects,
    s.people,
    s.memberships,
    s.updates,
    [s.settings],
    s.reminders,
  ];
  return {
    valueRanges: Object.entries(TABLES).map(([name, headers], i) => ({
      values: [
        [...headers],
        ...records[i].map((row) =>
          headers.map((h) =>
            String((row as unknown as Record<string, string>)[h] ?? ""),
          ),
        ),
      ],
    })),
  };
}
test("legacy tracker sheets return an empty new lab and are never imported", async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return response({
      sheets: [
        "Projects",
        "People",
        "Assignments",
        "Updates",
        "Profiles",
        "Onboarding",
      ].map((title) => ({ properties: { title } })),
    });
  };
  assert.deepEqual(await readSheet(), emptyStore());
  assert.equal(requests, 1);
});
test("fresh schema reads project goals, self-signups and one shared reporting schedule", async () => {
  globalThis.fetch = async (input) =>
    response(String(input).includes("values:batchGet") ? ranges() : metadata());
  const s = await readSheet();
  assert.equal(s.projects[0].goal, "Understand interview patterns");
  assert.equal(s.people.length, 2);
  assert.equal(s.memberships.length, 1);
  assert.equal(s.settings.reportingTime, "18:00");
});
test("first setup creates only fresh tabs and headers, never old records or seed data", async () => {
  const urls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = decodeURIComponent(String(input));
    urls.push(url);
    if (!init?.method)
      return response(
        url.includes("?fields=")
          ? { sheets: [{ properties: { title: "People" } }] }
          : { values: [] },
      );
    const body = JSON.parse(String(init.body));
    if (url.includes(":batchUpdate"))
      assert.deepEqual(
        body.requests.map(
          (r: { addSheet: { properties: { title: string } } }) =>
            r.addSheet.properties.title,
        ),
        Object.keys(TABLES),
      );
    else {
      assert.equal(body.values.length, 1);
      assert.equal(body.values[0][0], "id");
    }
    return response({});
  };
  await ensureTables();
  assert.equal(urls.filter((u) => u.includes("!A1")).length, 6);
  assert.equal(
    urls.some((u) => u.includes("'People'!")),
    false,
  );
});
test("interrupted first setup repairs missing tabs without changing existing projects", async () => {
  const project = ranges().valueRanges[0].values;
  const tabs = new Map<string, string[][]>([
    ["LabProjects", structuredClone(project)],
  ]);
  let writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("?fields="))
      return response({
        sheets: [...tabs.keys()].map((title) => ({ properties: { title } })),
      });
    if (url.includes("values:batchGet"))
      return response({
        valueRanges: Object.keys(TABLES).map((title) => ({
          values: tabs.get(title),
        })),
      });
    if (url.includes(":batchUpdate")) {
      writes++;
      const body = JSON.parse(String(init?.body));
      for (const item of body.requests) {
        assert.notEqual(item.addSheet.properties.title, "LabProjects");
        tabs.set(item.addSheet.properties.title, []);
      }
      return response({});
    }
    const title = url.match(/'([^']+)'!/)![1];
    if (init?.method === "PUT") {
      writes++;
      assert.notEqual(title, "LabProjects");
      tabs.set(title, JSON.parse(String(init.body)).values);
      return response({});
    }
    return response({ values: tabs.get(title) });
  };
  const recovered = await readSheet();
  assert.equal(recovered.projects.length, 1);
  assert.equal(recovered.people.length, 0);
  assert.equal(recovered.settings.timezone, "Asia/Kolkata");
  assert.deepEqual(tabs.get("LabProjects"), project);
  assert.equal(writes, 6);
  assert.deepEqual(await readSheet(), recovered);
  assert.equal(writes, 6);
});
test("malformed populated headers are refused without overwriting data", async () => {
  let writes = 0;
  globalThis.fetch = async (input, init) => {
    if (init?.method) writes++;
    return response(
      String(input).includes("?fields=")
        ? metadata()
        : { values: [["unexpected"], ["existing-record"]] },
    );
  };
  await assert.rejects(ensureTables(true));
  assert.equal(writes, 0);
});
test("upserts use RAW input, update the last matching ID and preserve multiline reports", async () => {
  let written = false;
  globalThis.fetch = async (input, init) => {
    const url = decodeURIComponent(String(input));
    if (url.includes("?fields=")) return response(metadata());
    if (!init?.method)
      return response({
        values: [["id"], ["report-id"], ["other"], ["report-id"]],
      });
    assert.equal(init.method, "PUT");
    assert.ok(url.includes("'LabReports'!A4:Z4?valueInputOption=RAW"));
    const body = JSON.parse(String(init.body));
    assert.equal(body.values[0][6], "=literal formula\nSecond line");
    written = true;
    return response({});
  };
  await upsertSheet("LabReports", {
    id: "report-id",
    personId: "member",
    projectId: "project",
    weekStart: "2026-10-05",
    createdAt: "2026-10-05T00:00:00Z",
    updatedAt: "2026-10-05T00:00:00Z",
    progress: "=literal formula\nSecond line",
    nextPlan: "Next",
    needsHelp: "false",
    blockers: "",
  });
  assert.equal(written, true);
});
test("concurrent identical signup rows converge but conflicting Google emails are rejected", async () => {
  const data = ranges();
  data.valueRanges[1].values.push([...data.valueRanges[1].values[2]]);
  globalThis.fetch = async (input) =>
    response(String(input).includes("values:batchGet") ? data : metadata());
  assert.equal((await readSheet()).people.length, 2);
  data.valueRanges[1].values.push([
    "different-id",
    "Different",
    "member@example.com",
    "true",
    "true",
  ]);
  await assert.rejects(readSheet());
});
test("Google permission failures are actionable and do not expose upstream credentials", async () => {
  globalThis.fetch = async () =>
    response({ privateCredential: "never-return-this" }, 403);
  await assert.rejects(
    readSheet(),
    (e) =>
      e instanceof Error &&
      e.message.includes("service account") &&
      !e.message.includes("never-return"),
  );
});
