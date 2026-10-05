import { z } from "zod";
import { STAGES, PIPELINES, PRIORITIES, STATUSES, POSITIONS } from "./types";

const text = (max: number) => z.string().trim().max(max);
export const reportSchema = z
  .object({
    assignmentId: text(100).min(1),
    progress: text(4000).min(1, "Describe what you accomplished."),
    blockers: text(2000).default(""),
    nextPlan: text(2000).default(""),
    status: z.enum(STATUSES),
  })
  .strict();
export const projectSchema = z
  .object({
    id: text(50).min(1),
    name: text(150).min(1),
    title: text(1000),
    stage: z.enum(STAGES),
    pipeline: z.enum(PIPELINES),
    priority: z.enum(PRIORITIES),
    methods: text(2000),
    journal: text(300),
    conference: text(300),
    milestone: text(1000),
    due: z.union([z.literal(""), z.iso.date()]),
    notes: text(4000),
  })
  .strict();
export const personSchema = z
  .object({
    id: text(100).min(1),
    name: text(150).min(1),
    email: z
      .union([z.literal(""), z.string().trim().pipe(z.email())])
      .transform((e) => e.toLowerCase()),
    affiliation: text(300),
    role: z.enum(["admin", "member"]).optional(),
  })
  .strict();
export const newPersonSchema = z
  .object({
    name: text(150).min(1, "Enter the member’s name."),
    email: z
      .string()
      .trim()
      .pipe(z.email())
      .transform((e) => e.toLowerCase()),
    affiliation: text(300).default(""),
    role: z.enum(["admin", "member"]).default("member"),
  })
  .strict();
export const assignmentSchema = z
  .object({
    id: text(100),
    projectId: text(50).min(1),
    personId: text(100).min(1),
    responsibility: text(300).min(1),
    status: z.enum(["Not started", "In progress", "Blocked", "Done"]),
    due: z.union([z.literal(""), z.iso.date()]),
  })
  .strict();
export const profileSchema = z
  .object({
    name: text(150).min(1),
    affiliation: text(300),
    position: z.union([z.literal(""), z.enum(POSITIONS)]),
    expertise: text(1000),
    bio: text(2000),
    reminders: z.boolean(),
  })
  .strict();
export const joinSchema = z.object({ projectId: text(50).min(1) }).strict();

export const entrySchema = z
  .object({
    entryId: z.uuid(),
    projectId: text(50).default(""),
    newProjectName: text(150).default(""),
    assignmentId: text(100).default(""),
    progress: text(4000).min(1, "Describe your progress."),
    blockers: text(2000).default(""),
    nextPlan: text(2000).default(""),
    status: z.enum(STATUSES),
  })
  .strict()
  .refine(
    (value) => Boolean(value.projectId) !== Boolean(value.newProjectName),
    {
      message: "Choose a project or enter a new project name.",
      path: ["projectId"],
    },
  );

export const onboardingSchema = z
  .object({
    name: text(150).min(1, "Enter your name."),
    position: z.union([z.literal(""), z.enum(POSITIONS)]),
    expertise: text(1000),
    rosterId: text(100),
    projectIds: z.array(text(50).min(1)).max(30),
  })
  .strict();
export const rosterLinkSchema = z
  .object({ id: text(100).min(1), approve: z.boolean() })
  .strict();
