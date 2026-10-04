"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import type { Workspace } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { Modal } from "./modal";
import { mutate } from "./forms";

export function EntryForm({data,initialAssignmentId,close,saved}:{data:Workspace;initialAssignmentId?:string;close:()=>void;saved:()=>Promise<void>}){
  const own=data.assignments.filter(a=>a.personId===data.identity.personId);
  const initial=own.find(a=>a.id===initialAssignmentId);
  const [projectId,setProjectId]=useState(initial?.projectId??own[0]?.projectId??"");
  const [assignmentId,setAssignmentId]=useState(initial?.id??own[0]?.id??"");
  const [newProjectName,setNewProjectName]=useState("");
  const [progress,setProgress]=useState("");const [blockers,setBlockers]=useState("");const [nextPlan,setNextPlan]=useState("");
  const [status,setStatus]=useState<string>("On track");const [entryId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [confirmed,setConfirmed]=useState(false);
  const relevant=own.filter(a=>a.projectId===projectId);
  const previous=[...data.updates].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).find(u=>u.assignmentId===assignmentId);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(data.preview)return;setBusy(true);setError("");
    try{
      if(!confirmed){await mutate("/api/entries",{entryId,projectId:projectId==="new"?"":projectId,newProjectName:projectId==="new"?newProjectName:"",assignmentId,progress,blockers,nextPlan,status});setConfirmed(true);}
      await saved();close();
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  return <Modal title="Add entry" close={close}><form className="modal-body entry-form" onSubmit={submit}>
    <p className="form-intro">Choose a project and share your progress. Your name and date are added automatically.</p>
    {data.preview&&<p className="preview-form-note" id="preview-entry-note">Read-only preview. Sign in with the member’s Google account to save a real entry.</p>}
    <fieldset disabled={busy||confirmed} className="entry-fields">
      <label>Project<select aria-label="Project" required value={projectId} onChange={e=>{setProjectId(e.target.value);setAssignmentId(own.find(a=>a.projectId===e.target.value)?.id??"");}}><option disabled value="">Choose a project</option><option value="new">+ Create a new project</option>{data.availableProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {projectId==="new"&&<label>Project name<input autoFocus required maxLength={150} placeholder="Name your project" value={newProjectName} onChange={e=>setNewProjectName(e.target.value)}/></label>}
      {relevant.length>1&&<label>Your work<select aria-label="Your work" value={assignmentId} onChange={e=>setAssignmentId(e.target.value)}>{relevant.map(a=><option key={a.id} value={a.id}>{a.responsibility}</option>)}</select></label>}
      {previous?.nextPlan&&<div className="previous-plan"><strong>Previously, you planned to…</strong><p>{previous.nextPlan}</p></div>}
      <label>Progress made<textarea required rows={4} maxLength={4000} placeholder="What did you work on or complete?" value={progress} onChange={e=>setProgress(e.target.value)}/></label>
      <fieldset className="status-field"><legend>Status</legend><div className="status-options">{STATUSES.map(s=><label key={s} className={status===s?"selected":""}><input type="radio" name="status" checked={status===s} onChange={()=>setStatus(s)}/>{s}</label>)}</div></fieldset>
      <label>Blockers or help needed <span className="optional">Optional</span><textarea rows={2} maxLength={2000} value={blockers} onChange={e=>setBlockers(e.target.value)}/></label>
      <label>Next step <span className="optional">Optional</span><input maxLength={2000} value={nextPlan} onChange={e=>setNextPlan(e.target.value)}/></label>
    </fieldset>
    {error&&<p className="error" role="alert">{confirmed?"Your entry is saved. Refresh to see it. ":""}{error}</p>}
    <div className="modal-actions"><button className="button secondary" type="button" onClick={close}>Cancel</button><button className="button primary" disabled={busy||Boolean(data.preview)} aria-describedby={data.preview?"preview-entry-note":undefined}><Send size={16}/>{data.preview?"Saving disabled in preview":busy?"Saving…":confirmed?"Refresh workspace":"Save entry"}</button></div>
  </form></Modal>;
}
