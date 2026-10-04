import { z } from "zod";
import { STAGES, PIPELINES, PRIORITIES, STATUSES } from "./types";

const text = (max: number) => z.string().trim().max(max);
export const reportSchema = z.object({
  assignmentId: text(100).min(1),
  progress: text(4000).min(1, "Describe what you accomplished."),
  blockers: text(2000).default(""), nextPlan: text(2000).default(""), status: z.enum(STATUSES)
}).strict();
export const projectSchema = z.object({
  id: text(50).min(1), name: text(150).min(1), title: text(1000),
  stage: z.enum(STAGES), pipeline: z.enum(PIPELINES), priority: z.enum(PRIORITIES),
  methods: text(2000), journal: text(300), conference: text(300), milestone: text(1000),
  due: z.union([z.literal(""), z.iso.date()]), notes: text(4000)
}).strict();
export const personSchema = z.object({
  id: text(100).min(1), name: text(150).min(1), email: z.union([z.literal(""), z.email()]).transform(e => e.toLowerCase()), affiliation: text(300)
}).strict();
export const assignmentSchema = z.object({
  id: text(100), projectId: text(50).min(1), personId: text(100).min(1), responsibility: text(300).min(1),
  status: z.enum(["Not started", "In progress", "Blocked", "Done"]), due: z.union([z.literal(""), z.iso.date()])
}).strict();
