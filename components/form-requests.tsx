"use client";
import { useState } from "react";
import Link from "next/link";
import type { FormRequest, Project, Workspace } from "@/lib/types";
import { canManageProject } from "@/lib/access";
import { mutate, ProjectForm } from "./forms";
import { ContextEditor } from "./project-details";
import { PeoplePicker } from "./people-picker";
import { Modal } from "./modal";
import { ConflictReview } from "./conflict-review";

export function ProjectFormRequests({ project, data, saved }: { project: Project; data: Workspace; saved: () => Promise<void> }) {
  const manage = canManageProject(data, data.identity, project);
  const [requesting, setRequesting] = useState(false), [editing, setEditing] = useState<FormRequest | null>(null);
  const members = data.people.filter(p => data.memberships.some(m => m.projectId === project.id && m.personId === p.id));
  const requests = (project.formRequests ?? []).filter(r => manage || r.personId === data.identity.personId);
  async function complete() {
    await mutate("/api/form-requests", { action: "complete", id: editing!.id, projectId: project.id, expectedVersion: project.version ?? 0 });
    await saved();
  }
  if (!manage && !requests.length) return null;
  return <section className="collaboration-section" aria-label="Project form requests"><div className="section-heading"><h2>Form requests</h2>{manage && <button className="button secondary small-button" onClick={() => setRequesting(true)}>Request a form</button>}</div><p className="section-copy">Ask project members to complete project initiation details or a task form. Requests appear in their Home page.</p>
    <ul className="request-list">{requests.map(r => <li key={r.id}><div><strong>{r.kind === "initiation" ? "Project initiation form" : "Task form"}</strong><p>{data.people.find(p => p.id === r.personId)?.name || "Member"} · {r.completedAt ? "Completed" : "Awaiting completion"}</p>{r.message && <p className="section-copy">{r.message}</p>}</div>{!r.completedAt && r.personId === data.identity.personId && <button className="button secondary small-button" onClick={() => setEditing(r)}>Open {r.kind === "initiation" ? "initiation" : "task"} form</button>}</li>)}</ul>{!requests.length && <p className="quiet-empty">No forms requested yet.</p>}
    {requesting && <RequestEditor project={project} data={data} saved={saved} close={() => setRequesting(false)} />}
    {editing?.kind === "initiation" && <ProjectForm project={project} action="settings" initiationOnly people={members} canManage={manage} close={() => setEditing(null)} saved={complete} />}
    {editing?.kind === "task" && <ContextEditor project={project} data={data} editor={{ kind: "workstream" }} close={() => setEditing(null)} saved={complete} />}
  </section>;
}
function RequestEditor({ project, data, saved, close }: { project: Project; data: Workspace; saved: () => Promise<void>; close: () => void }) {
  const [id] = useState(() => crypto.randomUUID()), [personIds, setPersonIds] = useState<string[]>([]), [kind, setKind] = useState("initiation"), [message, setMessage] = useState("");
  const [version, setVersion] = useState(project.version ?? 0), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  return <Modal title="Request a form" close={close}><form className="modal-body" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { if (!confirmed) { await mutate("/api/form-requests", { action: "request", id, projectId: project.id, personIds, kind, message, expectedVersion: version }); setConfirmed(true); } await saved(); close(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><fieldset className="entry-fields" disabled={busy || confirmed}><label>Form<select aria-label="Form" value={kind} onChange={e => setKind(e.target.value)}><option value="initiation">Project initiation form</option><option value="task">Task form</option></select></label><PeoplePicker label="Recipients" people={data.people.filter(p => data.memberships.some(m => m.projectId === project.id && m.personId === p.id))} selected={personIds} onChange={setPersonIds} /><label>Instructions <span className="optional-label">Optional</span><textarea maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} /></label></fieldset>{error && <p className="error" role="alert">{error}</p>}<ConflictReview error={error} projectId={project.id} accept={v => { setVersion(v); setError(""); }} /><div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy || !personIds.length}>{busy ? "Saving…" : confirmed ? "Refresh workspace" : "Send request"}</button></div></form></Modal>;
}
export function MyFormRequests({ data }: { data: Workspace }) {
  const requests = data.projects.flatMap(p => (p.formRequests ?? []).filter(r => r.personId === data.identity.personId && !r.completedAt).map(r => ({ ...r, project: p })));
  const invitations = data.invitations.filter(i => i.email === data.identity.email && !i.acceptedAt && !i.revokedAt && i.expiresAt > new Date().toISOString());
  if (!requests.length && !invitations.length) return null;
  return <section className="home-section"><h2>Requests for you</h2><ul className="request-list">{requests.map(r => <li key={r.id}><div><strong>{r.project.name}</strong><p>{r.kind === "initiation" ? "Complete the project initiation form" : "Complete a task form"}</p>{r.message && <p className="section-copy">{r.message}</p>}</div><Link href={`/projects/${r.project.id}#form-requests`} className="home-row-link" prefetch={false}>Open request →</Link></li>)}{invitations.map(i => <li key={i.id}><span>You have a {i.projectId ? "project" : "lab"} invitation</span><Link href={`/invite/${i.id}`}>Review invitation →</Link></li>)}</ul></section>;
}
