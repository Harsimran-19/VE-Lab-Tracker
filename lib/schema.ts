import { z } from "zod";
import { STAGES } from "./types";
const text = (max: number) => z.string().trim().max(max);
const id = text(100).min(1);
export const newProjectSchema = z
  .object({
    id: z.uuid(),
    name: text(150).min(1, "Enter a project name."),
    goal: text(1000).min(1, "Describe the project’s goal."),
  })
  .strict();
export const projectChangeSchema = z.discriminatedUnion("action", [
  z
    .object({
      id,
      action: z.literal("goal"),
      name: text(150).min(1),
      goal: text(1000).min(1),
    })
    .strict(),
  z.object({ id, action: z.literal("phase"), phase: z.enum(STAGES) }).strict(),
  z
    .object({
      id,
      action: z.literal("milestone"),
      milestone: text(500).min(1, "Enter the next milestone."),
      due: z.iso.date(),
    })
    .strict(),
  z
    .object({ id, action: z.enum(["complete", "reopen", "clear-milestone"]) })
    .strict(),
]);
export const entrySchema = z
  .object({
    projectId: id,
    weekStart: z.iso.date(),
    progress: text(4000).min(1, "Describe what you accomplished."),
    nextPlan: text(2000).min(1, "Describe your next step."),
    needsHelp: z.boolean(),
    blockers: text(2000),
  })
  .strict()
  .refine((v) => !v.needsHelp || Boolean(v.blockers), {
    message: "Explain what is blocking you.",
    path: ["blockers"],
  });
export const joinSchema = z.object({ projectId: id }).strict();
export const onboardingSchema = z
  .object({
    name: text(150).min(1, "Enter your name."),
    projectIds: z.array(id).max(100),
  })
  .strict();
export const profileSchema = z
  .object({ name: text(150).min(1), reminders: z.boolean() })
  .strict();
export const settingsSchema = z
  .object({
    reportingDay: z.enum(["1", "2", "3", "4", "5", "6", "7"]),
    reportingTime: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a reporting time."),
    timezone: text(100)
      .min(1)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid timezone."),
  })
  .strict();
