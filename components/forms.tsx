"use client";
import { useState } from "react";
import type { Project } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { Modal } from "./modal";
export async function mutate(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Please try again.");
  return data;
}
export type ProjectAction =
  "create" | "goal" | "phase" | "milestone" | "complete" | "pause" | "reopen";
export function ProjectForm({
  project,
  action,
  close,
  saved,
}: {
  project?: Project;
  action: ProjectAction;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [id] = useState(project?.id ?? crypto.randomUUID()),
    [name, setName] = useState(project?.name ?? ""),
    [goal, setGoal] = useState(project?.goal ?? ""),
    [phase, setPhase] = useState(project?.phase ?? "Idea"),
    [milestone, setMilestone] = useState(project?.milestone ?? ""),
    [due, setDue] = useState(project?.due ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const titles = {
    create: "Create project",
    goal: "Edit project goal",
    phase: "Change research phase",
    milestone: "Set next milestone",
    complete: "Complete project",
    pause: "Put project on hold",
    reopen: "Reopen project",
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!confirmed) {
        const body =
          action === "create"
            ? { id, name, goal }
            : action === "goal"
              ? { id, action, name, goal }
              : action === "phase"
                ? { id, action, phase }
                : action === "milestone"
                  ? { id, action, milestone, due }
                  : { id, action };
        await mutate(
          "/api/projects",
          body,
          action === "create" ? "POST" : "PATCH",
        );
        setConfirmed(true);
      }
      await saved();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={titles[action]} close={close}>
      <form className="modal-body" onSubmit={submit}>
        <fieldset className="entry-fields" disabled={busy || confirmed}>
          {(action === "create" || action === "goal") && (
            <>
              <label>
                Project name
                <input
                  required
                  maxLength={150}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Goal
                <textarea
                  aria-label="Goal"
                  required
                  rows={3}
                  maxLength={1000}
                  placeholder="What should this project achieve?"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </label>
            </>
          )}
          {action === "phase" && (
            <label>
              Current phase
              <select
                aria-label="Current phase"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
              >
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <span className="field-help">
                This describes the whole project’s research stage.
              </span>
            </label>
          )}
          {action === "milestone" && (
            <>
              <label>
                Milestone
                <input
                  required
                  maxLength={500}
                  placeholder="e.g. Finish the pilot interviews"
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                />
              </label>
              <label>
                Due date
                <input
                  required
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
            </>
          )}
          {action === "complete" && (
            <p>
              Complete <strong>{project?.name}</strong>? Weekly reporting and
              deadline reminders will stop. Its reports will remain available
              under Completed projects.
            </p>
          )}
          {action === "reopen" && (
            <p>
              Reopen <strong>{project?.name}</strong>? Members can resume weekly
              reporting.
            </p>
          )}
          {action === "pause" && (
            <p>
              Put <strong>{project?.name}</strong> on hold? Weekly reporting and
              reminders will pause. You can resume it whenever work begins
              again.
            </p>
          )}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {confirmed ? "Saved. " : ""}
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy
              ? "Saving…"
              : confirmed
                ? "Refresh workspace"
                : action === "complete"
                  ? "Complete project"
                  : action === "pause"
                    ? "Put on hold"
                    : action === "reopen"
                      ? "Reopen project"
                      : "Save project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
