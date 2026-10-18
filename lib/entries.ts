import { createHash } from "node:crypto";
import { AppError, isApproved } from "./access";
import { dateInZone, startOfWeek } from "./calendar";
import type { Identity, Store, Update } from "./types";
import { entrySchema } from "./schema";
export function reportId(
  personId: string,
  projectId: string,
  weekStart: string,
) {
  return `week-${createHash("sha256")
    .update(JSON.stringify([personId, projectId, weekStart]))
    .digest("hex")
    .slice(0, 40)}`;
}
export function planEntry(
  store: Store,
  identity: Identity,
  raw: unknown,
  now = new Date(),
): Update {
  const input = entrySchema.parse(raw);
  const project = store.projects.find((p) => p.id === input.projectId);
  if (!project) throw new AppError("Project not found.", 404);
  if (project.state !== "active")
    throw new AppError(
      "This project is not active. Weekly reporting has stopped.",
      409,
    );
  if (!isApproved(project))
    throw new AppError(
      "Weekly reporting starts once this project is approved.",
      409,
    );
  if (
    !store.memberships.some(
      (m) => m.projectId === project.id && m.personId === identity.personId,
    )
  )
    throw new AppError(
      "Join this project before reporting your own progress.",
      403,
    );
  const weekStart = startOfWeek(dateInZone(now, store.settings.timezone));
  if (input.weekStart !== weekStart)
    throw new AppError(
      "A new reporting week has started. Reopen the update form.",
      409,
    );
  const id = reportId(identity.personId, project.id, weekStart),
    existing = store.updates.find((u) => u.id === id);
  if (existing && existing.personId !== identity.personId)
    throw new AppError("This report belongs to another member.", 403);
  const selections =
    input.workstreamIds === undefined
      ? existing?.workstreams
      : [...new Set(input.workstreamIds)].map((streamId) => {
          const stream = project.workstreams?.find((w) => w.id === streamId);
          const previous = existing?.workstreams?.find(
            (w) => w.id === streamId,
          );
          // Retain a historical selection after an assignment is archived or reassigned.
          if (
            previous &&
            (!stream || stream.archived || stream.ownerId !== identity.personId)
          )
            return previous;
          if (
            !stream ||
            stream.archived ||
            stream.ownerId !== identity.personId
          )
            throw new AppError(
              "Choose one of your responsibilities in this project.",
              403,
            );
          return { id: stream.id, name: stream.name };
        });
  const piMeeting = input.piMeeting ?? existing?.piMeeting ?? "",
    collaboratorMeeting = input.collaboratorMeeting ?? existing?.collaboratorMeeting ?? "";
  const values = {
    progress: input.progress,
    nextPlan: input.nextPlan,
    needsHelp: String(input.needsHelp),
    blockers: input.needsHelp ? input.blockers : "",
    hours: input.hours === undefined ? existing?.hours ?? "" : String(input.hours),
    piMeeting,
    piMeetingDate: piMeeting === "scheduled" || piMeeting === "held" ? input.piMeetingDate ?? existing?.piMeetingDate ?? "" : "",
    collaboratorMeeting,
    collaboratorMeetingDate: collaboratorMeeting === "scheduled" || collaboratorMeeting === "held" ? input.collaboratorMeetingDate ?? existing?.collaboratorMeetingDate ?? "" : "",
    collaboratorNames: collaboratorMeeting === "scheduled" || collaboratorMeeting === "held" ? input.collaboratorNames ?? existing?.collaboratorNames ?? "" : "",
    meetingNotes: input.meetingNotes ?? existing?.meetingNotes ?? "",
  };
  const files = input.files ?? existing?.files ?? [];
  if (
    existing &&
    Object.entries(values).every(
      ([k, v]) => existing[k as keyof Update] === v,
    ) &&
    JSON.stringify(existing.workstreams ?? []) ===
      JSON.stringify(selections ?? []) &&
    JSON.stringify(existing.files ?? []) === JSON.stringify(files)
  )
    return existing;
  return {
    id,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    weekStart,
    projectId: project.id,
    personId: identity.personId,
    ...values,
    files,
    ...(selections?.length ? { workstreams: selections } : { workstreams: [] }),
  };
}
