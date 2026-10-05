"use client";
import { useState } from "react";
import type { Workspace } from "@/lib/types";
import { shortDate } from "@/lib/format";
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
  const [progress, setProgress] = useState(existing?.progress ?? ""),
    [nextPlan, setNextPlan] = useState(existing?.nextPlan ?? ""),
    [needsHelp, setNeedsHelp] = useState(existing?.needsHelp === "true"),
    [blockers, setBlockers] = useState(existing?.blockers ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
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
          weekStart: formWeek,
          progress,
          nextPlan,
          needsHelp,
          blockers: needsHelp ? blockers : "",
          workstreamIds,
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
