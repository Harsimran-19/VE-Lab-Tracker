"use client";
import { useState } from "react";
import { type ResourceLink, type Update, type Workspace } from "@/lib/types";
import { LinkListEditor } from "./link-list";
import { latestDataUpdate } from "./project-outputs";
import { shortDate } from "@/lib/format";
import { ConflictReview } from "./conflict-review";
import { Modal } from "./modal";
import { mutate } from "./forms";
export function EntryForm({
  data,
  projectId,
  close,
  saved,
  refresh,
}: {
  data: Workspace;
  projectId: string;
  close: () => void;
  saved: () => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [formWeek] = useState(data.weekStart);
  const [expired, setExpired] = useState(false);
  const existing = data.updates.find(
    (u) =>
      u.projectId === projectId &&
      u.personId === data.identity.personId &&
      u.weekStart === data.weekStart,
  );
  const [expectedVersion, setExpectedVersion] = useState(existing?.version ?? 0);
  const [progress, setProgress] = useState(existing?.progress ?? ""),
    [nextPlan, setNextPlan] = useState(existing?.nextPlan ?? ""),
    [needsHelp, setNeedsHelp] = useState(existing?.needsHelp === "true"),
    [blockers, setBlockers] = useState(existing?.blockers ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [hours, setHours] = useState(existing?.hours ?? ""),
    [files, setFiles] = useState<ResourceLink[]>(existing?.files ?? []),
    [piMeeting, setPiMeeting] = useState<NonNullable<Update["piMeeting"]>>(existing?.piMeeting ?? ""),
    [piMeetingDate, setPiMeetingDate] = useState(existing?.piMeetingDate ?? ""),
    [collaboratorMeeting, setCollaboratorMeeting] = useState<NonNullable<Update["collaboratorMeeting"]>>(existing?.collaboratorMeeting ?? ""),
    [collaboratorMeetingDate, setCollaboratorMeetingDate] = useState(existing?.collaboratorMeetingDate ?? ""),
    [collaboratorNames, setCollaboratorNames] = useState(existing?.collaboratorNames ?? ""),
    [meetingNotes, setMeetingNotes] = useState(existing?.meetingNotes ?? "");
  const lastData = latestDataUpdate(data, projectId);
  const project = data.projects.find((p) => p.id === projectId)!;
  const available = (project.workstreams ?? []).filter(
    (w) => !w.archived && w.ownerId === data.identity.personId,
  );
  const options = [
    ...available.map((w) => ({ id: w.id, name: w.name })),
    ...(existing?.workstreams ?? []).filter(
      (w) => !available.some((a) => a.id === w.id),
    ),
  ];
  const [workstreamIds, setWorkstreamIds] = useState(
    existing?.workstreams?.map((w) => w.id) ?? [],
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!confirmed) {
        await mutate("/api/entries", {
          projectId,
          expectedVersion,
          weekStart: formWeek,
          progress,
          nextPlan,
          needsHelp,
          blockers: needsHelp ? blockers : "",
          workstreamIds,
          hours: hours === "" ? "" : Number(hours),
          files,
          piMeeting,
          piMeetingDate: piMeeting === "scheduled" || piMeeting === "held" ? piMeetingDate : "",
          collaboratorMeeting,
          collaboratorMeetingDate: collaboratorMeeting === "scheduled" || collaboratorMeeting === "held" ? collaboratorMeetingDate : "",
          collaboratorNames: collaboratorMeeting === "scheduled" || collaboratorMeeting === "held" ? collaboratorNames : "",
          meetingNotes,
        });
        setConfirmed(true);
      }
      await saved();
      close();
    } catch (e) {
      setError((e as Error).message);
      if ((e as Error).message.includes("new reporting week")) {
        setExpired(true);
        await refresh().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={existing ? "Edit this week’s update" : "Write weekly update"}
      close={close}
    >
      <form className="modal-body" onSubmit={submit}>
        <div className="report-context">
          <strong>{project.name}</strong>
          <p>Week of {shortDate(data.weekStart)} · Shared with your team</p>
        </div>
        <fieldset
          className="entry-fields"
          disabled={busy || confirmed || expired}
        >
          {options.length > 0 && (
            <details
              className="form-disclosure"
              open={workstreamIds.length > 0 || undefined}
            >
              <summary>
                Which responsibilities does this cover?{" "}
                <span className="optional-label">Optional</span>
              </summary>
              <div className="report-responsibility-options">
                {options.map((w) => (
                  <label className="check-label" key={w.id}>
                    <input
                      type="checkbox"
                      checked={workstreamIds.includes(w.id)}
                      onChange={(e) =>
                        setWorkstreamIds(
                          e.target.checked
                            ? [...workstreamIds, w.id]
                            : workstreamIds.filter((id) => id !== w.id),
                        )
                      }
                    />
                    {w.name}
                  </label>
                ))}
              </div>
              <p className="field-help">
                One update can cover several responsibilities.
              </p>
            </details>
          )}
          <label>
            What did you accomplish?
            <textarea
              aria-label="What did you accomplish?"
              required
              rows={4}
              maxLength={4000}
              placeholder="Summarize what moved forward this week."
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
            />
          </label>
          <label>
            What will you do next?
            <textarea
              aria-label="What will you do next?"
              required
              rows={2}
              maxLength={2000}
              placeholder="Your next concrete step."
              value={nextPlan}
              onChange={(e) => setNextPlan(e.target.value)}
            />
          </label>
          <label>
            Hours on this project this week
            <input
              aria-label="Hours on this project this week"
              type="number"
              min={0}
              max={168}
              step={0.25}
              inputMode="decimal"
              placeholder="e.g. 12"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </label>
          <fieldset className="meeting-fields">
            <legend>Meetings this week</legend>
            <div className="form-grid">
              <label>
                Meeting with the PI
                <select aria-label="Meeting with the PI" value={piMeeting} onChange={(e) => setPiMeeting(e.target.value as typeof piMeeting)}>
                  <option value="">Not recorded</option>
                  <option value="none">No meeting</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="held">Met this week</option>
                </select>
              </label>
              {(piMeeting === "scheduled" || piMeeting === "held") && <label>
                Date
                <input aria-label="Date of meeting with the PI" type="date" value={piMeetingDate} onChange={(e) => setPiMeetingDate(e.target.value)} />
              </label>}
            </div>
            <div className="form-grid">
              <label>
                Meeting with external collaborators
                <select aria-label="Meeting with external collaborators" value={collaboratorMeeting} onChange={(e) => setCollaboratorMeeting(e.target.value as typeof collaboratorMeeting)}>
                  <option value="">Not recorded</option>
                  <option value="none">No meeting</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="held">Met this week</option>
                </select>
              </label>
              {(collaboratorMeeting === "scheduled" || collaboratorMeeting === "held") && <label>
                Date
                <input aria-label="Date of collaborator meeting" type="date" value={collaboratorMeetingDate} onChange={(e) => setCollaboratorMeetingDate(e.target.value)} />
              </label>}
            </div>
            {(collaboratorMeeting === "scheduled" || collaboratorMeeting === "held") && <label>
              Who?
              <input aria-label="Collaborators met" maxLength={300} placeholder="Names or institutions" value={collaboratorNames} onChange={(e) => setCollaboratorNames(e.target.value)} />
            </label>}
            <label>
              <span>Meeting notes <span className="optional-label">Optional</span></span>
              <textarea aria-label="Meeting notes" rows={2} maxLength={2000} placeholder="Decisions, feedback and follow-ups" value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} />
            </label>
          </fieldset>
          <LinkListEditor label="Reference files" itemName="Reference file" max={10} links={files} onChange={setFiles} />
          <p className="field-help">Link files in Google Drive, Dropbox, OneDrive or GitHub.{" "}
            {lastData ? `Project data last versioned ${shortDate(lastData.slice(0, 10))}.` : "No data versions yet."} Add new data, paper or code versions in the project’s Data & outputs tab.</p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={needsHelp}
              onChange={(e) => setNeedsHelp(e.target.checked)}
            />
            I need help
          </label>
          {needsHelp && (
            <label>
              What is blocking you?
              <textarea
                aria-label="What is blocking you?"
                required
                rows={2}
                maxLength={2000}
                placeholder="Explain the problem or the help you need."
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
              />
            </label>
          )}
        </fieldset>
        <p className="field-help">
          Your name, date and reporting week are recorded automatically. Saving
          again updates this week’s report.
        </p>
        {error && (
          <p className="error" role="alert">
            {confirmed ? "Your update is saved. " : ""}
            {error}
          </p>
        )}
        <ConflictReview error={error} projectId={projectId} updateId={existing?.id ?? "new-report"} accept={version => {setExpectedVersion(version);setError("");}} />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || expired}>
            {busy
              ? "Saving…"
              : confirmed
                ? "Refresh workspace"
                : existing
                  ? "Save changes"
                  : "Submit update"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
