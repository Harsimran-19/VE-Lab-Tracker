"use client";
import { useState } from "react";
import { ArrowRight, ClipboardList, Eye, UserPlus } from "lucide-react";
import type { Person, Workspace } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { Modal } from "./modal";
import { mutate } from "./forms";

export function AddMember({ close, saved }: { close: () => void; saved: (person: Person) => Promise<void> }) {
  const [form,setForm] = useState({ name: "", email: "", role: "member" as Person["role"], affiliation: "" });
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [created,setCreated] = useState<Person|null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const person = created ?? (await mutate("/api/people", form)).person as Person;
      setCreated(person);
      await saved(person);
      close();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title="Add a lab member" close={close}>
    <form className="modal-body" onSubmit={submit}>
      <p className="form-intro">Add a new person or test account here. They do not need to exist in the original spreadsheet.</p>
      <label>Name<input required autoComplete="off" maxLength={150} disabled={Boolean(created)} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label>Google account email<input type="email" required autoComplete="off" disabled={Boolean(created)} placeholder="Their exact Google sign-in email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label>Role<select aria-label="Role" disabled={Boolean(created)} value={form.role} onChange={e=>setForm({...form,role:e.target.value as Person["role"]})}><option value="member">Member</option><option value="admin">Administrator</option></select><span className="field-help">{form.role==="member" ? "Sees assigned projects and submits progress updates." : "Manages members, project details, assignments, and all reports."}</span></label>
      <label>Affiliation <span className="optional">Optional</span><input maxLength={300} disabled={Boolean(created)} value={form.affiliation} onChange={e=>setForm({...form,affiliation:e.target.value})}/></label>
      <div className="member-login-note"><strong>Testing Google login?</strong><p>If your Google login app is in Testing, also add this email under <a href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noreferrer">Google Auth Platform → Audience → Test users</a>. Use a different Google account from your admin account for member testing.</p></div>
      {error&&<p className="error" role="alert">{created ? "The person was added, but the workspace could not refresh. " : ""}{error}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : created ? "Refresh workspace" : "Add member"}</button></div>
    </form>
  </Modal>;
}

export function PreviewMember({ data, close, preview }: { data: Workspace; close: () => void; preview: (personId: string) => Promise<void> }) {
  const members = data.people.filter(p=>p.role==="member");
  const [personId,setPersonId] = useState(members.find(p=>data.assignments.some(a=>a.personId===p.id))?.id ?? members[0]?.id ?? "");
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try { await preview(personId);close(); } catch(error) {setError((error as Error).message);} finally{setBusy(false);}
  }
  return <Modal title="Preview member view" close={close}><form className="modal-body" onSubmit={submit}>
    <p className="form-intro">See exactly which projects and responsibilities a member can access. You stay signed in as the administrator.</p>
    <label>Choose a member<select required value={personId} onChange={e=>setPersonId(e.target.value)}>{members.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <p className="preview-form-note">The preview is read-only. To test a real submission, sign in separately with the member’s Google account.</p>
    {!members.length&&<p className="error">Add a member first.</p>}{error&&<p className="error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="button secondary" type="button" onClick={close}>Cancel</button><button className="button primary" disabled={busy||!personId}><Eye size={16}/>{busy ? "Loading…" : "Open member preview"}</button></div>
  </form></Modal>;
}

export function AdminActions({ add, assign, preview }: { add:()=>void;assign:()=>void;preview:()=>void }) {
  return <section className="admin-actions" aria-label="Admin responsibilities">
    <div className="admin-actions-heading"><h2>As admin, you manage the lab.</h2><p>Start with a member, give them work, then check their experience.</p></div>
    <div className="admin-action-grid">
      <button onClick={add}><span className="action-icon"><UserPlus size={21}/></span><div><strong>1. Add members</strong><p>Approve a Google email and choose their role.</p></div><ArrowRight size={17}/></button>
      <button onClick={assign}><span className="action-icon"><ClipboardList size={21}/></span><div><strong>2. Assign work</strong><p>Choose their project and responsibility.</p></div><ArrowRight size={17}/></button>
      <button onClick={preview}><span className="action-icon"><Eye size={21}/></span><div><strong>3. Preview member view</strong><p>Check what they see before they sign in.</p></div><ArrowRight size={17}/></button>
    </div>
  </section>;
}

export function MemberHome({ data, report }: { data:Workspace;report:(assignmentId:string)=>void }) {
  const assignments = data.assignments.filter(a=>a.personId===data.identity.personId);
  if(!assignments.length) return <section className="panel member-welcome"><h2>No work assigned yet</h2><p>{data.preview ? "Return to admin, choose Assign work, and select this member. Their project and update form will then appear here." : "Your administrator needs to assign you a project and responsibility. You can then share progress from this page."}</p></section>;
  return <>
    <section className="member-welcome"><h2>Your job here: share progress on your assigned work.</h2><p>Choose a responsibility below, describe what changed, and ask for any help you need. Dates and your name are saved automatically.</p></section>
    <div className="member-work-grid">{assignments.map(a=>{
      const project=data.projects.find(p=>p.id===a.projectId);
      const latest=[...data.updates].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).find(u=>u.assignmentId===a.id);
      return <article className="panel member-work-card" key={a.id}>
        <div><span className="project-id">{a.projectId}</span><h2>{project?.name??a.projectId}</h2></div>
        <span className="work-label">YOUR RESPONSIBILITY</span><h3>{a.responsibility}</h3>
        <p><strong>Next milestone:</strong> {project?.milestone||"Your administrator has not set one yet."}</p>
        <div className="work-meta"><span>{a.due?`Due ${shortDate(a.due)}`:a.status}</span><span>{latest?`Last update ${shortDate(latest.createdAt)}`:"No update submitted yet"}</span></div>
        <button className="button primary" aria-label={`Write update for ${a.responsibility}`} onClick={()=>report(a.id)}>Write an update<ArrowRight size={16}/></button>
      </article>;
    })}</div>
  </>;
}
