import type { Update } from "./types";
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
export function shortDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value));
}
export function reportDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}
export function latestReports(updates: Update[]) {
  return [...updates]
    .sort(
      (a, b) =>
        b.weekStart.localeCompare(a.weekStart) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )
    .filter(
      (u, i, rows) =>
        rows.findIndex(
          (r) => r.projectId === u.projectId && r.personId === u.personId,
        ) === i,
    );
}
