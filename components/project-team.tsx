"use client";
import { useState } from "react";
import Link from "next/link";
import type { Membership, Project, Workspace } from "@/lib/types";
import { canManageProject } from "@/lib/access";
import { Modal } from "./modal";
import { mutate } from "./forms";
import { ConflictReview } from "./conflict-review";

export function ProjectTeam({ project, data, saved }: {project: Project; data: Workspace; saved: () => Promise<void>}) {
  const members = data.memberships.filter(m => m.projectId === project.id);
  const manage = canManageProject(data, data.identity, project);
  const [editor, setEditor] = useState<{member?: Membership; reporting?: boolean} | null>(null);
  const research = project.type === "Research";
  return <section>
    <div className="section-heading"><h2>Project team</h2>{manage && <button className="button secondary small-button" onClick={() => setEditor({})}>Add member</button>}</div>
    <p className="section-copy">{research ? "Researchers" : "Contributors"} can edit project details and progress. The lead, supervisors and lab manager can manage the team.</p>
    {members.length ? <div className="directory-table-wrap"><table className="directory-table"><thead><tr><th>Member</th><th>Responsibilities</th><th>Reports to</th>{manage && <th>Manage</th>}</tr></thead><tbody>{members.map(m => {
      const person = data.people.find(p => p.id === m.personId);
      const supervisors = (project.reporting ?? []).filter(r => r.researcherId === m.personId).map(r => data.people.find(p => p.id === r.supervisorId)?.name || "Member");
      return <tr key={m.id}><td data-label="Member"><Link className="directory-name" href={`/team/${encodeURIComponent(m.personId)}`} prefetch={false}>{person?.name || "Member"}</Link></td><td data-label="Responsibilities">{[project.leadId === m.personId ? research ? "Lead researcher" : "Project lead" : "", m.contributor !== false ? research ? "Researcher" : "Contributor" : "", m.supervisor ? "Supervisor" : ""].filter(Boolean).join(" · ")}</td><td data-label="Reports to">{m.contributor !== false ? supervisors.join(" · ") || <span className="muted">Supervisor not assigned</span> : "—"}</td>{manage && <td className="project-team-actions" data-label="Manage"><div className="inline-actions"><button className="text-action" aria-label={`Edit ${person?.name || "member"}`} onClick={() => setEditor({member:m})}>Edit member</button>{m.contributor !== false && <button className="text-action" aria-label={`Set supervisors for ${person?.name || "member"}`} onClick={() => setEditor({member:m,reporting:true})}>Set supervisors</button>}</div></td>}</tr>;
    })}</tbody></table></div> : <p className="quiet-empty">No members assigned.</p>}
    {editor && <TeamEditor project={project} data={data} member={editor.member} reporting={editor.reporting} close={() => setEditor(null)} saved={saved} />}
  </section>;
}
function TeamEditor({project,data,member,reporting,close,saved}: {project:Project;data:Workspace;member?:Membership;reporting?:boolean;close:()=>void;saved:()=>Promise<void>}) {
  const [personId,setPersonId] = useState(member?.personId ?? "");
  const [contributor,setContributor] = useState(member?.contributor !== false);
  const [supervisor,setSupervisor] = useState(member?.supervisor ?? false);
  const [supervisorIds,setSupervisorIds] = useState((project.reporting ?? []).filter(r=>r.researcherId === member?.personId).map(r=>r.supervisorId));
  const [action,setAction] = useState(reporting ? "reporting" : member ? "responsibilities" : "add");
  const [replacementLeadId,setReplacementLeadId] = useState("");
  const [version,setVersion] = useState(project.version ?? 0);
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [confirmed,setConfirmed] = useState(false);
  const members=data.memberships.filter(m=>m.projectId===project.id);
  const choices=data.people.filter(p=>!members.some(m=>m.personId===p.id));
  const affected=(project.reporting ?? []).filter(r=>(r.researcherId===personId && (!contributor || action==="remove")) || (r.supervisorId===personId && (!supervisor || action==="remove"))).length;
  const name=data.people.find(p=>p.id===personId)?.name || "this member";
  async function submit(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError("");
    try {
      if (!confirmed) {
        const body = action === "reporting" ? {researcherId:personId,supervisorIds} : action === "remove" ? {personId,replacementLeadId} : action === "lead" ? {personId} : {personId,contributor,supervisor};
        await mutate("/api/project-team",{projectId:project.id,action,...body,expectedVersion:version},"PATCH");setConfirmed(true);
      }
      await saved();close();
    } catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <Modal title={reporting ? "Set supervisors" : member ? "Edit team member" : "Add member"} close={close}><form className="modal-body" onSubmit={submit}><fieldset className="entry-fields" disabled={busy || confirmed}>
    {!member && <label>Lab member<select aria-label="Lab member" required value={personId} onChange={e=>setPersonId(e.target.value)}><option value="">Choose a person</option>{choices.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {member && <p><strong>{name}</strong></p>}
    {action === "reporting" ? <><p className="section-copy">Choose this contributor’s supervisors. These relationships apply only to this project.</p>{members.filter(m=>m.supervisor && m.personId!==personId).map(m=><label className="check-label" key={m.id}><input type="checkbox" checked={supervisorIds.includes(m.personId)} onChange={e=>setSupervisorIds(e.target.checked ? [...supervisorIds,m.personId] : supervisorIds.filter(id=>id!==m.personId))}/>{data.people.find(p=>p.id===m.personId)?.name || "Member"}</label>)}{!members.some(m=>m.supervisor && m.personId!==personId) && <p className="quiet-empty">Add a supervisor to this project first.</p>}</> : action === "remove" ? <><p>Remove {name} from this project? Their reports, work and activity history will remain. They will lose editing access until they join again.</p>{project.leadId===personId && <label>Replacement lead<select aria-label="Replacement lead" required value={replacementLeadId} onChange={e=>setReplacementLeadId(e.target.value)}><option value="">Choose a project member</option>{members.filter(m=>m.personId!==personId).map(m=><option key={m.id} value={m.personId}>{data.people.find(p=>p.id===m.personId)?.name || "Member"}</option>)}</select></label>}</> : action === "lead" ? <p>Make {name} the designated {project.type==="Research" ? "lead researcher" : "project lead"}?</p> : <><label className="check-label"><input type="checkbox" checked={contributor} onChange={e=>setContributor(e.target.checked)}/>{project.type==="Research" ? "Researcher" : "Contributor"}</label><label className="check-label"><input type="checkbox" checked={supervisor} onChange={e=>setSupervisor(e.target.checked)}/>Supervisor</label></>}
    {affected>0 && <p className="section-copy">Saving will remove {affected} reporting {affected===1 ? "relationship" : "relationships"}: {(project.reporting ?? []).filter(r=>(r.researcherId===personId && (!contributor || action==="remove")) || (r.supervisorId===personId && (!supervisor || action==="remove"))).map(r=>`${data.people.find(p=>p.id===r.researcherId)?.name || "Member"} reports to ${data.people.find(p=>p.id===r.supervisorId)?.name || "Member"}`).join("; ")}.</p>}
    {member && !reporting && action === "responsibilities" && <div className="inline-actions">{project.leadId!==personId && <button type="button" className="button secondary" onClick={()=>setAction("lead")}>Designate lead</button>}<button type="button" className="button danger" onClick={()=>setAction("remove")}>Remove member</button></div>}
    </fieldset>{error && <p className="error" role="alert">{confirmed ? "Saved. " : ""}{error}</p>}<ConflictReview error={error} projectId={project.id} accept={v=>{setVersion(v);setError("");}}/><div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className={`button ${action==="remove" ? "danger" : "primary"}`} disabled={busy}>{busy ? "Saving…" : confirmed ? "Refresh workspace" : action==="remove" ? "Confirm removal" : "Save team"}</button></div></form></Modal>;
}
