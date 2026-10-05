import { z } from "zod";
import {
  STAGES,
  PRIORITIES,
  PUBLICATION_STATUSES,
  WORKSTREAM_STATUSES,
} from "./types";
const text = (max: number) => z.string().trim().max(max);
const id = text(100).min(1);
export const resourceLinkSchema = z
  .object({
    label: text(150).min(1, "Name this link."),
    url: text(2000)
      .pipe(z.url())
      .refine(
        (v) => ["https:", "http:"].includes(new URL(v).protocol),
        "Use an http or https link.",
      ),
  })
  .strict();
export const workstreamRecordSchema = z
  .object({
    id: z.uuid(),
    name: text(150).min(1, "Name this responsibility."),
    ownerId: id,
    status: z.enum(WORKSTREAM_STATUSES),
    due: z.union([z.literal(""), z.iso.date()]),
    notes: text(2000),
    archived: z.boolean().optional(),
  })
  .strict();
export const collaboratorRecordSchema = z
  .object({
    id: z.uuid(),
    name: text(150).min(1),
    affiliation: text(300),
    role: text(150),
    email: z.union([z.literal(""), text(300).pipe(z.email())]),
    contactVia: text(300),
    notes: text(2000),
  })
  .strict();
export const reportWorkstreamsSchema = z
  .array(z.object({ id: z.uuid(), name: text(150).min(1) }).strict())
  .max(50);
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
    .object({
      id,
      action: z.enum(["complete", "reopen", "pause", "clear-milestone"]),
    })
    .strict(),
  z
    .object({
      id,
      action: z.literal("details"),
      fullTitle: text(500),
      leadId: text(100),
      priority: z.union([z.literal(""), z.enum(PRIORITIES)]),
      methods: text(2000),
      notes: text(4000),
      links: z.array(resourceLinkSchema).max(10),
    })
    .strict(),
  z
    .object({
      id,
      action: z.literal("publication"),
      publicationStatus: z.union([z.literal(""), z.enum(PUBLICATION_STATUSES)]),
      targetJournal: text(300),
      altJournal: text(300),
      targetConference: text(300),
    })
    .strict(),
  z
    .object({
      id,
      action: z.literal("collaborator"),
      collaborator: collaboratorRecordSchema,
    })
    .strict(),
  z
    .object({
      id,
      action: z.literal("remove-collaborator"),
      collaboratorId: z.uuid(),
    })
    .strict(),
]);
export const workstreamChangeSchema = z.discriminatedUnion("action", [
  z
    .object({
      projectId: id,
      action: z.literal("save"),
      workstream: workstreamRecordSchema.omit({ archived: true }),
    })
    .strict(),
  z
    .object({
      projectId: id,
      action: z.literal("status"),
      workstreamId: z.uuid(),
      status: z.enum(WORKSTREAM_STATUSES),
    })
    .strict(),
  z
    .object({
      projectId: id,
      action: z.enum(["archive", "restore"]),
      workstreamId: z.uuid(),
    })
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
    workstreamIds: z.array(z.uuid()).max(50).optional(),
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
  .object({
    name: text(150).min(1),
    reminders: z.boolean(),
    academicRole: text(150).optional(),
    affiliation: text(300).optional(),
  })
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
