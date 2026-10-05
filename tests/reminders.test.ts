import test, { mock } from "node:test";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { gmailConfiguration, sendGmail } from "../lib/mail";
import assert from "node:assert/strict";
import {
  deliverReminders,
  planReminders,
  reminderMessage,
  requireCron,
} from "../lib/reminders";
import { dateInZone, reportedThisWeek, startOfWeek } from "../lib/calendar";
import { profileSchema } from "../lib/schema";
import { membershipId } from "../lib/membership";
import { AppError } from "../lib/access";
import seed from "../lib/seed.json";
import type { Store, Reminder } from "../lib/types";
const now = new Date("2026-10-05T04:00:00Z");
function fixture(): Store {
  const store = structuredClone(seed) as Store;
  store.people.find((p) => p.id === "hars")!.email = "member@example.com";
  store.projects.find((p) => p.id === "P10")!.due = "2026-10-08";
  store.projects.find((p) => p.id === "P10")!.milestone =
    "Finish pilot analysis";
  store.reminders = [];
  store.profiles = [];
  return store;
}
test("weekly reporting follows the configured local week at UTC boundaries", () => {
  assert.equal(dateInZone(new Date("2026-10-04T19:00:00Z")), "2026-10-05");
  assert.equal(startOfWeek("2026-10-05"), "2026-10-05");
  assert.equal(startOfWeek("2026-10-11"), "2026-10-05");
  assert.equal(
    reportedThisWeek("2026-10-04T18:29:59Z", "2026-10-05", "Asia/Kolkata"),
    false,
  );
  assert.equal(
    reportedThisWeek("2026-10-04T18:30:00Z", "2026-10-05", "Asia/Kolkata"),
    true,
  );
  assert.equal(
    reportedThisWeek("2026-10-12T00:00:00Z", "2026-10-05", "Asia/Kolkata"),
    false,
  );
});
test("reminders reach project members for upcoming, due and overdue deadlines", () => {
  const store = fixture();
  const items = planReminders(store, now);
  assert.equal(items.length, 1);
  assert.equal(items[0].email, "member@example.com");
  assert.equal(items[0].reminder.phase, "upcoming");
  assert.equal(
    planReminders(store, new Date("2026-10-08T04:00:00Z"))[0].reminder.phase,
    "due",
  );
  assert.equal(
    planReminders(store, new Date("2026-10-09T04:00:00Z"))[0].reminder.phase,
    "overdue",
  );
  assert.equal(
    planReminders(store, new Date("2026-10-16T04:00:00Z")).length,
    0,
  );
  const message = reminderMessage(items[0], "https://lab.example.com");
  assert.ok(message.text.includes("Finish pilot analysis"));
  assert.ok(message.text.includes("https://lab.example.com/projects/P10"));
  assert.ok(message.text.includes("/profile"));
});
test("preferences, completed work, sample addresses and sent phases suppress emails", () => {
  const store = fixture();
  const item = planReminders(store, now)[0];
  store.reminders = [
    { ...item.reminder, sentAt: now.toISOString(), providerId: "email-1" },
  ];
  assert.equal(planReminders(store, now).length, 0);
  // The same upcoming phase is not repeated the next day.
  assert.equal(
    planReminders(store, new Date("2026-10-06T04:00:00Z")).length,
    0,
  );
  store.reminders = [];
  store.profiles = [
    {
      id: "hars",
      position: "PhD",
      expertise: "LLMs",
      bio: "",
      reminders: "false",
    },
  ];
  assert.equal(planReminders(store, now).length, 0);
  store.profiles = [];
  store.assignments.find((a) => a.id === "A016")!.status = "Done";
  assert.equal(planReminders(store, now).length, 0);
  store.assignments.find((a) => a.id === "A016")!.status = "In progress";
  store.people.find((p) => p.id === "hars")!.email = "sample@demo.invalid";
  assert.equal(planReminders(store, now).length, 0);
});
test("responsibility deadlines and changed project due dates have distinct delivery IDs", () => {
  const store = fixture();
  const oldId = planReminders(store, now)[0].reminder.id;
  store.assignments.find((a) => a.id === "A016")!.due = "2026-10-07";
  assert.equal(planReminders(store, now).length, 2);
  store.projects.find((p) => p.id === "P10")!.due = "2026-10-07";
  assert.notEqual(planReminders(store, now)[0].reminder.id, oldId);
});
test("cron requires a strong secret and rejects missing or incorrect bearer headers", () => {
  const secret = "private-cron-test-value-32-characters-minimum";
  assert.throws(
    () =>
      requireCron(
        new Request("https://lab.example.com/api/cron/reminders"),
        secret,
      ),
    (e: unknown) => e instanceof AppError && e.status === 401,
  );
  assert.throws(
    () =>
      requireCron(
        new Request("https://lab.example.com", {
          headers: { authorization: "Bearer wrong" },
        }),
        secret,
      ),
    AppError,
  );
  assert.throws(
    () => requireCron(new Request("https://lab.example.com"), "short"),
    (e: unknown) => e instanceof AppError && e.status === 503,
  );
  requireCron(
    new Request("https://lab.example.com", {
      headers: { authorization: `Bearer ${secret}` },
    }),
    secret,
  );
});
test("delivery reserves before sending and holds uncertain Gmail acceptance without resending", async () => {
  const store = fixture();
  const order: string[] = [];
  const keys: string[] = [];
  let failConfirm = true;
  const storage = {
    reserve: async (r: Reminder) => {
      order.push("reserve");
      store.reminders!.push(r);
    },
    send: async (item: ReturnType<typeof planReminders>[number]) => {
      order.push("send");
      keys.push(item.reminder.id);
      return "email-accepted";
    },
    confirm: async (r: Reminder) => {
      order.push("confirm");
      if (failConfirm) throw new Error("Sheet temporarily unavailable");
      store.reminders = [r];
    },
  };
  assert.deepEqual(await deliverReminders(store, storage, now), {
    sent: 0,
    failed: 1,
    needsReview: 0,
  });
  assert.deepEqual(order, ["reserve", "send", "confirm"]);
  failConfirm = false;
  assert.deepEqual(await deliverReminders(store, storage, now), {
    sent: 0,
    failed: 0,
    needsReview: 1,
  });
  assert.equal(keys.length, 1);
  assert.equal(store.reminders!.length, 1);
  store.reminders![0].sentAt = now.toISOString();
  assert.deepEqual(await deliverReminders(store, storage, now), {
    sent: 0,
    failed: 0,
    needsReview: 0,
  });
});
test("uncertain deliveries are held even within the first day because SMTP has no idempotency", async () => {
  const store = fixture();
  store.reminders = [planReminders(store, now)[0].reminder];
  const never = async () => {
    throw new Error("Must not send an uncertain duplicate");
  };
  assert.deepEqual(
    await deliverReminders(
      store,
      { reserve: never, confirm: never, send: never },
      new Date("2026-10-06T04:00:00Z"),
    ),
    { sent: 0, failed: 0, needsReview: 1 },
  );
});
test("profile updates cannot spoof identity, email or access role", () => {
  const valid = {
    name: "Lab member",
    affiliation: "Lab",
    position: "PhD",
    expertise: "LLMs, statistics",
    bio: "Research",
    reminders: false,
  };
  assert.equal(profileSchema.safeParse(valid).success, true);
  for (const field of ["id", "email", "role"])
    assert.equal(
      profileSchema.safeParse({ ...valid, [field]: "admin" }).success,
      false,
    );
  assert.equal(
    profileSchema.safeParse({ ...valid, position: "Invented" }).success,
    false,
  );
  assert.equal(
    membershipId("person-a", "P01"),
    membershipId("person-a", "P01"),
  );
  assert.notEqual(
    membershipId("person-a", "P01"),
    membershipId("person-b", "P01"),
  );
});
test("Gmail transport uses TLS and app-password auth and requires recipient acceptance", async () => {
  const names = ["GMAIL_USER", "GMAIL_APP_PASSWORD"];
  const saved = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    GMAIL_USER: "sender@gmail.com",
    GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  });
  let closed = 0;
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const intercepted = mock.method(
    nodemailer,
    "createTransport",
    (options: SMTPTransport.Options) => {
      assert.equal(options.host, "smtp.gmail.com");
      assert.equal(options.port, 465);
      assert.equal(options.secure, true);
      assert.deepEqual(options.auth, {
        user: "sender@gmail.com",
        pass: "abcdefghijklmnop",
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
      assert.equal(message.from.address, "sender@gmail.com");
      assert.equal(message.messageId, "<reserved-id@gmail.com>");
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
    assert.equal(await sendGmail(message), "accepted-id");
    send.mock.mockImplementation(async () => ({
      accepted: [],
      messageId: "rejected-id",
    }));
    await assert.rejects(
      sendGmail(message),
      (e) => e instanceof AppError && e.status === 503,
    );
    send.mock.mockImplementation(async () => {
      throw new Error("private SMTP credential details");
    });
    await assert.rejects(
      sendGmail(message),
      (e) => e instanceof AppError && !e.message.includes("private SMTP"),
    );
    assert.equal(closed, 3);
    delete process.env.GMAIL_APP_PASSWORD;
    assert.throws(gmailConfiguration, AppError);
  } finally {
    intercepted.mock.restore();
    mock.restoreAll();
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
