import test, { mock } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { mailConfiguration, sendMail } from "../lib/mail";
import { AppError } from "../lib/access";
import { planReminders, deliverReminders, requireCron } from "../lib/reminders";
import {
  dateInZone,
  startOfWeek,
  reportingDeadline,
  expectedThisWeek,
} from "../lib/calendar";
import { planEntry } from "../lib/entries";
import { fixture, now, member, manager } from "./fixture";
import type { Reminder } from "../lib/types";

test("weekly dates and cutoffs use the lab timezone, including UTC boundaries", () => {
  assert.equal(
    dateInZone(new Date("2026-10-04T18:30:00Z"), "Asia/Kolkata"),
    "2026-10-05",
  );
  assert.equal(startOfWeek("2026-10-11"), "2026-10-05");
  const s = fixture();
  assert.deepEqual(
    reportingDeadline(s.settings, new Date("2026-10-09T12:29:00Z")),
    { date: "2026-10-09", time: "18:00", passed: false },
  );
  assert.equal(
    reportingDeadline(s.settings, new Date("2026-10-09T12:30:00Z")).passed,
    true,
  );
});
test("members joining after the cutoff are not marked missing until next week", () => {
  const s = fixture();
  s.memberships[0].joinedAt = "2026-10-09T13:00:00Z";
  assert.equal(
    expectedThisWeek(s.memberships[0], s, new Date("2026-10-10T04:00:00Z")),
    false,
  );
  assert.equal(
    expectedThisWeek(s.memberships[0], s, new Date("2026-10-12T04:00:00Z")),
    true,
  );
});
test("weekly reminders combine only a member’s outstanding updates before the cutoff", () => {
  const s = fixture();
  s.projects[0].due = "";
  assert.equal(planReminders(s, now, [manager.email]).length, 0);
  let items = planReminders(
    s,
    new Date("2026-10-09T04:00:00Z"),
    [manager.email],
    "https://lab.example.com",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].email, member.email);
  assert.equal(items[0].reminder.phase, "weekly-update");
  assert.ok(items[0].text.includes(s.projects[0].name));
  s.updates = [
    planEntry(
      s,
      member,
      {
        projectId: s.projects[0].id,
        weekStart: "2026-10-05",
        progress: "Done interviews",
        nextPlan: "Code notes",
        needsHelp: false,
        blockers: "",
      },
      now,
    ),
  ];
  assert.equal(
    planReminders(s, new Date("2026-10-09T04:00:00Z"), [manager.email]).length,
    0,
  );
});
test("changing the reporting schedule does not resend an accepted weekly email", () => {
  const s = fixture();
  s.projects[0].due = "";
  const friday = new Date("2026-10-09T04:00:00Z");
  const reminder = planReminders(s, friday, [manager.email])[0];
  s.reminders.push({
    ...reminder.reminder,
    sentAt: friday.toISOString(),
    providerId: "accepted",
  });
  s.settings.reportingTime = "19:00";
  s.settings.timezone = "Asia/Hong_Kong";
  assert.equal(planReminders(s, friday, [manager.email]).length, 0);
  const saturday = new Date("2026-10-10T04:00:00Z");
  const summary = planReminders(s, saturday, [manager.email])[0];
  s.reminders.push({
    ...summary.reminder,
    sentAt: saturday.toISOString(),
    providerId: "accepted",
  });
  s.settings.reportingTime = "20:00";
  assert.equal(planReminders(s, saturday, [manager.email]).length, 0);
});
test("manager summary follows the cutoff and includes missing updates and unresolved help", () => {
  const s = fixture();
  s.projects[0].due = "";
  const items = planReminders(s, new Date("2026-10-10T04:00:00Z"), [
    manager.email,
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].email, manager.email);
  assert.equal(items[0].reminder.phase, "weekly-summary");
  assert.ok(items[0].text.includes("missing: Member"));
  s.updates = [
    planEntry(
      s,
      member,
      {
        projectId: s.projects[0].id,
        weekStart: "2026-10-05",
        progress: "Did interviews",
        nextPlan: "Code",
        needsHelp: true,
        blockers: "Need recordings",
      },
      now,
    ),
  ];
  const summary = planReminders(s, new Date("2026-10-10T04:00:00Z"), [
    manager.email,
  ])[0];
  assert.ok(summary.text.includes("1/1 shared"));
  assert.ok(summary.text.includes("Need recordings"));
});
test("Sunday summaries survive Monday cron without counting next week's reports", () => {
  const s = fixture();
  s.settings.reportingDay = "7";
  s.projects[0].due = "";
  const monday = new Date("2026-10-12T04:00:00Z");
  s.updates = [
    planEntry(
      s,
      member,
      {
        projectId: s.projects[0].id,
        weekStart: "2026-10-12",
        progress: "New week started",
        nextPlan: "Continue",
        needsHelp: false,
        blockers: "",
      },
      monday,
    ),
  ];
  const summary = planReminders(s, monday, [manager.email])[0];
  assert.equal(summary.reminder.phase, "weekly-summary");
  assert.equal(summary.reminder.due, "2026-10-11T18:00");
  assert.ok(summary.text.includes("Week of 2026-10-05"));
  assert.ok(summary.text.includes("missing: Member"));
  s.reminders.push({
    ...summary.reminder,
    sentAt: monday.toISOString(),
    providerId: "accepted",
  });
  assert.equal(
    planReminders(s, new Date("2026-10-13T04:00:00Z"), [manager.email]).length,
    0,
  );
});
test("milestone reminders send the day before and on the due date, without overdue spam", () => {
  const s = fixture();
  s.settings.reportingDay = "7";
  const upcoming = planReminders(s, new Date("2026-10-08T04:00:00Z"), []);
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].reminder.phase, "milestone-before");
  assert.equal(
    planReminders(s, new Date("2026-10-09T04:00:00Z"), [])[0].reminder.phase,
    "milestone-due",
  );
  assert.equal(
    planReminders(s, new Date("2026-10-10T04:00:00Z"), []).length,
    0,
  );
});
test("completed projects, opt-outs, invalid emails and already accepted reminders send nothing", () => {
  const s = fixture(),
    date = new Date("2026-10-08T04:00:00Z");
  s.settings.reportingDay = "7";
  const item = planReminders(s, date)[0];
  s.reminders = [
    { ...item.reminder, sentAt: date.toISOString(), providerId: "accepted" },
  ];
  assert.equal(planReminders(s, date).length, 0);
  s.reminders = [];
  s.people[1].reminders = "false";
  assert.equal(planReminders(s, date).length, 0);
  s.people[1].reminders = "true";
  s.people[1].email = "member@demo.invalid";
  assert.equal(planReminders(s, date).length, 0);
  s.people[1].email = member.email;
  s.projects[0].state = "completed";
  assert.equal(planReminders(s, date, [manager.email]).length, 0);
});
test("reservation precedes sending and uncertain acceptance is never automatically retried", async () => {
  const s = fixture();
  s.settings.reportingDay = "7";
  const date = new Date("2026-10-08T04:00:00Z");
  const order: string[] = [];
  const storage = {
    reserve: async (r: Reminder) => {
      order.push("reserve");
      s.reminders.push(r);
    },
    send: async () => {
      order.push("send");
      return "accepted";
    },
    confirm: async () => {
      order.push("confirm");
      throw new Error("Sheet unavailable");
    },
  };
  assert.deepEqual(await deliverReminders(s, storage, date), {
    sent: 0,
    failed: 1,
    needsReview: 0,
  });
  assert.deepEqual(order, ["reserve", "send", "confirm"]);
  assert.deepEqual(await deliverReminders(s, storage, date), {
    sent: 0,
    failed: 0,
    needsReview: 1,
  });
  assert.equal(order.length, 3);
});
test("cron rejects missing, weak or incorrect secrets without sending anything", () => {
  const secret = "unit-test-cron-value-at-least-32-characters";
  assert.throws(
    () => requireCron(new Request("https://lab.example.com"), "short"),
    AppError,
  );
  assert.throws(
    () => requireCron(new Request("https://lab.example.com"), secret),
    AppError,
  );
  requireCron(
    new Request("https://lab.example.com", {
      headers: { Authorization: `Bearer ${secret}` },
    }),
    secret,
  );
});
test("Zoho SMTP uses TLS, preserves credentials and requires recipient acceptance", async () => {
  const names = ["ZOHO_EMAIL", "ZOHO_PASSWORD", "SMTP_HOST", "SMTP_PORT"];
  const saved = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    ZOHO_EMAIL: "sender@example.com",
    ZOHO_PASSWORD: "unit-test pass with spaces",
    SMTP_HOST: "smtppro.zoho.com",
    SMTP_PORT: "465",
  });
  let closed = 0;
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const intercepted = mock.method(
    nodemailer,
    "createTransport",
    (options: SMTPTransport.Options) => {
      assert.equal(options.host, "smtppro.zoho.com");
      assert.equal(options.port, 465);
      assert.equal(options.secure, true);
      assert.equal(options.requireTLS, true);
      assert.deepEqual(options.auth, {
        user: "sender@example.com",
        pass: "unit-test pass with spaces",
      });
      return transport;
    },
  );
  const send = mock.method(
    transport,
    "sendMail",
    async (message: nodemailer.SendMailOptions) => {
      assert.equal(message.to, "member@example.com");
      assert.ok(
        message.from &&
          typeof message.from !== "string" &&
          !Array.isArray(message.from),
      );
      assert.equal(message.from.address, "sender@example.com");
      assert.equal(message.messageId, "<reserved-id@example.com>");
      assert.equal(message.subject, "Safe subject");
      return { accepted: ["member@example.com"], messageId: "accepted-id" };
    },
  );
  mock.method(transport, "close", () => {
    closed++;
  });
  try {
    const message = {
      to: "member@example.com",
      subject: "Safe\nsubject",
      text: "Deadline approaching",
      id: "reserved-id",
    };
    assert.equal(await sendMail(message), "accepted-id");
    send.mock.mockImplementation(async () => ({
      accepted: [],
      messageId: "rejected-id",
    }));
    await assert.rejects(
      sendMail(message),
      (e) => e instanceof AppError && e.status === 503,
    );
    send.mock.mockImplementation(async () => {
      throw new Error("private SMTP credential details");
    });
    await assert.rejects(
      sendMail(message),
      (e) => e instanceof AppError && !e.message.includes("private SMTP"),
    );
    assert.equal(closed, 3);
    delete process.env.ZOHO_PASSWORD;
    assert.throws(mailConfiguration, AppError);
  } finally {
    intercepted.mock.restore();
    mock.restoreAll();
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
