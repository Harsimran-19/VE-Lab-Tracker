import { z } from "zod";
import {
  STAGES,
  PRIORITIES,
  PUBLICATION_STATUSES,
  WORKSTREAM_STATUSES,
  PROJECT_TYPES,
  APPROVAL_STATES,
  MEETING_STATES,
  OUTPUT_KINDS,
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
export const attributeRecordSchema = z
  .object({
    id: z.uuid(),
    label: text(100).min(1, "Name this attribute."),
    value: text(1000),
    status: z.enum(APPROVAL_STATES),
    proposedBy: text(100),
    proposedAt: text(40),
    reviewedBy: text(100),
    reviewedAt: text(40),
  })
  .strict();
export const reportWorkstreamsSchema = z
  .array(z.object({ id: z.uuid(), name: text(150).min(1) }).strict())
  .max(50);
export const formRequestRecordSchema = z.object({
  id: z.uuid(), personId: id, kind: z.enum(["initiation", "task"]),
  message: text(1000), requestedBy: id, createdAt: z.iso.datetime(),
  completedAt: z.union([z.literal(""), z.iso.datetime()]),
}).strict();
export const invitationSchema = z.object({
  id: z.uuid(), email: text(300).toLowerCase().pipe(z.email()), projectId: text(100),
}).strict();
export const formRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), projectId: id, id: z.uuid(), personIds: z.array(id).min(1).max(100), kind: z.enum(["initiation", "task"]), message: text(1000) }).strict(),
  z.object({ action: z.literal("complete"), projectId: id, id: z.uuid() }).strict(),
]);
const projectSetupFields = {
  name: text(150).min(1, "Enter a project name."),
  goal: text(1000).min(1, "Describe the project’s goal."),
  phase: z.union([z.literal(""), z.enum(STAGES)]),
  leadId: text(100),
  priority: z.union([z.literal(""), z.enum(PRIORITIES)]),
  methods: text(2000),
  milestone: text(500),
  due: z.union([z.literal(""), z.iso.date()]),
  fullTitle: text(500),
  publicationStatus: z.union([z.literal(""), z.enum(PUBLICATION_STATUSES)]),
  targetJournal: text(300),
  altJournal: text(300),
  targetConference: text(300),
};
const milestonePair = (v: { milestone?: string; due?: string }) =>
  Boolean(v.milestone) === Boolean(v.due);
const milestoneMessage = {
  message: "Add both a milestone and its due date, or leave both empty.",
  path: ["milestone"],
};
export const newProjectSchema = z
  .object({ id: z.uuid(), ...projectSetupFields, type: z.enum(PROJECT_TYPES).optional(), memberIds: z.array(id).max(100).optional(), supervisorIds: z.array(id).max(100).optional() })
  .partial({
    phase: true,
    leadId: true,
    priority: true,
    methods: true,
    milestone: true,
    due: true,
    fullTitle: true,
    publicationStatus: true,
    targetJournal: true,
    altJournal: true,
    targetConference: true,
  })
  .strict()
  .refine(milestonePair, milestoneMessage);
export const projectChangeSchema = z.discriminatedUnion("action", [
  z
    .object({ id, action: z.literal("settings"), ...projectSetupFields, phase: text(150) })
    .strict()
    .refine(milestonePair, milestoneMessage),
  z
    .object({
      id,
      action: z.literal("goal"),
      name: text(150).min(1),
      goal: text(1000).min(1),
    })
    .strict(),
  z.object({ id, action: z.literal("phase"), phase: text(150) }).strict(),
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
  z.object({id, action: z.literal("classification"), type: z.union([z.literal(""), z.enum(PROJECT_TYPES)]), folderId: text(100)}).strict(),
  z.object({ id, action: z.literal("review"), decision: z.enum(["approve", "reject"]), note: text(1000) }).strict(),
  z.object({ id, action: z.literal("resubmit") }).strict(),
  z
    .object({
      id,
      action: z.literal("attribute"),
      attribute: z.object({ id: z.uuid(), label: attributeRecordSchema.shape.label, value: text(1000).min(1, "Enter a value.") }).strict(),
    })
    .strict(),
  z.object({ id, action: z.literal("remove-attribute"), attributeId: z.uuid() }).strict(),
  z.object({ id, action: z.literal("attribute-review"), attributeId: z.uuid(), decision: z.enum(["approve", "reject"]) }).strict(),
]);
export const teamChangeSchema = z.discriminatedUnion("action", [
  z.object({ projectId: id, action: z.literal("add"), personId: id, contributor: z.boolean(), supervisor: z.boolean() }).strict(),
  z.object({ projectId: id, action: z.literal("responsibilities"), personId: id, contributor: z.boolean(), supervisor: z.boolean() }).strict(),
  z.object({ projectId: id, action: z.literal("lead"), personId: id }).strict(),
  z.object({ projectId: id, action: z.literal("remove"), personId: id, replacementLeadId: text(100) }).strict(),
  z.object({ projectId: id, action: z.literal("reporting"), researcherId: id, supervisorIds: z.array(id).max(100) }).strict(),
]);
export const folderChangeSchema = z.discriminatedUnion("action", [
  z.object({ id: z.uuid(), action: z.literal("save"), name: text(150).min(1, "Name this folder."), description: text(1000) }).strict(),
  z.object({ id, action: z.literal("remove") }).strict(),
]);
export const versionedRequestSchema = z.object({ expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).passthrough();
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
const meeting = z.union([z.literal(""), z.enum(MEETING_STATES)]);
const optionalDate = z.union([z.literal(""), z.iso.date()]);
export const entrySchema = z
  .object({
    projectId: id,
    weekStart: z.iso.date(),
    progress: text(4000).min(1, "Describe what you accomplished."),
    nextPlan: text(2000).min(1, "Describe your next step."),
    needsHelp: z.boolean(),
    blockers: text(2000),
    workstreamIds: z.array(z.uuid()).max(50).optional(),
    hours: z.union([z.literal(""), z.number().min(0, "Hours cannot be negative.").max(168, "A week has at most 168 hours.").multipleOf(0.25, "Use quarter hours.")]).optional(),
    files: z.array(resourceLinkSchema).max(10, "Attach up to 10 reference files.").optional(),
    piMeeting: meeting.optional(),
    piMeetingDate: optionalDate.optional(),
    collaboratorMeeting: meeting.optional(),
    collaboratorMeetingDate: optionalDate.optional(),
    collaboratorNames: text(300).optional(),
    meetingNotes: text(2000).optional(),
  })
  .strict()
  .refine((v) => !v.needsHelp || Boolean(v.blockers), {
    message: "Explain what is blocking you.",
    path: ["blockers"],
  })
  .refine((v) => v.piMeeting === "scheduled" || v.piMeeting === "held" || !v.piMeetingDate, {
    message: "Choose whether the meeting is scheduled or held before adding its date.",
    path: ["piMeetingDate"],
  })
  .refine((v) => v.collaboratorMeeting === "scheduled" || v.collaboratorMeeting === "held" || !(v.collaboratorMeetingDate || v.collaboratorNames), {
    message: "Choose whether the collaborator meeting is scheduled or held before adding its details.",
    path: ["collaboratorMeeting"],
  });
export const versionSchema = z
  .object({
    id: z.uuid(),
    projectId: id,
    outputId: z.uuid(),
    kind: z.enum(OUTPUT_KINDS),
    name: text(150).min(1, "Name this item."),
    url: resourceLinkSchema.shape.url,
    notes: text(2000).min(1, "Describe what changed in this version."),
  })
  .strict();
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
    bio: text(1000).optional(),
    interests: text(500).optional(),
    skills: text(500).optional(),
    profileLinks: z.array(resourceLinkSchema).max(5, "Add up to 5 profile links.").optional(),
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
