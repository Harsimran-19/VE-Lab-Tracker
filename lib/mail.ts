import "server-only";
import nodemailer from "nodemailer";
import { AppError } from "./access";

export function gmailConfiguration() {
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user))
    throw new AppError(
      "Gmail sending is not set up yet. Follow the Gmail section in the setup guide.",
      503,
    );
  return { user, password };
}
export async function sendGmail(
  message: { to: string; subject: string; text: string; id: string },
  transportFactory = nodemailer.createTransport,
) {
  const { user, password } = gmailConfiguration();
  const transport = transportFactory({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
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
      "Gmail did not confirm the email. Check the sender address and Google app password. A regular Google password will not work.",
      503,
    );
  } finally {
    transport.close();
  }
}
