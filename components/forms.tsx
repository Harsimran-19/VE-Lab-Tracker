"use client";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import type { Assignment, Person, Project, Workspace } from "@/lib/types";
import { PIPELINES, PRIORITIES, STAGES } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { Modal } from "./modal";

export async function mutate(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}
export function ProjectEditor({ project, close, saved }: { project: Project; close: () => void; saved: () => Promise<void> }) {
  const [form, setForm] = useState(project);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  function field(key: keyof Project, value: string) { setForm({ ...form, [key]: value }); }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await mutate("/api/projects", form, "PATCH"); await saved(); close(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title={`Edit ${project.id}`} close={close}><form className="modal-body" onSubmit={submit}>
    <label>Project name<input required maxLength={150} value={form.name} onChange={e=>field("name",e.target.value)}/></label>
    <label>Full research title<textarea maxLength={1000} rows={2} value={form.title} onChange={e=>field("title",e.target.value)}/></label>
    <div className="form-grid"><label>Research stage<select value={form.stage} onChange={e=>field("stage",e.target.value)}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e=>field("priority",e.target.value)}>{PRIORITIES.map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Publication status<select value={form.pipeline} onChange={e=>field("pipeline",e.target.value)}>{PIPELINES.map(s=><option key={s}>{s}</option>)}</select></label><label>Milestone due date<input type="date" value={form.due} onChange={e=>field("due",e.target.value)}/></label></div>
    <label>Next milestone<input maxLength={1000} value={form.milestone} onChange={e=>field("milestone",e.target.value)}/></label>
    <div className="form-grid"><label>Target journal<input maxLength={300} value={form.journal} onChange={e=>field("journal",e.target.value)}/></label><label>Target conference<input maxLength={300} value={form.conference} onChange={e=>field("conference",e.target.value)}/></label></div>
    <label>Methods<textarea maxLength={2000} rows={2} value={form.methods} onChange={e=>field("methods",e.target.value)}/></label>
    <label>Notes<textarea maxLength={4000} rows={3} value={form.notes} onChange={e=>field("notes",e.target.value)}/></label>
    {error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save project"}</button></div>
  </form></Modal>;
}

export function AssignmentEditor({ data, projectId, personId, existing, close, saved }: { data: Workspace; projectId?: string; personId?: string; existing?: Assignment; close: () => void; saved: () => Promise<void> }) {
  const [form, setForm] = useState(existing ?? { id: "", projectId: projectId ?? data.projects[0]?.id ?? "", personId: personId ?? data.people.find(p => p.role === "member")?.id ?? data.people[0]?.id ?? "", responsibility: "", status: "Not started", due: "" });
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  async function submit(e:React.FormEvent) { e.preventDefault();setBusy(true);setError("");try { await mutate("/api/assignments",form);await saved();close(); }catch(e){setError((e as Error).message);}finally{setBusy(false);} }
  return <Modal title={existing ? "Edit responsibility" : "Assign a responsibility"} close={close}><form className="modal-body" onSubmit={submit}>
    <p className="form-intro">Choose a person and project, then describe what they are responsible for. Members can report only on work assigned to them.</p>
    <label>Project<select aria-label="Project" required disabled={Boolean(existing)} value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})}>{data.projects.map(p=><option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select></label>
    <label>Lab member<select value={form.personId} onChange={e=>setForm({...form,personId:e.target.value})}>{data.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Responsibility<input required maxLength={300} placeholder="For example: literature review" value={form.responsibility} onChange={e=>setForm({...form,responsibility:e.target.value})}/></label>
    <div className="form-grid"><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{["Not started","In progress","Blocked","Done"].map(s=><option key={s}>{s}</option>)}</select></label><label>Due date<input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})}/></label></div>
    {error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" type="button" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save responsibility"}</button></div>
  </form></Modal>;
}

export function PersonEditor({ person, protectedAccount = false, close, saved }: { person: Person; protectedAccount?: boolean; close: () => void; saved: () => Promise<void> }) {
  const [form,setForm]=useState({id:person.id,name:person.name,email:person.email,affiliation:person.affiliation,role:person.role});
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{await mutate("/api/people",form,"PATCH");await saved();close();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Modal title={`Edit ${person.name}`} close={close}><form className="modal-body" onSubmit={submit}><label>Name<input required maxLength={150} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Google account email<input type="email" disabled={protectedAccount} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/><span className="field-help">This exact Google account will be allowed to sign in. Leave blank to disable member login.</span></label>
    <label>Role<select aria-label="Role" disabled={protectedAccount} value={form.role} onChange={e=>setForm({...form,role:e.target.value as Person["role"]})}><option value="member">Member — assigned work and progress reports</option><option value="admin">Administrator — manage the whole lab</option></select><span className="field-help">{protectedAccount ? "Your account and the workspace owner stay active as administrators." : "Administrators can add people, manage assignments, and review all reports."}</span></label>
    <label>Affiliation<input maxLength={300} value={form.affiliation} onChange={e=>setForm({...form,affiliation:e.target.value})}/></label>
    {error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save member"}</button></div>
  </form></Modal>;
}

export function AssignmentList({ data, projectId, refresh }: { data: Workspace; projectId: string; refresh: () => Promise<void> }) {
  const [editing,setEditing]=useState<Assignment | "new" | null>(null);
  const admin=data.identity.role==="admin";
  return <section className="detail-section"><div className="section-heading"><h3>Who’s doing what</h3>{admin&&<button className="button text-button" onClick={()=>setEditing("new")}><Plus size={16}/>Assign</button>}</div>
    {data.assignments.filter(a=>a.projectId===projectId).map(a=><div className="assignment-row" key={a.id}><div><strong>{data.people.find(p=>p.id===a.personId)?.name}</strong><p>{a.responsibility}</p><span className="muted">{a.status}{a.due ? ` · Due ${shortDate(a.due)}` : ""}</span></div>{admin&&<button className="icon-button" aria-label={`Edit ${a.responsibility}`} onClick={()=>setEditing(a)}><Pencil size={15}/></button>}</div>)}
    {editing&&<AssignmentEditor data={data} projectId={projectId} existing={editing==="new"?undefined:editing} close={()=>setEditing(null)} saved={refresh}/>}
  </section>;
}
