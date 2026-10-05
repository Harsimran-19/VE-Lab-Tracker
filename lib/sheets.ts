import "server-only";
import { JWT } from "google-auth-library";
import { AppError } from "./access";
import type {
  Assignment,
  Collaborator,
  Person,
  Profile,
  Project,
  Reminder,
  Store,
  Update,
} from "./types";

export const TABLES = {
  Projects: [
    "id",
    "name",
    "title",
    "stage",
    "pipeline",
    "methods",
    "journal",
    "conference",
    "priority",
    "milestone",
    "due",
    "notes",
  ],
  People: ["id", "name", "email", "affiliation", "role"],
  Assignments: [
    "id",
    "projectId",
    "personId",
    "responsibility",
    "status",
    "due",
  ],
  Collaborators: ["id", "projectId", "name", "affiliation", "role"],
  Updates: [
    "id",
    "createdAt",
    "projectId",
    "assignmentId",
    "personId",
    "progress",
    "blockers",
    "nextPlan",
    "status",
  ],
} as const;
export const EXTRA_TABLES = {
  Profiles: ["id", "position", "expertise", "bio", "reminders"],
  Reminders: [
    "id",
    "personId",
    "projectId",
    "due",
    "phase",
    "createdAt",
    "sentAt",
    "providerId",
  ],
} as const;
const ALL_TABLES = { ...TABLES, ...EXTRA_TABLES };
type Table = keyof typeof ALL_TABLES;
type Entity =
  | Project
  | Person
  | Assignment
  | Collaborator
  | Update
  | Profile
  | Reminder;
export class SheetSetupError extends AppError {
  constructor() {
    super("The new spreadsheet has not been initialized yet.", 409);
  }
}

let auth: JWT | undefined;
async function request(path: string, init?: RequestInit) {
  const sheet = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!sheet || !email || !key)
    throw new AppError(
      "Google Sheets is not configured. Follow docs/GOOGLE_SETUP.md.",
      503,
    );
  auth ??= new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const token = await auth.getAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheet)}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.token}`,
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) {
    if (response.status === 403)
      throw new AppError(
        "The service account cannot edit this Sheet. Enable the Sheets API and share the Sheet with its email as an editor.",
        503,
      );
    if (response.status === 404)
      throw new AppError(
        "The spreadsheet was not found. Check GOOGLE_SHEET_ID and its sharing settings.",
        503,
      );
    if (response.status === 429)
      throw new AppError(
        "Google Sheets is busy. Wait a moment and try again.",
        503,
      );
    throw new AppError(
      "Google Sheets could not complete the request. Please try again.",
      503,
    );
  }
  return response.json();
}
function toObjects<T>(values: string[][], headers: readonly string[]): T[] {
  const actual = values[0] ?? [];
  if (headers.some((h, i) => actual[i] !== h))
    throw new AppError(
      "The spreadsheet headers do not match the app. Restore the expected headers using the setup guide. Existing records have not been changed.",
      409,
    );
  return values
    .slice(1)
    .filter((r) => r[0])
    .map(
      (row) =>
        Object.fromEntries(
          headers.map((h, i) => [h, String(row[i] ?? "")]),
        ) as T,
    );
}
export async function readSheet(): Promise<Store> {
  const meta = await request("?fields=sheets.properties.title");
  const names = new Set(
    meta.sheets.map(
      (s: { properties: { title: string } }) => s.properties.title,
    ),
  );
  if (!Object.keys(TABLES).every((t) => names.has(t)))
    throw new SheetSetupError();
  const query = new URLSearchParams();
  const tables = [
    ...Object.keys(TABLES),
    ...Object.keys(EXTRA_TABLES).filter((t) => names.has(t)),
  ];
  for (const table of tables) query.append("ranges", `'${table}'!A:Z`);
  query.set("valueRenderOption", "UNFORMATTED_VALUE");
  const result = await request(`/values:batchGet?${query}`);
  const ranges = result.valueRanges.map(
    (r: { values?: string[][] }) => r.values ?? [],
  );
  if (
    ranges.every(
      (r: string[][]) => !r.some((row) => row.some((cell) => cell !== "")),
    )
  )
    throw new SheetSetupError();
  const store: Store = {
    projects: toObjects<Project>(ranges[0], TABLES.Projects),
    people: toObjects<Person>(ranges[1], TABLES.People),
    assignments: toObjects<Assignment>(ranges[2], TABLES.Assignments),
    collaborators: toObjects<Collaborator>(ranges[3], TABLES.Collaborators),
    updates: toObjects<Update>(ranges[4], TABLES.Updates),
    profiles: names.has("Profiles")
      ? toObjects<Profile>(
          ranges[tables.indexOf("Profiles")],
          EXTRA_TABLES.Profiles,
        )
      : [],
    reminders: names.has("Reminders")
      ? toObjects<Reminder>(
          ranges[tables.indexOf("Reminders")],
          EXTRA_TABLES.Reminders,
        )
      : [],
  };
  // Identical first-login appends can race across Vercel instances. Keep one
  // logical person for a stable Google ID; never merge different identities.
  store.people = store.people.filter((person, index, people) => {
    const first = people.findIndex((p) => p.id === person.id);
    if (first === index) return true;
    const original = people[first];
    if (
      original.email.trim().toLowerCase() !==
        person.email.trim().toLowerCase() ||
      original.role !== person.role
    )
      throw new AppError(
        "Conflicting person records in the People tab. Correct the duplicate before continuing.",
        409,
      );
    return false;
  });
  if (store.people.some((p) => !["admin", "member"].includes(p.role)))
    throw new AppError("People.role must be admin or member.", 409);
  const emails = store.people
    .map((p) => p.email.toLowerCase().trim())
    .filter(Boolean);
  if (new Set(emails).size !== emails.length)
    throw new AppError(
      "Two people have the same email in the People tab. Correct the duplicate before continuing.",
      409,
    );
  // Concurrent first profile saves may append twice; the latest row wins.
  store.profiles = store.profiles!.filter(
    (p, i, rows) => rows.findLastIndex((r) => r.id === p.id) === i,
  );
  store.assignments = store.assignments.filter(
    (a, i, rows) => rows.findIndex((r) => r.id === a.id) === i,
  );
  store.reminders = store.reminders!.filter(
    (r, i, rows) => rows.findLastIndex((row) => row.id === r.id) === i,
  );
  return store;
}
function cells(table: Table, entity: Entity) {
  return ALL_TABLES[table].map((h) =>
    String((entity as unknown as Record<string, string>)[h] ?? ""),
  );
}

// Add only optional tabs; never reinitialize or rewrite the original records.
export async function ensureExtraTable(table: keyof typeof EXTRA_TABLES) {
  const metadata = () => request("?fields=sheets.properties.title");
  let meta = await metadata();
  if (
    !meta.sheets.some(
      (s: { properties: { title: string } }) => s.properties.title === table,
    )
  ) {
    try {
      await request(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: table,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
          ],
        }),
      });
    } catch (error) {
      // Another instance may have created this same tab in the meantime.
      meta = await metadata();
      if (
        !meta.sheets.some(
          (s: { properties: { title: string } }) =>
            s.properties.title === table,
        )
      )
        throw error;
    }
  }
  const data = await request(`/values/${encodeURIComponent(`'${table}'!A:Z`)}`);
  if (data.values?.some((r: string[]) => r.some((v) => v !== ""))) {
    toObjects(data.values, EXTRA_TABLES[table]);
    return;
  }
  await request(
    `/values/${encodeURIComponent(`'${table}'!A1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [[...EXTRA_TABLES[table]]] }),
    },
  );
}
export async function upsertProfile(profile: Profile) {
  await ensureExtraTable("Profiles");
  const data = await request(`/values/${encodeURIComponent("'Profiles'!A:A")}`);
  const index = (data.values ?? []).findLastIndex(
    (row: string[]) => row[0] === profile.id,
  );
  if (index < 1) return appendSheet("Profiles", profile);
  await request(
    `/values/${encodeURIComponent(`'Profiles'!A${index + 1}:Z${index + 1}`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [cells("Profiles", profile)] }),
    },
  );
}
export async function appendSheet(table: Table, entity: Entity) {
  await request(
    `/values/${encodeURIComponent(`'${table}'!A:Z`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [cells(table, entity)] }),
    },
  );
}
export async function replaceSheet(table: Table, entity: Entity) {
  const result = await request(
    `/values/${encodeURIComponent(`'${table}'!A:A`)}`,
  );
  const index = (result.values ?? []).findLastIndex(
    (row: string[]) => row[0] === entity.id,
  );
  if (index < 1)
    throw new AppError(
      "This record no longer exists. Refresh and try again.",
      404,
    );
  await request(
    `/values/${encodeURIComponent(`'${table}'!A${index + 1}:Z${index + 1}`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [cells(table, entity)] }),
    },
  );
}
export async function initializeSheet(seed: Store) {
  const meta = await request("?fields=sheets.properties(title,sheetId)");
  const existing = meta.sheets as {
    properties: { title: string; sheetId: number };
  }[];
  const names = new Set(existing.map((s) => s.properties.title));
  // Never replace an existing workbook or partially populated table.
  for (const table of Object.keys(TABLES) as (keyof typeof TABLES)[]) {
    if (!names.has(table)) continue;
    const data = await request(
      `/values/${encodeURIComponent(`'${table}'!A:Z`)}`,
    );
    if (data.values?.some((r: string[]) => r.some((v) => v !== "")))
      throw new AppError(
        "This Sheet already contains tracker data. Initialization does not overwrite existing records. Choose a new blank Sheet.",
        409,
      );
  }
  const missing = Object.keys(TABLES).filter((t) => !names.has(t));
  if (missing.length)
    await request(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: missing.map((title) => ({
          addSheet: {
            properties: { title, gridProperties: { frozenRowCount: 1 } },
          },
        })),
      }),
    });
  const keys = {
    Projects: "projects",
    People: "people",
    Assignments: "assignments",
    Collaborators: "collaborators",
    Updates: "updates",
  } as const;
  await request("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: (Object.keys(TABLES) as (keyof typeof TABLES)[]).map((table) => ({
        range: `'${table}'!A1`,
        values: [
          [...TABLES[table]],
          ...seed[keys[table]].map((e) => cells(table, e)),
        ],
      })),
    }),
  });
  return readSheet();
}
