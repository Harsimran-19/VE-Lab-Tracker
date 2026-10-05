import "server-only";
import nodemailer from "nodemailer";
import { AppError } from "./access";
import { smtpSettings } from "./mail-config";

export function mailConfiguration() {
  const settings = smtpSettings();
  if (!settings)
    throw new AppError(
      "Email is not configured. Set ZOHO_EMAIL and ZOHO_PASSWORD in private environment settings.",
      503,
    );
  return settings;
}
export async function sendMail(
  message: { to: string; subject: string; text: string; id: string },
  transportFactory = nodemailer.createTransport,
) {
  const { host, port, secure, requireTLS, user, password } =
    mailConfiguration();
  const transport = transportFactory({
    host,
    port,
    secure,
    requireTLS,
    auth: { user, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "Venture Engineering Lab", address: user },
      to: message.to,
      subject: message.subject.replace(/[\r\n]/g, " ").slice(0, 200),
      text: message.text,
      messageId: `<${message.id}@${user.split("@")[1]}>`,
    });
    if (
      !result.accepted?.some(
        (recipient: unknown) =>
          String(recipient).toLowerCase() === message.to.toLowerCase(),
      )
    )
      throw new Error("Not accepted");
    return result.messageId as string;
  } catch {
    throw new AppError(
      "The mail server did not confirm sending. Check Zoho SMTP access and the credentials in private environment settings.",
      503,
    );
  } finally {
    transport.close();
  }
}
