"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import {
  PRIORITIES,
  PUBLICATION_STATUSES,
  WORKSTREAM_STATUSES,
  type Collaborator,
  type Project,
  type Workstream,
  type Workspace,
} from "@/lib/types";
import { dayDifference } from "@/lib/calendar";
import { shortDate } from "@/lib/format";
import { mutate } from "./forms";
import { Modal } from "./modal";

type Editor =
  | { kind: "details" | "publication" }
  | { kind: "workstream"; value?: Workstream }
  | { kind: "collaborator"; value?: Collaborator };
type Props = { project: Project; data: Workspace; saved: () => Promise<void> };

export function ProjectContext({
  project,
  data,
  saved,
  mode,
}: Props & { mode: "details" | "responsibilities" }) {
  const manager = data.identity.role === "admin";
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const streams = (project.workstreams ?? []).filter((w) => !w.archived);
  const archived = (project.workstreams ?? []).filter((w) => w.archived);
  const members = data.memberships.filter((m) => m.projectId === project.id);
  const collaborators = project.collaborators ?? [];
  const hasDetails = Boolean(
    project.fullTitle ||
    project.methods ||
    project.notes ||
    project.links?.length,
  );
  async function update(body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate("/api/workstreams", body, "PATCH");
      await saved();
      setNotice("Responsibility updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="project-context">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {mode === "details" && (hasDetails || manager) && (
        <details open className="panel context-disclosure">
          <summary>
            <span>Research details</span>
            <small>Title, methods and resources</small>
          </summary>
          <div className="context-body">
            {hasDetails ? (
              <dl className="research-details">
                {project.fullTitle && (
                  <Detail label="Full title">{project.fullTitle}</Detail>
                )}
                {project.methods && (
                  <Detail label="Methods">{project.methods}</Detail>
                )}
                {!!project.links?.length && (
                  <Detail label="Resources">
                    <ul className="resource-list">
                      {project.links.map((link, i) => (
                        <li key={i}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {link.label}
                            <ArrowUpRight size={15} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </Detail>
                )}
                {project.notes && (
                  <Detail label="Notes">{project.notes}</Detail>
                )}
              </dl>
            ) : (
              <p className="section-copy">
                Add research context when you have it. Everything here is
                optional.
              </p>
            )}
            {manager && (
              <button
                className="text-action"
                onClick={() => setEditor({ kind: "details" })}
              >
                Edit research details
              </button>
            )}
          </div>
        </details>
      )}
      {mode === "responsibilities" && (streams.length > 0 || manager) && (
        <section
          className="panel responsibility-panel"
          aria-label="Project responsibilities"
        >
          <div className="section-heading">
            <div>
              <h2>Responsibilities</h2>
              <p className="section-copy">Who is working on what.</p>
            </div>
            {manager && project.state === "active" && (
              <button
                className="button secondary small-button"
                disabled={!members.length}
                onClick={() => setEditor({ kind: "workstream" })}
              >
                <Plus size={15} />
                Add responsibility
              </button>
            )}
          </div>
          {!streams.length && (
            <p className="quiet-empty">
              {members.length
                ? "Use these when a project has separate pieces of work. Solo projects can stay as they are."
                : "Members can join this project first. Then you can assign responsibilities."}
            </p>
          )}
          <div className="responsibility-list">
            {streams.map((w) => {
              const owner = data.people.find((p) => p.id === w.ownerId);
              const canEditStatus =
                project.state === "active" &&
                (manager || w.ownerId === data.identity.personId);
              const overdue =
                w.due &&
                w.status !== "Done" &&
                project.state === "active" &&
                dayDifference(w.due, data.today) < 0;
              return (
                <article className="responsibility-row" key={w.id}>
                  <div className="responsibility-copy">
                    <h3>{w.name}</h3>
                    <p>
                      {owner ? (
                        <Link href={`/team/${encodeURIComponent(owner.id)}`}>
                          {owner.name}
                        </Link>
                      ) : (
                        "Owner unavailable"
                      )}
                      {w.due && (
                        <>
                          {" "}
                          · Due {shortDate(w.due)}
                          {overdue && (
                            <span className="late-label"> · Overdue</span>
                          )}
                        </>
                      )}
                    </p>
                    {w.notes && (
                      <p className="responsibility-notes">{w.notes}</p>
                    )}
                  </div>
                  <div className="responsibility-actions">
                    {canEditStatus ? (
                      <select
                        aria-label={`Status for ${w.name}`}
                        className={`status-select ${w.status === "Blocked" ? "is-blocked" : ""}`}
                        disabled={busy}
                        value={w.status}
                        onChange={(e) =>
                          update({
                            projectId: project.id,
                            action: "status",
                            workstreamId: w.id,
                            status: e.target.value,
                          })
                        }
                      >
                        {WORKSTREAM_STATUSES.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`report-status ${w.status === "Blocked" ? "blocked" : w.status === "Done" ? "done" : ""}`}
                      >
                        {w.status}
                      </span>
                    )}
                    {manager && project.state === "active" && (
                      <button
                        className="text-action"
                        aria-label={`Edit ${w.name}`}
                        onClick={() =>
                          setEditor({ kind: "workstream", value: w })
                        }
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {manager && archived.length > 0 && (
            <details className="archived-responsibilities">
              <summary>Archived responsibilities ({archived.length})</summary>
              {archived.map((w) => (
                <div className="archived-row" key={w.id}>
                  <span>{w.name}</span>
                  {project.state === "active" && (
                    <button
                      className="text-action"
                      disabled={busy}
                      onClick={() =>
                        update({
                          projectId: project.id,
                          action: "restore",
                          workstreamId: w.id,
                        })
                      }
                    >
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </details>
          )}
        </section>
      )}
      {mode === "details" &&
        (project.publicationStatus ||
          project.targetJournal ||
          project.altJournal ||
          project.targetConference ||
          manager) && (
          <details className="panel context-disclosure">
            <summary>
              <span>Publication</span>
              <small>
                {project.publicationStatus || "Journals and conferences"}
              </small>
            </summary>
            <div className="context-body">
              <dl className="research-details">
                {project.publicationStatus && (
                  <Detail label="Status">{project.publicationStatus}</Detail>
                )}
                {project.targetJournal && (
                  <Detail label="Target journal">
                    {project.targetJournal}
                  </Detail>
                )}
                {project.altJournal && (
                  <Detail label="Alternative journal">
                    {project.altJournal}
                  </Detail>
                )}
                {project.targetConference && (
                  <Detail label="Target conference">
                    {project.targetConference}
                  </Detail>
                )}
              </dl>
              {!project.publicationStatus &&
                !project.targetJournal &&
                !project.altJournal &&
                !project.targetConference && (
                  <p className="section-copy">
                    Add a publication plan if this project needs one.
                  </p>
                )}
              {manager && (
                <button
                  className="text-action"
                  onClick={() => setEditor({ kind: "publication" })}
                >
                  Edit publication plan
                </button>
              )}
            </div>
          </details>
        )}
      {mode === "details" && (collaborators.length > 0 || manager) && (
        <details className="panel context-disclosure">
          <summary>
            <span>Collaborators</span>
            <small>
              {collaborators.length
                ? `${collaborators.length} external ${collaborators.length === 1 ? "collaborator" : "collaborators"}`
                : "People and partners outside the workspace"}
            </small>
          </summary>
          <div className="context-body">
            <div className="collaborator-list">
              {collaborators.map((c) => (
                <article className="collaborator-row" key={c.id}>
                  <div>
                    <h3>{c.name}</h3>
                    {(c.role || c.affiliation) && (
                      <p>
                        {[c.role, c.affiliation].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                    {c.contactVia && <p>Contact via {c.contactVia}</p>}
                    {c.notes && (
                      <p className="responsibility-notes">{c.notes}</p>
                    )}
                  </div>
                  {manager && (
                    <button
                      className="text-action"
                      aria-label={`Edit collaborator ${c.name}`}
                      onClick={() =>
                        setEditor({ kind: "collaborator", value: c })
                      }
                    >
                      Edit
                    </button>
                  )}
                </article>
              ))}
            </div>
            {!collaborators.length && (
              <p className="section-copy">
                Keep co-authors and partner contacts here. They do not need to
                sign in.
              </p>
            )}
            {manager && (
              <button
                className="text-action"
                onClick={() => setEditor({ kind: "collaborator" })}
              >
                Add collaborator
              </button>
            )}
          </div>
        </details>
      )}
      {mode === "details" &&
        !manager &&
        !hasDetails &&
        !project.publicationStatus &&
        !project.targetJournal &&
        !project.altJournal &&
        !project.targetConference &&
        !collaborators.length && (
          <div className="panel empty-state">
            <h2>No additional details yet</h2>
            <p>
              Your manager can add research context and a publication plan here.
            </p>
          </div>
        )}
      {editor && (
        <ContextEditor
          project={project}
          data={data}
          editor={editor}
          close={() => setEditor(null)}
          saved={async () => {
            await saved();
            setNotice("Project details saved.");
          }}
        />
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ContextEditor({
  project,
  data,
  editor,
  close,
  saved,
}: Props & { editor: Editor; close: () => void }) {
  const [recordId] = useState(
    editor.kind === "workstream" || editor.kind === "collaborator"
      ? (editor.value?.id ?? crypto.randomUUID())
      : "",
  );
  const [details, setDetails] = useState({
    fullTitle: project.fullTitle ?? "",
    leadId: project.leadId ?? "",
    priority: project.priority ?? "",
    methods: project.methods ?? "",
    notes: project.notes ?? "",
    links: project.links ?? [],
  });
  const [publication, setPublication] = useState({
    publicationStatus: project.publicationStatus ?? "",
    targetJournal: project.targetJournal ?? "",
    altJournal: project.altJournal ?? "",
    targetConference: project.targetConference ?? "",
  });
  const [stream, setStream] = useState<Workstream>({
    id: recordId,
    name: "",
    ownerId: "",
    status: "Not started",
    due: "",
    notes: "",
    ...(editor.kind === "workstream" ? editor.value : undefined),
  });
  const [collaborator, setCollaborator] = useState<Collaborator>({
    id: recordId,
    name: "",
    affiliation: "",
    role: "",
    email: "",
    contactVia: "",
    notes: "",
    ...(editor.kind === "collaborator" ? editor.value : undefined),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [removing, setRemoving] = useState(false);
  const members = data.people.filter((p) =>
    data.memberships.some(
      (m) => m.projectId === project.id && m.personId === p.id,
    ),
  );
  const titles = {
    details: "Research details",
    publication: "Publication plan",
    workstream:
      editor.kind === "workstream" && editor.value
        ? "Edit responsibility"
        : "Add responsibility",
    collaborator:
      editor.kind === "collaborator" && editor.value
        ? "Edit collaborator"
        : "Add collaborator",
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!confirmed) {
        if (editor.kind === "workstream") {
          const { archived: _archived, ...record } = stream;
          await mutate(
            "/api/workstreams",
            removing
              ? {
                  projectId: project.id,
                  action: "archive",
                  workstreamId: recordId,
                }
              : { projectId: project.id, action: "save", workstream: record },
            "PATCH",
          );
        } else {
          const body =
            editor.kind === "details"
              ? { id: project.id, action: "details", ...details }
              : editor.kind === "publication"
                ? { id: project.id, action: "publication", ...publication }
                : removing
                  ? {
                      id: project.id,
                      action: "remove-collaborator",
                      collaboratorId: recordId,
                    }
                  : { id: project.id, action: "collaborator", collaborator };
          await mutate("/api/projects", body, "PATCH");
        }
        setConfirmed(true);
      }
      await saved();
      close();
    } catch (e) {
      setError(`${confirmed ? "Saved. " : ""}${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={titles[editor.kind]} close={close}>
      <form className="modal-body context-form" onSubmit={submit}>
        {removing ? (
          <p>
            {editor.kind === "workstream"
              ? "Archive this responsibility? Earlier reports will keep their details. You can restore it later."
              : "Remove this collaborator from the project?"}
          </p>
        ) : (
          <fieldset className="entry-fields" disabled={busy || confirmed}>
            {editor.kind === "details" && (
              <>
                <p className="field-help">
                  Optional details. Add only what helps your team.
                </p>
                <label>
                  Full research title
                  <input
                    maxLength={500}
                    value={details.fullTitle}
                    onChange={(e) =>
                      setDetails({ ...details, fullTitle: e.target.value })
                    }
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Project lead
                    <select
                      aria-label="Project lead"
                      value={details.leadId}
                      onChange={(e) =>
                        setDetails({ ...details, leadId: e.target.value })
                      }
                    >
                      <option value="">No lead set</option>
                      {data.people.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select
                      aria-label="Priority"
                      value={details.priority}
                      onChange={(e) =>
                        setDetails({ ...details, priority: e.target.value })
                      }
                    >
                      <option value="">No priority set</option>
                      {PRIORITIES.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Research methods
                  <textarea
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. Interviews, panel analysis, mixed methods"
                    value={details.methods}
                    onChange={(e) =>
                      setDetails({ ...details, methods: e.target.value })
                    }
                  />
                </label>
                <div className="resource-editor">
                  <span className="field-label">Resources</span>
                  {details.links.map((link, i) => (
                    <div className="resource-edit-row" key={i}>
                      <label>
                        Link name
                        <input
                          required
                          maxLength={150}
                          value={link.label}
                          onChange={(e) =>
                            setDetails({
                              ...details,
                              links: details.links.map((l, j) =>
                                j === i ? { ...l, label: e.target.value } : l,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        URL
                        <input
                          required
                          type="url"
                          maxLength={2000}
                          placeholder="https://"
                          value={link.url}
                          onChange={(e) =>
                            setDetails({
                              ...details,
                              links: details.links.map((l, j) =>
                                j === i ? { ...l, url: e.target.value } : l,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="text-action"
                        aria-label={`Remove resource ${link.label || i + 1}`}
                        onClick={() =>
                          setDetails({
                            ...details,
                            links: details.links.filter((_, j) => i !== j),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {details.links.length < 10 && (
                    <button
                      type="button"
                      className="text-action"
                      onClick={() =>
                        setDetails({
                          ...details,
                          links: [...details.links, { label: "", url: "" }],
                        })
                      }
                    >
                      Add a resource link
                    </button>
                  )}
                </div>
                <label>
                  Project notes
                  <textarea
                    rows={3}
                    maxLength={4000}
                    value={details.notes}
                    onChange={(e) =>
                      setDetails({ ...details, notes: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            {editor.kind === "publication" && (
              <>
                <p className="field-help">
                  Separate from the research phase. Leave this blank for
                  projects without a publication plan.
                </p>
                <label>
                  Publication status
                  <select
                    aria-label="Publication status"
                    value={publication.publicationStatus}
                    onChange={(e) =>
                      setPublication({
                        ...publication,
                        publicationStatus: e.target.value,
                      })
                    }
                  >
                    <option value="">No publication plan</option>
                    {PUBLICATION_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Target journal
                  <input
                    maxLength={300}
                    value={publication.targetJournal}
                    onChange={(e) =>
                      setPublication({
                        ...publication,
                        targetJournal: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Alternative journal
                  <input
                    maxLength={300}
                    value={publication.altJournal}
                    onChange={(e) =>
                      setPublication({
                        ...publication,
                        altJournal: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Target conference
                  <input
                    maxLength={300}
                    value={publication.targetConference}
                    onChange={(e) =>
                      setPublication({
                        ...publication,
                        targetConference: e.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}
            {editor.kind === "workstream" && (
              <>
                <label>
                  Responsibility
                  <input
                    required
                    maxLength={150}
                    placeholder="e.g. Literature review or data collection"
                    value={stream.name}
                    onChange={(e) =>
                      setStream({ ...stream, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Owner
                  <select
                    aria-label="Owner"
                    required
                    value={stream.ownerId}
                    onChange={(e) =>
                      setStream({ ...stream, ownerId: e.target.value })
                    }
                  >
                    <option value="">Choose a project member</option>
                    {members.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Status
                    <select
                      aria-label="Status"
                      value={stream.status}
                      onChange={(e) =>
                        setStream({
                          ...stream,
                          status: e.target.value as Workstream["status"],
                        })
                      }
                    >
                      {WORKSTREAM_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Due date <span className="optional-label">Optional</span>
                    <input
                      type="date"
                      value={stream.due}
                      onChange={(e) =>
                        setStream({ ...stream, due: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Notes <span className="optional-label">Optional</span>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={stream.notes}
                    onChange={(e) =>
                      setStream({ ...stream, notes: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            {editor.kind === "collaborator" && (
              <>
                <label>
                  Name
                  <input
                    required
                    maxLength={150}
                    value={collaborator.name}
                    onChange={(e) =>
                      setCollaborator({ ...collaborator, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Role on project
                  <input
                    maxLength={150}
                    placeholder="e.g. Co-author or partner"
                    value={collaborator.role}
                    onChange={(e) =>
                      setCollaborator({ ...collaborator, role: e.target.value })
                    }
                  />
                </label>
                <label>
                  Affiliation
                  <input
                    maxLength={300}
                    value={collaborator.affiliation}
                    onChange={(e) =>
                      setCollaborator({
                        ...collaborator,
                        affiliation: e.target.value,
                      })
                    }
                  />
                </label>
                <details className="form-disclosure">
                  <summary>
                    Contact details and notes{" "}
                    <span className="optional-label">Optional</span>
                  </summary>
                  <div className="entry-fields">
                    <label>
                      Email
                      <input
                        type="email"
                        maxLength={300}
                        value={collaborator.email}
                        onChange={(e) =>
                          setCollaborator({
                            ...collaborator,
                            email: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Contact via
                      <input
                        maxLength={300}
                        placeholder="e.g. Project lead"
                        value={collaborator.contactVia}
                        onChange={(e) =>
                          setCollaborator({
                            ...collaborator,
                            contactVia: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Notes
                      <textarea
                        rows={2}
                        maxLength={2000}
                        value={collaborator.notes}
                        onChange={(e) =>
                          setCollaborator({
                            ...collaborator,
                            notes: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </details>
              </>
            )}
          </fieldset>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {!removing &&
            !confirmed &&
            (editor.kind === "workstream" || editor.kind === "collaborator") &&
            editor.value && (
              <button
                type="button"
                className="text-action muted removal-action"
                disabled={busy}
                onClick={() => setRemoving(true)}
              >
                {editor.kind === "workstream"
                  ? "Archive responsibility"
                  : "Remove collaborator"}
              </button>
            )}
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => (removing ? setRemoving(false) : close())}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy
              ? "Saving…"
              : confirmed
                ? "Refresh workspace"
                : removing
                  ? editor.kind === "workstream"
                    ? "Archive"
                    : "Remove"
                  : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
