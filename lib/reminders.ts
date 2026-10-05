import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "./access";
import { dateInZone, dayDifference } from "./calendar";
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
  const missing = [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "CRON_SECRET",
    "NEXTAUTH_URL",
  ].filter((k) => !process.env[k]?.trim());
  if (missing.length)
    throw new AppError(
      `Configure ${missing.join(", ")} to enable deadline emails.`,
      503,
    );
  const origin = new URL(process.env.NEXTAUTH_URL!);
  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production")
    throw new AppError(
      "Use the HTTPS deployment URL for deadline emails.",
      503,
    );
  return {
    key: process.env.RESEND_API_KEY!,
    from: process.env.EMAIL_FROM!,
    origin: origin.origin,
  };
}
export function planReminders(
  store: Store,
  now = new Date(),
  timezone = "Asia/Kolkata",
) {
  const today = dateInZone(now, timezone);
  const planned: {
    reminder: Reminder;
    email: string;
    name: string;
    project: string;
    milestone: string;
  }[] = [];
  for (const person of store.people) {
    if (
      !person.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email) ||
      person.email.endsWith(".invalid") ||
      store.profiles?.find((p) => p.id === person.id)?.reminders === "false"
    )
      continue;
    const own = store.assignments.filter(
      (a) => a.personId === person.id && a.status !== "Done",
    );
    const projectIds = new Set(own.map((a) => a.projectId));
    const targets = [
      ...store.projects
        .filter(
          (p) => projectIds.has(p.id) && p.due && p.pipeline !== "Accepted",
        )
        .map((p) => ({
          id: `project:${p.id}`,
          projectId: p.id,
          due: p.due,
          title: p.milestone || "Project milestone",
        })),
      ...own
        .filter((a) => a.due)
        .map((a) => ({
          id: `assignment:${a.id}`,
          projectId: a.projectId,
          due: a.due,
          title: a.responsibility,
        })),
    ];
    for (const target of targets) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(target.due)) continue;
      const days = dayDifference(target.due, today);
      // One reminder while approaching, one on the due date, one after it.
      // A daily scheduler can recover a missed run inside either window.
      const phase =
        days > 0 && days <= 3
          ? "upcoming"
          : days === 0
            ? "due"
            : days < 0 && days >= -7
              ? "overdue"
              : "";
      if (!phase) continue;
      const id = `reminder-${createHash("sha256")
        .update(
          JSON.stringify([
            person.id,
            person.email.toLowerCase(),
            target.id,
            target.due,
            phase,
          ]),
        )
        .digest("hex")}`;
      const existing = store.reminders?.find((r) => r.id === id);
      if (existing?.sentAt) continue;
      const reminder = existing ?? {
        id,
        personId: person.id,
        projectId: target.projectId,
        due: target.due,
        phase,
        createdAt: now.toISOString(),
        sentAt: "",
        providerId: "",
      };
      planned.push({
        reminder,
        email: person.email,
        name: person.name,
        project:
          store.projects.find((p) => p.id === target.projectId)?.name ??
          "Lab project",
        milestone: target.title,
      });
    }
  }
  return planned.filter(
    (p, i, rows) =>
      rows.findIndex((r) => r.reminder.id === p.reminder.id) === i,
  );
}
export function reminderMessage(
  item: ReturnType<typeof planReminders>[number],
  origin: string,
) {
  const title =
    item.reminder.phase === "overdue"
      ? "Deadline passed"
      : item.reminder.phase === "due"
        ? "Due today"
        : "Deadline approaching";
  const text = `Hi ${item.name},\n\n${title}: ${item.milestone}\nProject: ${item.project}\nDue: ${item.reminder.due}\n\nOpen the project to share progress or ask for help:\n${origin}/projects/${encodeURIComponent(item.reminder.projectId)}\n\nManage deadline emails in My profile:\n${origin}/profile\n\nVenture Engineering Lab`;
  return {
    subject: `${title} · ${item.project}`.replace(/[\r\n]/g, " ").slice(0, 200),
    text,
  };
}
export async function sendReminder(
  item: ReturnType<typeof planReminders>[number],
) {
  const config = emailConfiguration();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": item.reminder.id,
    },
    body: JSON.stringify({
      from: config.from,
      to: [item.email],
      ...reminderMessage(item, config.origin),
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new AppError(
      "Email delivery failed. Check the verified sender, Resend API key and sending limits.",
      503,
    );
  const body = await response.json();
  if (typeof body.id !== "string" || !body.id)
    throw new AppError(
      "The email provider did not confirm delivery acceptance.",
      503,
    );
  return body.id as string;
}
export async function deliverReminders(
  store: Store,
  storage: {
    reserve: (r: Reminder) => Promise<unknown>;
    confirm: (r: Reminder) => Promise<unknown>;
    send: (item: ReturnType<typeof planReminders>[number]) => Promise<string>;
  },
  now = new Date(),
  timezone = "Asia/Kolkata",
) {
  let sent = 0,
    failed = 0,
    needsReview = 0;
  for (const item of planReminders(store, now, timezone)) {
    // Resend guarantees idempotency for 24h. Hold older uncertain deliveries
    // for review instead of risking another email after that protection ends.
    if (
      !item.reminder.sentAt &&
      now.getTime() - Date.parse(item.reminder.createdAt) >= 23 * 3600000
    ) {
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
