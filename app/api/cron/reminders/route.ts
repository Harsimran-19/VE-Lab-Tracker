import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { AppError } from "@/lib/access";
import { adminEmails, isDemo } from "@/lib/config";
import { readStore, addReminder, saveReminder } from "@/lib/store";
import {
  requireCron,
  emailConfiguration,
  deliverReminders,
  sendReminder,
} from "@/lib/reminders";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    requireCron(request);
    if (isDemo())
      throw new AppError(
        "Email sending is disabled in the sample workspace.",
        409,
      );
    emailConfiguration();
    const store = await readStore();
    const result = await deliverReminders(
      store,
      {
        reserve: addReminder,
        confirm: saveReminder,
        send: sendReminder,
      },
      new Date(),
      adminEmails(),
    );
    return NextResponse.json(result, { status: result.failed ? 503 : 200 });
  } catch (e) {
    return apiError(e);
  }
}
