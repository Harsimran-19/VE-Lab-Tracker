"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { type Project, type ProjectAttribute, type Workspace } from "@/lib/types";
import { canEditProject, isApproved } from "@/lib/access";
import { reportDate } from "@/lib/format";
import { ConflictReview } from "./conflict-review";
import { mutate } from "./forms";
import { Modal } from "./modal";

type Props = { project: Project; data: Workspace; saved: () => Promise<void> };
const ATTRIBUTE_SUGGESTIONS = ["Funding source", "Funder", "Funding amount", "Grant deadline", "Grant status", "Dataset", "Code repository", "Partner institution", "Ethics approval"];

export function approvalLabel(project: Pick<Project, "approval">) {
  return project.approval === "pending" ? "Awaiting approval" : project.approval === "rejected" ? "Not approved" : "Approved";
}

async function change(project: Project, body: Record<string, unknown>) {
  return mutate("/api/projects", { id: project.id, expectedVersion: project.version ?? 0, ...body }, "PATCH");
}

export function ApprovalPanel({ project, data, saved }: Props) {
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (isApproved(project)) return null;
  const manager = data.identity.role === "admin";
  const requester = data.people.find(p => p.id === project.requestedBy);
  const pending = project.approval === "pending";
  return <section className={`approval-panel ${pending ? "is-pending" : "is-rejected"}`} aria-label="Project approval">
    <div>
      <h2>{pending ? (manager ? "This project is waiting for your approval" : "Waiting for the lab manager’s approval") : "The lab manager has not approved this project"}</h2>
      <p>{requester ? <>Requested by <Link href={`/team/${requester.id}`} prefetch={false}>{requester.name}</Link>. </> : null}{pending ? "The team can refine the details now. Weekly updates and reminders start once it is approved." : "Edit the details to address the feedback, then resubmit it."}</p>
      {project.reviewNote && <p className="approval-note"><strong>Feedback:</strong> {project.reviewNote}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    <div className="approval-actions">
      {manager && <><button className="button primary" onClick={() => setDeciding("approve")}><CheckIcon size={16} aria-hidden="true" />Approve</button>{pending && <button className="button secondary" onClick={() => setDeciding("reject")}><XIcon size={16} aria-hidden="true" />Don’t approve</button>}</>}
      {!manager && !pending && canEditProject(data, data.identity, project) && <button className="button primary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await change(project, { action: "resubmit" }); await saved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Resubmit for approval</button>}
    </div>
    {deciding && <ReviewDialog project={project} decision={deciding} saved={saved} close={() => setDeciding(null)} />}
  </section>;
}

function ReviewDialog({ project, decision, saved, close }: { project: Project; decision: "approve" | "reject"; saved: () => Promise<void>; close: () => void }) {
  const [note, setNote] = useState(""), [version, setVersion] = useState(project.version ?? 0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Modal title={decision === "approve" ? "Approve project" : "Don’t approve project"} close={close}>
    <form className="modal-body" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await change({ ...project, version }, { action: "review", decision, note }); await saved(); close(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <fieldset className="entry-fields" disabled={busy}>
        <p>{decision === "approve" ? <>Approve <strong>{project.name}</strong>? Members can join it and weekly reporting starts.</> : <>The team will see your feedback and can resubmit <strong>{project.name}</strong>.</>}</p>
        <label>{decision === "approve" ? "Note for the team" : "Feedback"} {decision === "approve" && <span className="optional-label">Optional</span>}<textarea required={decision === "reject"} rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <ConflictReview error={error} projectId={project.id} accept={v => { setVersion(v); setError(""); }} />
      <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : decision === "approve" ? "Approve project" : "Send feedback"}</button></div>
    </form>
  </Modal>;
}

export function ProjectAttributes({ project, data, saved }: Props) {
  const [editing, setEditing] = useState<ProjectAttribute | { id?: undefined } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const manager = data.identity.role === "admin";
  const editor = canEditProject(data, data.identity, project);
  const attributes = project.attributes ?? [];
  async function run(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try { await change(project, body); await saved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!attributes.length && !editor) return null;
  return <section className="project-latest project-attributes" aria-label="Project attributes">
    <h2>Project attributes</h2>
    {!attributes.length && <p className="muted">Track facts such as a funding source, dataset or partner. {manager ? "" : "New attributes go to the lab manager for approval."}</p>}
    <dl className="attribute-list">{attributes.map(a => <div key={a.id} className={`attribute-row is-${a.status}`}>
      <dt>{a.label}{a.status !== "approved" && <span className={`report-status ${a.status === "pending" ? "blocked" : "done"}`}>{a.status === "pending" ? "Awaiting approval" : "Not approved"}</span>}</dt>
      <dd>{a.value}</dd>
      {a.status === "pending" && <dd className="field-help">Proposed by {data.people.find(p => p.id === a.proposedBy)?.name || "a member"}{a.proposedAt ? ` · ${reportDate(a.proposedAt, data.settings.timezone)}` : ""}</dd>}
      <dd className="inline-actions">
        {manager && a.status !== "approved" && <button className="text-action" disabled={busy} onClick={() => run({ action: "attribute-review", attributeId: a.id, decision: "approve" })}>Approve</button>}
        {manager && a.status === "pending" && <button className="text-action muted" disabled={busy} onClick={() => run({ action: "attribute-review", attributeId: a.id, decision: "reject" })}>Don’t approve</button>}
        {editor && <button className="text-action" disabled={busy} aria-label={`Edit ${a.label}`} onClick={() => setEditing(a)}>Edit</button>}
        {editor && (manager || a.status !== "approved") && <button className="text-action muted" disabled={busy} aria-label={`Remove ${a.label}`} onClick={() => run({ action: "remove-attribute", attributeId: a.id })}>Remove</button>}
      </dd>
    </div>)}</dl>
    {error && <p className="error" role="alert">{error}</p>}
    {editor && <button className="text-action" onClick={() => setEditing({})}><PlusIcon size={15} aria-hidden="true" />{manager ? "Add attribute" : "Propose an attribute"}</button>}
    {editing && <AttributeDialog project={project} attribute={editing.id ? editing as ProjectAttribute : undefined} manager={manager} saved={saved} close={() => setEditing(null)} />}
  </section>;
}

function AttributeDialog({ project, attribute, manager, saved, close }: { project: Project; attribute?: ProjectAttribute; manager: boolean; saved: () => Promise<void>; close: () => void }) {
  const [id] = useState(attribute?.id ?? crypto.randomUUID());
  const [label, setLabel] = useState(attribute?.label ?? (project.type === "Fund Sourcing" && !project.attributes?.length ? "Funding source" : "")), [value, setValue] = useState(attribute?.value ?? "");
  const [version, setVersion] = useState(project.version ?? 0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Modal title={attribute ? "Edit attribute" : manager ? "Add attribute" : "Propose an attribute"} close={close}>
    <form className="modal-body" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await change({ ...project, version }, { action: "attribute", attribute: { id, label, value } }); await saved(); close(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <fieldset className="entry-fields" disabled={busy}>
        <label>Attribute<input required maxLength={100} list="attribute-suggestions" placeholder="e.g. Funding source" value={label} onChange={e => setLabel(e.target.value)} /></label>
        <datalist id="attribute-suggestions">{ATTRIBUTE_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
        <label>Value<textarea required rows={2} maxLength={1000} placeholder="e.g. NSF CAREER award" value={value} onChange={e => setValue(e.target.value)} /></label>
        {!manager && <p className="field-help">The lab manager approves new and changed attributes before they count as confirmed.</p>}
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <ConflictReview error={error} projectId={project.id} accept={v => { setVersion(v); setError(""); }} />
      <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : manager ? "Save attribute" : "Send for approval"}</button></div>
    </form>
  </Modal>;
}

// The manager's queue of project requests and proposed attributes.
export function ApprovalQueue({ data }: { data: Workspace }) {
  const manager = data.identity.role === "admin";
  const requests = data.projects.filter(p => p.approval === "pending" || (!manager && p.approval === "rejected" && p.requestedBy === data.identity.personId));
  const visible = manager ? requests : requests.filter(p => p.requestedBy === data.identity.personId);
  const attributes = manager ? data.projects.flatMap(p => (p.attributes ?? []).filter(a => a.status === "pending").map(a => ({ ...a, project: p }))) : [];
  if (!visible.length && !attributes.length) return null;
  return <section className="home-section approval-queue" aria-labelledby="approval-heading">
    <div className="home-section-heading"><h2 id="approval-heading">{manager ? "Waiting for your approval" : "Your project requests"}</h2></div>
    <ul className="approval-list">
      {visible.map(p => <li key={p.id}><Link href={`/projects/${p.id}`} prefetch={false}>{p.name}</Link><span className="home-muted">{p.type || "Project"}{manager ? ` · requested by ${data.people.find(x => x.id === p.requestedBy)?.name || "a member"}` : ""}</span><span className={`report-status ${p.approval === "pending" ? "blocked" : "done"}`}>{approvalLabel(p)}</span></li>)}
      {attributes.map(a => <li key={a.id}><Link href={`/projects/${a.project.id}`} prefetch={false}>{a.project.name}</Link><span className="home-muted">New attribute: {a.label} = {a.value}</span><span className="report-status blocked">Awaiting approval</span></li>)}
    </ul>
  </section>;
}
