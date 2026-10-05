export function dateInZone(date: Date, timezone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function dayDifference(due: string, today: string) {
  return Math.round(
    (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
}
export function startOfWeek(today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export function reportedThisWeek(
  createdAt: string,
  weekStart: string,
  timezone: string,
) {
  const day = dateInZone(new Date(createdAt), timezone);
  const offset = dayDifference(day, weekStart);
  return offset >= 0 && offset < 7;
}
