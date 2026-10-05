import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { JWT } from "google-auth-library";
import {
  appendSheet,
  initializeSheet,
  readSheet,
  replaceSheet,
  SheetSetupError,
  TABLES,
} from "../lib/sheets";
import { AppError } from "../lib/access";
import type { Store, Update } from "../lib/types";
import seed from "../lib/seed.json";

const originalFetch = globalThis.fetch;
const originalToken = JWT.prototype.getAccessToken;
const originalEnv = {
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
};
before(() => {
  process.env.GOOGLE_SHEET_ID = "unit-test-sheet";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "unit-test@example.invalid";
  process.env.GOOGLE_PRIVATE_KEY = "unit-test-placeholder-never-signed";
  JWT.prototype.getAccessToken = async () => ({ token: "unit-test-token" });
});
after(() => {
  globalThis.fetch = originalFetch;
  JWT.prototype.getAccessToken = originalToken;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function metadata() {
  return {
    sheets: Object.keys(TABLES).map((title, sheetId) => ({
      properties: { title, sheetId },
    })),
  };
}
function valueRanges() {
  const keys = {
    Projects: "projects",
    People: "people",
    Assignments: "assignments",
    Collaborators: "collaborators",
    Updates: "updates",
  } as const;
  return {
    valueRanges: (Object.keys(TABLES) as (keyof typeof TABLES)[]).map(
      (table) => ({
        values: [
          [...TABLES[table]],
          ...seed[keys[table]].map((row) =>
            TABLES[table].map((key) =>
              String((row as unknown as Record<string, string>)[key] ?? ""),
            ),
          ),
        ],
      }),
    ),
  };
}

test("reads the normalized workbook and rejects renamed headers", async () => {
  globalThis.fetch = async (input) =>
    response(
      String(input).includes("values:batchGet") ? valueRanges() : metadata(),
    );
  const store = await readSheet();
  assert.equal(store.projects.length, 15);
  assert.equal(store.assignments.length, 21);
  assert.equal(store.updates.length, 0);
  const wrong = valueRanges();
  wrong.valueRanges[0].values[0][0] = "renamed";
  globalThis.fetch = async (input) =>
    response(String(input).includes("values:batchGet") ? wrong : metadata());
  await assert.rejects(
    readSheet(),
    (e: unknown) => e instanceof AppError && e.status === 409,
  );
});
test("a newly created or wholly empty spreadsheet can be initialized", async () => {
  globalThis.fetch = async () =>
    response({ sheets: [{ properties: { title: "Sheet1" } }] });
  await assert.rejects(readSheet(), SheetSetupError);
  globalThis.fetch = async (input) =>
    response(
      String(input).includes("values:batchGet")
        ? { valueRanges: Object.keys(TABLES).map(() => ({})) }
        : metadata(),
    );
  await assert.rejects(readSheet(), SheetSetupError);
});
test("initialization never overwrites a populated existing project tab", async () => {
  const writes: string[] = [];
  globalThis.fetch = async (input, init) => {
    if (init?.method) writes.push(init.method);
    return response(
      String(input).includes("/values/")
        ? {
            values: [
              ["id", "name"],
              ["existing", "Original research"],
            ],
          }
        : metadata(),
    );
  };
  await assert.rejects(
    initializeSheet(seed as Store),
    (e: unknown) => e instanceof AppError && e.status === 409,
  );
  assert.deepEqual(writes, []);
});
test("initialization creates five tabs, seeds data with RAW writes, and starts with no reports", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  let created = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (init?.body) {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      if (url.endsWith(":batchUpdate") && !url.includes("/values"))
        created = true;
      return response({});
    }
    if (url.includes("values:batchGet")) return response(valueRanges());
    return response(
      created
        ? metadata()
        : { sheets: [{ properties: { title: "Sheet1", sheetId: 0 } }] },
    );
  };
  const store = await initializeSheet(seed as Store);
  assert.equal(store.projects.length, 15);
  assert.equal((calls[0].body.requests as unknown[]).length, 5);
  assert.equal(calls[1].body.valueInputOption, "RAW");
  const ranges = calls[1].body.data as { range: string; values: string[][] }[];
  assert.equal(
    ranges.find((r) => r.range === "'Updates'!A1")!.values.length,
    1,
  );
});
test("report append preserves text as RAW values and requests row insertion", async () => {
  const update: Update = {
    id: "test-report",
    createdAt: "2026-10-04T12:00:00Z",
    projectId: "P10",
    assignmentId: "A016",
    personId: "hars",
    progress: '=IMPORTXML("example")',
    blockers: "",
    nextPlan: "",
    status: "On track",
  };
  let requestUrl = "";
  let requestBody: { values: string[][] } | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return response({});
  };
  await appendSheet("Updates", update);
  assert.ok(requestUrl.includes("valueInputOption=RAW"));
  assert.ok(requestUrl.includes("insertDataOption=INSERT_ROWS"));
  assert.equal(requestBody!.values[0][5], update.progress);
});
test("admin edits resolve the current row by ID instead of using client row numbers", async () => {
  let writeUrl = "";
  globalThis.fetch = async (input, init) => {
    if (init?.method) {
      writeUrl = String(input);
      return response({});
    }
    return response({ values: [["id"], ["P99"], ["P01"]] });
  };
  await replaceSheet("Projects", seed.projects[0]);
  assert.ok(decodeURIComponent(writeUrl).includes("'Projects'!A3:Z3"));
  assert.ok(writeUrl.includes("valueInputOption=RAW"));
});
test("Google permission errors return actionable messages without upstream credential details", async () => {
  globalThis.fetch = async () =>
    response({ error: "upstream-private-details" }, 403);
  await assert.rejects(
    readSheet(),
    (e: unknown) =>
      e instanceof AppError &&
      e.status === 503 &&
      e.message.includes("share the Sheet") &&
      !e.message.includes("upstream-private-details"),
  );
});
test("a new member is appended to People with a stable ID, normalized email, and role", async () => {
  const person = {
    id: "new-person-id",
    name: "New Member",
    email: "new@example.com",
    affiliation: "Lab",
    role: "member" as const,
  };
  let requestUrl = "";
  let values: string[][] = [];
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    values = JSON.parse(String(init?.body)).values;
    return response({});
  };
  await appendSheet("People", person);
  assert.ok(decodeURIComponent(requestUrl).includes("'People'"));
  assert.ok(requestUrl.includes("valueInputOption=RAW"));
  assert.deepEqual(values, [TABLES.People.map((key) => person[key])]);
});
test("simultaneous Google signup rows converge without merging different accounts", async () => {
  const ranges = valueRanges();
  const person = [
    "google-stable-id",
    "New member",
    "new@example.com",
    "",
    "member",
  ];
  ranges.valueRanges[1].values.push(person, [...person]);
  globalThis.fetch = async (input) =>
    response(String(input).includes("values:batchGet") ? ranges : metadata());
  const store = await readSheet();
  assert.equal(
    store.people.filter((p) => p.email === "new@example.com").length,
    1,
  );
  ranges.valueRanges[1].values.push([
    "different-id",
    "Different person",
    "new@example.com",
    "",
    "member",
  ]);
  await assert.rejects(
    readSheet(),
    (e: unknown) => e instanceof AppError && e.status === 409,
  );
});

test("profile upgrades add only the optional tab and never write existing research rows", async () => {
  const { upsertProfile, EXTRA_TABLES } = await import("../lib/sheets");
  let created = false;
  const writes: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (init?.body) {
      const body = JSON.parse(String(init.body));
      writes.push({ url, body });
      if (url.endsWith(":batchUpdate")) {
        created = true;
      }
      return response({});
    }
    if (url.includes("?fields="))
      return response({
        sheets: [
          ...metadata().sheets,
          ...(created
            ? [{ properties: { title: "Profiles", sheetId: 5 } }]
            : []),
        ],
      });
    if (decodeURIComponent(url).includes("'Profiles'!A:A"))
      return response({ values: [["id"]] });
    return response({});
  };
  const profile = {
    id: "hars",
    position: "PhD",
    expertise: "=literal skill",
    bio: "Research",
    reminders: "false",
  };
  await upsertProfile(profile);
  assert.equal(writes.length, 3);
  assert.deepEqual(writes[0].body.requests, [
    {
      addSheet: {
        properties: {
          title: "Profiles",
          gridProperties: { frozenRowCount: 1 },
        },
      },
    },
  ]);
  assert.deepEqual(writes[1].body.values, [[...EXTRA_TABLES.Profiles]]);
  assert.ok(writes[2].url.includes("valueInputOption=RAW"));
  assert.ok(
    writes.every(
      (w) =>
        !decodeURIComponent(w.url).includes("'People'") &&
        !decodeURIComponent(w.url).includes("'Projects'"),
    ),
  );
});
test("optional tabs with existing data are validated and malformed headers are never overwritten", async () => {
  const { ensureExtraTable } = await import("../lib/sheets");
  const writes: string[] = [];
  globalThis.fetch = async (input, init) => {
    if (init?.method) writes.push(init.method);
    return response(
      String(input).includes("?fields=")
        ? { sheets: [{ properties: { title: "Profiles" } }] }
        : { values: [["unrecognized"], ["valuable existing data"]] },
    );
  };
  await assert.rejects(
    ensureExtraTable("Profiles"),
    (e: unknown) => e instanceof AppError && e.status === 409,
  );
  assert.deepEqual(writes, []);
});
test("shared read includes profiles and server-side reminder records from upgraded Sheets", async () => {
  const { EXTRA_TABLES } = await import("../lib/sheets");
  const ranges = valueRanges();
  ranges.valueRanges.push({
    values: [
      [...EXTRA_TABLES.Profiles],
      ["hars", "PhD", "LLMs", "Research", "false"],
    ],
  });
  ranges.valueRanges.push({
    values: [
      [...EXTRA_TABLES.Reminders],
      [
        "reminder-1",
        "hars",
        "P10",
        "2026-10-08",
        "upcoming",
        "2026-10-05T04:00:00Z",
        "2026-10-05T04:00:00Z",
        "provider-1",
      ],
    ],
  });
  ranges.valueRanges.splice(5, 0, {
    values: [
      [...EXTRA_TABLES.Onboarding],
      ["hars", "2026-10-05T00:00:00Z", "hars", "linked", "member@example.com"],
    ],
  });
  globalThis.fetch = async (input) =>
    response(
      String(input).includes("values:batchGet")
        ? ranges
        : {
            sheets: [
              ...metadata().sheets,
              ...Object.keys(EXTRA_TABLES).map((title, i) => ({
                properties: { title, sheetId: i + 5 },
              })),
            ],
          },
    );
  const store = await readSheet();
  assert.equal(store.onboarding![0].status, "linked");
  assert.equal(store.profiles![0].expertise, "LLMs");
  assert.equal(store.profiles![0].reminders, "false");
  assert.equal(store.reminders![0].providerId, "provider-1");
  assert.equal(store.projects.length, 15);
});

test("edits to duplicate signup and join rows retain the latest name, role and work status", async () => {
  const ranges = valueRanges();
  ranges.valueRanges[1].values.push(
    ["google-stable", "Original name", "duplicate@example.com", "", "member"],
    ["google-stable", "Updated name", "duplicate@example.com", "Lab", "admin"],
  );
  ranges.valueRanges[2].values.push(
    ["join-stable", "P10", "google-stable", "Project work", "In progress", ""],
    ["join-stable", "P10", "google-stable", "Project work", "Done", ""],
  );
  globalThis.fetch = async (input) =>
    response(String(input).includes("values:batchGet") ? ranges : metadata());
  const store = await readSheet();
  assert.equal(
    store.people.find((p) => p.id === "google-stable")!.name,
    "Updated name",
  );
  assert.equal(
    store.people.find((p) => p.id === "google-stable")!.role,
    "admin",
  );
  assert.equal(
    store.assignments.find((a) => a.id === "join-stable")!.status,
    "Done",
  );
  ranges.valueRanges[2].values.push([
    "join-stable",
    "P10",
    "different-person",
    "Project work",
    "Done",
    "",
  ]);
  await assert.rejects(
    readSheet(),
    (e: unknown) => e instanceof AppError && e.status === 409,
  );
});

test("imported work moves every duplicate row while retaining responsibility IDs", async () => {
  const urls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    if (url.includes(encodeURIComponent("'Assignments'!A:A")))
      return response({ values: [["id"], ["A004"], ["other"], ["A004"]] });
    const values = JSON.parse(String(init!.body)).values;
    assert.equal(values[0][0], "A004");
    assert.equal(values[0][2], "new-member");
    return response({});
  };
  await replaceSheet(
    "Assignments",
    {
      ...seed.assignments.find((a) => a.id === "A004")!,
      personId: "new-member",
    },
    true,
  );
  assert.equal(urls.length, 3);
  assert.ok(urls[1].includes(encodeURIComponent("'Assignments'!A2:Z2")));
  assert.ok(urls[2].includes(encodeURIComponent("'Assignments'!A4:Z4")));
});
