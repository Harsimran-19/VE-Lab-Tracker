import "server-only";
import { JWT } from "google-auth-library";
import { AppError } from "./access";
import { emptyStore } from "./types";
import { z } from "zod";
import {
  collaboratorRecordSchema,
  resourceLinkSchema,
  workstreamRecordSchema,
  reportWorkstreamsSchema,
} from "./schema";
import type {
  Store,
  Project,
  Person,
  Membership,
  Update,
  Settings,
  Reminder,
} from "./types";
// Fresh schema: legacy tracker tabs are never read, imported, or overwritten.
export const TABLES = {
  LabProjects: [
    "id",
    "name",
    "goal",
    "phase",
    "milestone",
    "due",
    "state",
    "fullTitle",
    "leadId",
    "priority",
    "methods",
    "publicationStatus",
    "targetJournal",
    "altJournal",
    "targetConference",
    "notes",
    "links",
    "workstreams",
    "collaborators",
  ],
  LabMembers: [
    "id",
    "name",
    "email",
    "setupComplete",
    "reminders",
    "academicRole",
    "affiliation",
  ],
  LabMemberships: ["id", "projectId", "personId", "joinedAt"],
  LabReports: [
    "id",
    "createdAt",
    "updatedAt",
    "weekStart",
    "projectId",
    "personId",
    "progress",
    "nextPlan",
    "needsHelp",
    "blockers",
    "workstreams",
  ],
  LabSettings: ["id", "reportingDay", "reportingTime", "timezone"],
  LabDeliveries: [
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
export type Table = keyof typeof TABLES;
type Entity = Project | Person | Membership | Update | Settings | Reminder;
const legacyLengths: Partial<Record<Table, number>> = {
  LabProjects: 7,
  LabMembers: 5,
  LabReports: 10,
};
function legacyHeaders(table: Table, row: string[]) {
  const length = legacyLengths[table];
  return (
    length !== undefined &&
    row.length === length &&
    row.every((h, i) => TABLES[table][i] === h)
  );
}
function decodeList<T>(
  value: string | undefined,
  schema: z.ZodType<T>,
  field: string,
): T {
  try {
    return schema.parse(value ? JSON.parse(value) : []);
  } catch {
    throw new AppError(
      `Invalid ${field} data in the lab spreadsheet. Restore this field before continuing.`,
      409,
    );
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
  if (headers.some((h, i) => values[0]?.[i] !== h))
    throw new AppError(
      "Lab spreadsheet headers do not match. Restore the headers from lib/sheets.ts; existing records were not changed.",
      409,
    );
  const rows = values.slice(1).filter((r) => r[0]);
  return rows
    .filter((r, i) => rows.findLastIndex((v) => v[0] === r[0]) === i)
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
  const tables = Object.keys(TABLES) as Table[];
  if (!tables.some((t) => names.has(t))) return emptyStore();
  if (!tables.every((t) => names.has(t))) {
    await ensureTables(true);
    return readSheet();
  }
  const query = new URLSearchParams();
  for (const table of tables) query.append("ranges", `'${table}'!A:Z`);
  query.set("valueRenderOption", "UNFORMATTED_VALUE");
  const data = await request(`/values:batchGet?${query}`);
  const rows = data.valueRanges.map(
    (r: { values?: string[][] }) => r.values ?? [],
  );
  if (tables.some((table, i) => legacyHeaders(table, rows[i]?.[0] ?? []))) {
    await ensureTables(true);
    return readSheet();
  }
  if (
    rows.some((r: string[][]) => !r.some((row) => row.some((v) => v !== "")))
  ) {
    await ensureTables(true);
    return readSheet();
  }
  const people = toObjects<Person>(rows[1], TABLES.LabMembers);
  const emails = people.map((p) => p.email.trim().toLowerCase());
  if (emails.some((e) => !e) || new Set(emails).size !== emails.length)
    throw new AppError(
      "LabMembers has conflicting Google accounts. Correct duplicate emails before continuing.",
      409,
    );
  return {
    projects: toObjects<Project>(rows[0], TABLES.LabProjects).map(
      (project) => ({
        ...project,
        links: decodeList(
          project.links as unknown as string,
          z.array(resourceLinkSchema).max(10),
          "project links",
        ),
        workstreams: decodeList(
          project.workstreams as unknown as string,
          z.array(workstreamRecordSchema).max(100),
          "responsibilities",
        ),
        collaborators: decodeList(
          project.collaborators as unknown as string,
          z.array(collaboratorRecordSchema).max(50),
          "collaborators",
        ),
      }),
    ),
    people,
    memberships: toObjects<Membership>(rows[2], TABLES.LabMemberships),
    updates: toObjects<Update>(rows[3], TABLES.LabReports).map((update) => ({
      ...update,
      workstreams: decodeList(
        update.workstreams as unknown as string,
        reportWorkstreamsSchema,
        "report responsibilities",
      ),
    })),
    settings:
      toObjects<Settings>(rows[4], TABLES.LabSettings).find(
        (s) => s.id === "lab",
      ) ?? emptyStore().settings,
    reminders: toObjects<Reminder>(rows[5], TABLES.LabDeliveries),
  };
}
export async function ensureTables(checkHeaders = false) {
  const meta = await request("?fields=sheets.properties.title");
  const names = new Set(
    meta.sheets.map(
      (s: { properties: { title: string } }) => s.properties.title,
    ),
  );
  const missing = Object.keys(TABLES).filter((t) => !names.has(t));
  if (!missing.length && !checkHeaders) return;
  if (missing.length) {
    try {
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
    } catch (e) {
      const latest = await request("?fields=sheets.properties.title");
      if (
        !Object.keys(TABLES).every((t) =>
          latest.sheets.some(
            (s: { properties: { title: string } }) => s.properties.title === t,
          ),
        )
      )
        throw e;
    }
  }
  for (const table of Object.keys(TABLES) as Table[]) {
    const data = await request(
      `/values/${encodeURIComponent(`'${table}'!A:Z`)}`,
    );
    if (data.values?.some((r: string[]) => r.some((v) => v !== ""))) {
      if (legacyHeaders(table, data.values[0] ?? [])) {
        const start = String.fromCharCode(65 + data.values[0].length);
        await request(
          `/values/${encodeURIComponent(`'${table}'!${start}1`)}?valueInputOption=RAW`,
          {
            method: "PUT",
            body: JSON.stringify({
              values: [TABLES[table].slice(data.values[0].length)],
            }),
          },
        );
        continue;
      }
      toObjects(data.values, TABLES[table]);
      continue;
    }
    await request(
      `/values/${encodeURIComponent(`'${table}'!A1`)}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [[...TABLES[table]]] }) },
    );
  }
}
function cells(table: Table, entity: Entity) {
  return TABLES[table].map((h) => {
    const value = (entity as unknown as Record<string, unknown>)[h];
    return Array.isArray(value) ? JSON.stringify(value) : String(value ?? "");
  });
}
export async function upsertSheet(table: Table, entity: Entity) {
  await ensureTables();
  const data = await request(`/values/${encodeURIComponent(`'${table}'!A:A`)}`);
  const index = (data.values ?? []).findLastIndex(
    (r: string[]) => r[0] === entity.id,
  );
  const path =
    index < 1
      ? `/values/${encodeURIComponent(`'${table}'!A:Z`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
      : `/values/${encodeURIComponent(`'${table}'!A${index + 1}:Z${index + 1}`)}?valueInputOption=RAW`;
  await request(path, {
    method: index < 1 ? "POST" : "PUT",
    body: JSON.stringify({ values: [cells(table, entity)] }),
  });
}
