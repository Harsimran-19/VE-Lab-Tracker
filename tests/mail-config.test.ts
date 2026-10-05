import test, { mock } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { smtpSettings } from "../lib/mail-config";
import { mailConfiguration, sendMail } from "../lib/mail";
import { fixture, member, now } from "./fixture";
import { workspaceFor } from "../lib/access";

const settings = {
  ZOHO_EMAIL: "sender@example.com",
  ZOHO_PASSWORD: "unit-test-password",
};
test("SMTP configuration fixes the Zoho endpoint and validates only private credentials", () => {
  const actual = smtpSettings(settings)!;
  assert.equal(actual.host, "smtp.zoho.com");
  assert.equal(actual.port, 587);
  assert.equal(actual.secure, false);
  assert.equal(actual.requireTLS, true);
  assert.equal(smtpSettings({ ...settings, ZOHO_EMAIL: "not-an-email" }), null);
  assert.equal(smtpSettings({ ...settings, ZOHO_PASSWORD: "" }), null);
  assert.equal(
    smtpSettings({ GMAIL_USER: "old@gmail.com", GMAIL_APP_PASSWORD: "old" }),
    null,
  );
  assert.equal(
    smtpSettings({
      ...settings,
      SMTP_HOST: "unrelated.example.com",
      SMTP_PORT: "25",
    })?.host,
    "smtp.zoho.com",
  );
  assert.equal(smtpSettings({ ...settings, SMTP_PORT: "25" })?.port, 587);
});
test("port 587 requires STARTTLS and workspace exposes readiness without credentials", async () => {
  const saved = Object.fromEntries(
    Object.keys(settings).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, settings);
  let closed = false;
  const transport = nodemailer.createTransport({ jsonTransport: true });
  mock.method(
    nodemailer,
    "createTransport",
    (options: SMTPTransport.Options) => {
      assert.equal(options.host, "smtp.zoho.com");
      assert.equal(options.port, 587);
      assert.equal(options.secure, false);
      assert.equal(options.requireTLS, true);
      assert.equal(options.ignoreTLS, undefined);
      assert.equal(options.tls?.rejectUnauthorized, undefined);
      return transport;
    },
  );
  mock.method(transport, "sendMail", async () => ({
    accepted: [member.email],
    messageId: "accepted-id",
  }));
  mock.method(transport, "close", () => {
    closed = true;
  });
  try {
    assert.equal(mailConfiguration().port, 587);
    const data = workspaceFor(fixture(), member, false, now);
    assert.equal(data.emailReady, true);
    assert.equal(JSON.stringify(data).includes(settings.ZOHO_PASSWORD), false);
    assert.equal(JSON.stringify(data).includes("smtp.zoho.com"), false);
    assert.equal(workspaceFor(fixture(), member, true, now).emailReady, false);
    assert.equal(
      await sendMail({
        to: member.email,
        subject: "Test",
        text: "Test",
        id: "test",
      }),
      "accepted-id",
    );
    assert.equal(closed, true);
    delete process.env.ZOHO_PASSWORD;
    assert.equal(workspaceFor(fixture(), member, false, now).emailReady, false);
    assert.throws(mailConfiguration);
  } finally {
    mock.restoreAll();
    for (const [k, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[k];
      else process.env[k] = value;
    }
  }
});
