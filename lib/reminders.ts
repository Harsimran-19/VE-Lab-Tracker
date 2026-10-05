import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "./access";
import { mailConfiguration, sendMail } from "./mail";
import {
  dateInZone,
  dayDifference,
  addDays,
  startOfWeek,
  localDateTime,
  reportingDeadline,
  expectedThisWeek,
} from "./calendar";
import { latestReports } from "./format";
import type { Reminder, Store } from "./types";

export function requireCron(
  request: Request,
  secret = process.env.CRON_SECRET,
) {
  if (!secret || secret.length < 32)
    throw new AppError(
      "Configure a CRON_SECRET of at least 32 characters.",
      503,
    );
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new AppError("Unauthorized.", 401);
}
export function emailConfiguration() {
  mailConfiguration();
  if (!process.env.NEXTAUTH_URL)
    throw new AppError("Set the website URL before enabling reminders.", 503);
  const origin = new URL(process.env.NEXTAUTH_URL);
  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production")
    throw new AppError("Use the HTTPS website URL for reminders.", 503);
  return { origin: origin.origin };
}
export interface PlannedEmail {
  reminder: Reminder;
  email: string;
  name: string;
  subject: string;
  text: string;
}
export function planReminders(
  store: Store,
  now = new Date(),
  admins: string[] = [],
  origin = process.env.NEXTAUTH_URL ?? "",
) {
  const { settings } = store,
    today = dateInZone(now, settings.timezone),
    week = startOfWeek(today),
    due = reportingDeadline(settings, now),
    localNow = localDateTime(now, settings.timezone);
  const active = store.projects.filter((p) => p.state === "active"),
    expected = store.memberships.filter(
      (m) =>
        active.some((p) => p.id === m.projectId) &&
        expectedThisWeek(m, store, now),
    );
  const pending = expected.filter(
    (m) =>
      !store.updates.some(
        (u) =>
          u.personId === m.personId &&
          u.projectId === m.projectId &&
          u.weekStart === week,
      ),
  );
  // A Sunday cutoff can be followed by a Monday cron run. Keep the summary
  // tied to the completed reporting week instead of the scheduler's new week.
  const summaryWeek = due.passed ? week : addDays(week, -7);
  const summaryDate = due.passed ? due.date : addDays(due.date, -7);
  const summaryExpected = store.memberships.filter(
    (m) =>
      active.some((p) => p.id === m.projectId) &&
      (localDateTime(new Date(m.joinedAt), settings.timezone) <=
        `${summaryDate}T${due.time}` ||
        store.updates.some(
          (u) =>
            u.personId === m.personId &&
            u.projectId === m.projectId &&
            u.weekStart === summaryWeek,
        )),
  );
  const summaryPending = summaryExpected.filter(
    (m) =>
      !store.updates.some(
        (u) =>
          u.personId === m.personId &&
          u.projectId === m.projectId &&
          u.weekStart === summaryWeek,
      ),
  );
  const help = latestReports(store.updates).filter(
    (u) => u.needsHelp === "true" && active.some((p) => p.id === u.projectId),
  );
  const result: PlannedEmail[] = [];
  for (const person of store.people) {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email) ||
      person.email.endsWith(".invalid") ||
      person.reminders === "false"
    )
      continue;
    function add(
      phase: string,
      target: string,
      dueValue: string,
      subject: string,
      text: string,
      projectId = "",
    ) {
      const id = `reminder-${createHash("sha256")
        .update(
          JSON.stringify([
            person.id,
            person.email.toLowerCase(),
            phase,
            target,
            phase.startsWith("weekly-") ? "" : dueValue,
          ]),
        )
        .digest("hex")}`;
      const existing = store.reminders.find((r) => r.id === id);
      if (existing?.sentAt) return;
      result.push({
        reminder: existing ?? {
          id,
          personId: person.id,
          projectId,
          due: dueValue,
          phase,
          createdAt: now.toISOString(),
          sentAt: "",
          providerId: "",
        },
        email: person.email,
        name: person.name,
        subject: subject.replace(/[\r\n]/g, " ").slice(0, 200),
        text: `Hi ${person.name},\n\n${text}\n\nEmail preferences: ${origin}/account\n\nVenture Engineering Lab`,
      });
    }
    const missing = pending.filter((m) => m.personId === person.id);
    if (
      missing.length &&
      localNow >= `${addDays(due.date, -1)}T${due.time}` &&
      localNow < `${due.date}T${due.time}`
    ) {
      const projects = active.filter((p) =>
        missing.some((m) => m.projectId === p.id),
      );
      add(
        "weekly-update",
        week,
        `${due.date}T${due.time}`,
        "VE Lab · Your weekly updates are due",
        `Please share progress for:\n${projects.map((p) => `- ${p.name}: ${origin}/projects/${encodeURIComponent(p.id)}`).join("\n")}\n\nDue: ${due.date} at ${due.time} (${settings.timezone}).\nIf you need help, say so in your update.`,
      );
    }
    if (
      admins.includes(person.email.toLowerCase()) &&
      active.length &&
      (due.passed || summaryExpected.length > 0)
    ) {
      const lines = active.map((p) => {
        const members = summaryExpected.filter((m) => m.projectId === p.id),
          gaps = summaryPending.filter((m) => m.projectId === p.id);
        return `- ${p.name}: ${members.length - gaps.length}/${members.length} shared${gaps.length ? `; missing: ${gaps.map((m) => store.people.find((p) => p.id === m.personId)?.name ?? "Member").join(", ")}` : ""}`;
      });
      const requests = help.map(
        (u) =>
          `- ${store.people.find((p) => p.id === u.personId)?.name ?? "Member"} · ${active.find((p) => p.id === u.projectId)?.name}: ${u.blockers}`,
      );
      for (const project of active) {
        for (const w of (project.workstreams ?? []).filter(
          (w) => !w.archived && w.status === "Blocked",
        ))
          requests.push(
            `- ${store.people.find((p) => p.id === w.ownerId)?.name ?? "Member"} · ${project.name}: ${w.name} is blocked.`,
          );
      }
      add(
        "weekly-summary",
        summaryWeek,
        `${summaryDate}T${due.time}`,
        "VE Lab · Weekly lab summary",
        `Week of ${summaryWeek}\n\nReporting:\n${lines.join("\n")}\n\nRequests for help:\n${requests.length ? requests.join("\n") : "None reported."}\n\nOpen the lab: ${origin}/`,
      );
    }
    for (const project of active.filter(
      (p) =>
        p.due &&
        store.memberships.some(
          (m) => m.personId === person.id && m.projectId === p.id,
        ),
    )) {
      const days = dayDifference(project.due, today);
      if (days !== 1 && days !== 0) continue;
      add(
        days === 1 ? "milestone-before" : "milestone-due",
        project.id,
        project.due,
        `${days === 0 ? "Due today" : "Due tomorrow"} · ${project.name}`,
        `${project.milestone}\nProject: ${project.name}\nDue: ${project.due}\n\nOpen the project: ${origin}/projects/${encodeURIComponent(project.id)}`,
        project.id,
      );
    }
    for (const project of active) {
      for (const workstream of (project.workstreams ?? []).filter(
        (w) =>
          !w.archived &&
          w.status !== "Done" &&
          w.due &&
          w.ownerId === person.id,
      )) {
        const days = dayDifference(workstream.due, today);
        if (days !== 0 && days !== 1) continue;
        add(
          days === 0 ? "responsibility-due" : "responsibility-before",
          workstream.id,
          workstream.due,
          `${days === 0 ? "Due today" : "Due tomorrow"} · ${workstream.name}`,
          `${workstream.name}\nProject: ${project.name}\nDue: ${workstream.due}\n\nOpen the project: ${origin}/projects/${encodeURIComponent(project.id)}`,
          project.id,
        );
      }
    }
  }
  return result;
}
export async function sendReminder(
  item: ReturnType<typeof planReminders>[number],
) {
  emailConfiguration();
  return sendMail({
    to: item.email,
    id: item.reminder.id,
    subject: item.subject,
    text: item.text,
  });
}
export async function deliverReminders(
  store: Store,
  storage: {
    reserve: (r: Reminder) => Promise<unknown>;
    confirm: (r: Reminder) => Promise<unknown>;
    send: (item: ReturnType<typeof planReminders>[number]) => Promise<string>;
  },
  now = new Date(),
  admins: string[] = [],
) {
  let sent = 0,
    failed = 0,
    needsReview = 0;
  for (const item of planReminders(store, now, admins)) {
    // SMTP has no idempotency guarantee. An existing reservation may already
    // have reached the mail server, so never resend it automatically after an uncertain run.
    if (store.reminders?.some((r) => r.id === item.reminder.id)) {
      needsReview++;
      continue;
    }
    try {
      if (!store.reminders?.some((r) => r.id === item.reminder.id))
        await storage.reserve(item.reminder);
      const providerId = await storage.send(item);
      await storage.confirm({
        ...item.reminder,
        providerId,
        sentAt: now.toISOString(),
      });
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed, needsReview };
}
