import type { Update } from "./types";
export function shortDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function initials(name: string) { return name.split(/\s+/).map(n => n[0]).slice(0, 2).join("").toUpperCase(); }
export function latestByAssignment(updates: Update[]) {
  const sorted = [...updates].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Set<string>();
  return sorted.filter(u => { if (seen.has(u.assignmentId)) return false; seen.add(u.assignmentId); return true; });
}
