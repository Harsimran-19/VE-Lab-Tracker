"use client";
import { useState } from "react";
import type { Project, Person } from "@/lib/types";
import { STAGES, PRIORITIES, PUBLICATION_STATUSES } from "@/lib/types";
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
  | "create"
  | "settings"
  | "goal"
  | "phase"
  | "milestone"
  | "complete"
  | "pause"
  | "reopen";
export function ProjectForm({
  project,
  action,
  people,
  close,
  saved,
}: {
  project?: Project;
  action: ProjectAction;
  people: Person[];
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
  const configuring = action === "create" || action === "settings";
  const [setup, setSetup] = useState({
    leadId: project?.leadId ?? "",
    priority: project?.priority ?? "Steady",
    methods: project?.methods ?? "",
    fullTitle: project?.fullTitle ?? "",
    publicationStatus: project?.publicationStatus ?? "",
    targetJournal: project?.targetJournal ?? "",
    altJournal: project?.altJournal ?? "",
    targetConference: project?.targetConference ?? "",
  });
  const updateSetup = (key: keyof typeof setup, value: string) =>
    setSetup((previous) => ({ ...previous, [key]: value }));
  const titles = {
    create: "Create project",
    settings: "Project settings",
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
        const body = configuring
          ? {
              id,
              name,
              goal,
              phase,
              milestone,
              due,
              ...setup,
              ...(action === "settings" ? { action } : {}),
            }
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
          {configuring && (
            <p className="section-copy">
              {action === "create"
                ? "Set the direction now. Only the name and goal are required."
                : "Keep the project’s direction, ownership and next deadline together."}
            </p>
          )}
          {(configuring || action === "goal") && (
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
                Research goal
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
          {configuring && (
            <>
              <section className="setup-section" aria-label="Research and ownership">
                <div className="form-grid">
                  <label>Research phase<select aria-label="Current phase" value={phase} onChange={(e) => setPhase(e.target.value)}>{STAGES.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label>Project lead<select aria-label="Project lead" value={setup.leadId} onChange={(e) => updateSetup("leadId",e.target.value)}><option value="">Choose later</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                </div>
                <div className="form-grid">
                  <label>Priority<select aria-label="Priority" value={setup.priority} onChange={(e) => updateSetup("priority",e.target.value)}><option value="">Choose later</option>{PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label><span>Research methods <span className="optional-label">Optional</span></span><input aria-label="Research methods" maxLength={2000} placeholder="e.g. Interviews, survey, experiment" value={setup.methods} onChange={(e) => updateSetup("methods",e.target.value)} /></label>
                </div>
                <p className="field-help">Push: focus now · Steady: ongoing work · Background: lower urgency.</p>
              </section>
              <section className="setup-section" aria-label="Next milestone">
                <h3>
                  Next milestone{" "}
                  <span className="optional-label">Optional</span>
                </h3>
                <p className="section-copy">
                  Set the next concrete step and its deadline when you know
                  them.
                </p>
                <div className="form-grid">
                <label>
                  Milestone
                  <input
                    aria-label="Milestone"
                    required={Boolean(due)}
                    maxLength={500}
                    placeholder="e.g. Finish the pilot interviews"
                    value={milestone}
                    onChange={(e) => setMilestone(e.target.value)}
                  />
                </label>
                <label>
                  Due date
                  <input
                    aria-label="Due date"
                    required={Boolean(milestone.trim())}
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                </div>
              </section>
              <details
                className="form-disclosure"
                open={
                  action === "settings" &&
                  Boolean(
                    setup.fullTitle ||
                    setup.publicationStatus ||
                    setup.targetJournal ||
                    setup.altJournal ||
                    setup.targetConference,
                  )
                }
              >
                <summary>
                  Publication details{" "}
                  <span className="optional-label">Optional</span>
                </summary>
                <div className="entry-fields">
                  <label>
                    Full research title
                    <input
                      maxLength={500}
                      value={setup.fullTitle}
                      onChange={(e) => updateSetup("fullTitle", e.target.value)}
                    />
                  </label>
                  <label>
                    Publication status
                    <select
                      aria-label="Publication status"
                      value={setup.publicationStatus}
                      onChange={(e) =>
                        updateSetup("publicationStatus", e.target.value)
                      }
                    >
                      <option value="">Choose later</option>
                      {PUBLICATION_STATUSES.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <span className="field-help">
                      The manuscript’s status, separate from the research phase.
                    </span>
                  </label>
                  <label>
                    Target journal
                    <input
                      maxLength={300}
                      value={setup.targetJournal}
                      onChange={(e) =>
                        updateSetup("targetJournal", e.target.value)
                      }
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Alternative journal
                      <input
                        maxLength={300}
                        value={setup.altJournal}
                        onChange={(e) =>
                          updateSetup("altJournal", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Target conference
                      <input
                        maxLength={300}
                        value={setup.targetConference}
                        onChange={(e) =>
                          updateSetup("targetConference", e.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              </details>
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
                      : action === "create"
                        ? "Create project"
                        : "Save project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
