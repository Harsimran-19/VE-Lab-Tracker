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
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function localDateTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (s: string) => parts.find((p) => p.type === s)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function reportingDeadline(
  settings: import("./types").Settings,
  now = new Date(),
) {
  const date = addDays(
    startOfWeek(dateInZone(now, settings.timezone)),
    Number(settings.reportingDay) - 1,
  );
  return {
    date,
    time: settings.reportingTime,
    passed:
      localDateTime(now, settings.timezone) >=
      `${date}T${settings.reportingTime}`,
  };
}
export function expectedThisWeek(
  membership: import("./types").Membership,
  store: Pick<import("./types").Store, "updates" | "settings">,
  now = new Date(),
) {
  const due = reportingDeadline(store.settings, now);
  const week = startOfWeek(dateInZone(now, store.settings.timezone));
  return (
    localDateTime(new Date(membership.joinedAt), store.settings.timezone) <=
      `${due.date}T${due.time}` ||
    store.updates.some(
      (u) =>
        u.personId === membership.personId &&
        u.projectId === membership.projectId &&
        u.weekStart === week,
    )
  );
}
