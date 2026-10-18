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
  attributeRecordSchema,
} from "./schema";
import type {
  Store,
  Project,
  Person,
  Membership,
  Update,
  Settings,
  Reminder,
  Folder,
  Activity,
  OutputVersion,
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
    "type", "folderId", "version", "updatedAt", "updatedBy", "reporting",
    "approval", "requestedBy", "reviewNote", "attributes",
  ],
  LabMembers: [
    "id",
    "name",
    "email",
    "setupComplete",
    "reminders",
    "academicRole",
    "affiliation",
    "bio",
    "interests",
    "skills",
    "profileLinks",
  ],
  LabMemberships: ["id", "projectId", "personId", "joinedAt", "contributor", "supervisor"],
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
    "version",
    "hours",
    "files",
    "piMeeting",
    "piMeetingDate",
    "collaboratorMeeting",
    "collaboratorMeetingDate",
    "collaboratorNames",
    "meetingNotes",
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
  LabFolders: ["id", "name", "description", "version"],
  LabActivity: ["id", "projectId", "area", "action", "actorId", "actorName", "at", "changes"],
  LabRevision: ["id", "version"],
  // Append-only: each data, paper or code version is a new row.
  LabVersions: ["id", "projectId", "outputId", "kind", "name", "url", "notes", "personId", "createdAt"],
} as const;
// Read and write past column Z: LabProjects has more than 26 columns.
const LAST_COLUMN = "AZ";
export function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}
export type Table = keyof typeof TABLES;
type Entity = Project | Person | Membership | Update | Settings | Reminder | Folder | Activity | OutputVersion | { id: string; version: number };
const legacyLengths: Partial<Record<Table, number[]>> = {
  LabProjects: [7, 19, 25],
  LabMembers: [5, 7],
  LabReports: [10, 11, 12],
  LabMemberships: [4],
};
function legacyHeaders(table: Table, row: string[]) {
  const length = legacyLengths[table];
  return (
    length !== undefined &&
    length.includes(row.length) &&
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
export async function sheetRequest(path: string, init?: RequestInit) {
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
const request = sheetRequest;

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
  for (const table of tables) query.append("ranges", `'${table}'!A:${LAST_COLUMN}`);
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
        version: numericVersion(project.version),
        reporting: decodeList(project.reporting as unknown as string, z.array(z.object({researcherId: z.string().min(1), supervisorId: z.string().min(1)}).strict()).max(10000), "reporting relationships"),
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
        attributes: decodeList(
          project.attributes as unknown as string,
          z.array(attributeRecordSchema).max(30),
          "project attributes",
        ),
      }),
    ),
    people: people.map((person) => ({
      ...person,
      profileLinks: decodeList(
        person.profileLinks as unknown as string,
        z.array(resourceLinkSchema).max(5),
        "profile links",
      ),
    })),
    memberships: toObjects<Membership>(rows[2], TABLES.LabMemberships).map(m => ({ ...m, contributor: String(m.contributor) !== "false", supervisor: String(m.supervisor) === "true" })),
    updates: toObjects<Update>(rows[3], TABLES.LabReports).map((update) => ({
      ...update,
      version: numericVersion(update.version),
      workstreams: decodeList(
        update.workstreams as unknown as string,
        reportWorkstreamsSchema,
        "report responsibilities",
      ),
      files: decodeList(
        update.files as unknown as string,
        z.array(resourceLinkSchema).max(10),
        "report files",
      ),
    })),
    settings:
      toObjects<Settings>(rows[4], TABLES.LabSettings).find(
        (s) => s.id === "lab",
      ) ?? emptyStore().settings,
    reminders: toObjects<Reminder>(rows[5], TABLES.LabDeliveries),
    folders: toObjects<Folder>(rows[6], TABLES.LabFolders).map(f => ({...f, version: numericVersion(f.version)})),
    activities: toObjects<Activity>(rows[7], TABLES.LabActivity).map(a => ({...a, changes: decodeList(a.changes as unknown as string, z.array(z.object({label: z.string(), before: z.string(), after: z.string()}).strict()), "activity")})),
    revision: numericVersion(toObjects<{id: string; version: number}>(rows[8], TABLES.LabRevision).find(r => r.id === "lab")?.version),
    versions: toObjects<OutputVersion>(rows[9], TABLES.LabVersions),
  };
}
export async function ensureTables(checkHeaders = false) {
  const meta = await request("?fields=sheets.properties(title,sheetId,gridProperties.columnCount)");
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
              properties: { title, gridProperties: { frozenRowCount: 1, columnCount: Math.max(26, TABLES[title as Table].length) } },
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
  await ensureColumns(meta);
  for (const table of Object.keys(TABLES) as Table[]) {
    const data = await request(
      `/values/${encodeURIComponent(`'${table}'!A:${LAST_COLUMN}`)}`,
    );
    if (data.values?.some((r: string[]) => r.some((v) => v !== ""))) {
      if (legacyHeaders(table, data.values[0] ?? [])) {
        const start = columnName(data.values[0].length);
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
// New sheets have 26 columns. Widen older tabs before headers or rows pass
// column Z; the locked writer also writes within the existing grid.
async function ensureColumns(meta: { sheets: { properties: { title: string; sheetId?: number; gridProperties?: { columnCount?: number } } }[] }) {
  const requests = meta.sheets.flatMap(({ properties }) => {
    const headers = TABLES[properties.title as Table];
    const count = properties.gridProperties?.columnCount;
    if (!headers || properties.sheetId === undefined || count === undefined || count >= headers.length) return [];
    return [{ appendDimension: { sheetId: properties.sheetId, dimension: "COLUMNS", length: headers.length - count } }];
  });
  if (requests.length) await request(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
}
export function cells(table: Table, entity: Entity) {
  return TABLES[table].map((h) => {
    const value = (entity as unknown as Record<string, unknown>)[h];
    return Array.isArray(value) ? JSON.stringify(value) : String(value ?? "");
  });
}
function numericVersion(value: unknown): number {
  if (value === "" || value === undefined) return 0;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new AppError("Invalid version in the lab spreadsheet.", 409);
  return number;
}
export async function upsertSheet(table: Table, entity: Entity) {
  await ensureTables();
  const data = await request(`/values/${encodeURIComponent(`'${table}'!A:A`)}`);
  const index = (data.values ?? []).findLastIndex(
    (r: string[]) => r[0] === entity.id,
  );
  const last = columnName(TABLES[table].length - 1);
  const path =
    index < 1
      ? `/values/${encodeURIComponent(`'${table}'!A:${last}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
      : `/values/${encodeURIComponent(`'${table}'!A${index + 1}:${last}${index + 1}`)}?valueInputOption=RAW`;
  await request(path, {
    method: index < 1 ? "POST" : "PUT",
    body: JSON.stringify({ values: [cells(table, entity)] }),
  });
}
