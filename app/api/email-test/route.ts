import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizedContext } from "@/lib/auth";
import { AppError, requireAdmin, requireSameOrigin } from "@/lib/access";
import { apiError, readJson } from "@/lib/api";
import { z } from "zod";
import { isDemo } from "@/lib/config";
import { mailConfiguration, sendMail } from "@/lib/mail";
import { addReminder, saveReminder } from "@/lib/store";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { identity, store } = await authorizedContext();
    requireAdmin(identity);
    z.object({})
      .strict()
      .parse(await readJson(request));
    if (isDemo())
      return NextResponse.json({
        simulated: true,
        message: "Sample preview only. No email was sent.",
      });
    mailConfiguration();
    const now = new Date();
    if (
      store.reminders?.some(
        (r) =>
          r.personId === identity.personId &&
          r.phase === "test" &&
          now.getTime() - Date.parse(r.createdAt) < 60000,
      )
    )
      throw new AppError(
        "Wait one minute before sending another test email.",
        429,
      );
    const reminder = {
      id: `test-${randomUUID()}`,
      personId: identity.personId,
      projectId: "",
      due: "",
      phase: "test",
      createdAt: now.toISOString(),
      sentAt: "",
      providerId: "",
    };
    await addReminder(reminder);
    const providerId = await sendMail({
      to: identity.email,
      id: reminder.id,
      subject: "VE Lab · Email test",
      text: `Hi ${identity.name},\n\nYour lab can send weekly update reminders, milestone reminders and manager summaries through Zoho SMTP. No purchased domain is needed.\n\nVenture Engineering Lab`,
    });
    await saveReminder({
      ...reminder,
      providerId,
      sentAt: new Date().toISOString(),
    });
    return NextResponse.json({
      message: `The mail server accepted the test email to ${identity.email}. Check your inbox and spam folder.`,
    });
  } catch (e) {
    return apiError(e);
  }
}
