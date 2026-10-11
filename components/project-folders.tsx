"use client";
import { useState } from "react";
import { FolderIcon, ArrowRightIcon, PlusIcon } from "@phosphor-icons/react";
import type { Folder, Project, Workspace } from "@/lib/types";
import { PROJECT_TYPES } from "@/lib/types";
import { canManageProject } from "@/lib/access";
import { Modal } from "./modal";
import { mutate } from "./forms";
import { ConflictReview } from "./conflict-review";

export function ProjectClassification({project,data,saved}: {project:Project;data:Workspace;saved:()=>Promise<void>}) {
  const [open,setOpen]=useState(false);
  return <section className="project-latest project-organization"><h2>Project organization</h2><p>Type: {project.type || "Unclassified"}</p><p>Folder: {data.folders.find(f=>f.id===project.folderId)?.name || "Ungrouped"}</p>{canManageProject(data,data.identity,project) && <button className="text-action" onClick={()=>setOpen(true)}>Change type or folder</button>}{open && <ClassificationEditor project={project} data={data} saved={saved} close={()=>setOpen(false)}/>}</section>;
}
function ClassificationEditor({project,data,saved,close}: {project:Project;data:Workspace;saved:()=>Promise<void>;close:()=>void}) {
  const [type,setType]=useState(project.type ?? ""),[folderId,setFolderId]=useState(project.folderId ?? ""),[version,setVersion]=useState(project.version ?? 0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[confirmed,setConfirmed]=useState(false);
  return <Modal title="Change type or folder" close={close}><form className="modal-body" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{if(!confirmed){await mutate("/api/projects",{id:project.id,action:"classification",type,folderId,expectedVersion:version},"PATCH");setConfirmed(true);}await saved();close();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><fieldset className="entry-fields" disabled={busy || confirmed}><label>Project type<select aria-label="Project type" value={type} onChange={e=>setType(PROJECT_TYPES.find(t=>t===e.target.value) ?? "")}><option value="">Unclassified</option>{PROJECT_TYPES.map(t=><option key={t}>{t}</option>)}</select></label><label>Folder<select aria-label="Folder" value={folderId} onChange={e=>setFolderId(e.target.value)}><option value="">Ungrouped</option>{data.folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><p className="field-help">Changing type or folder preserves the project’s content, phases, team and history.</p></fieldset>{error && <p className="error" role="alert">{error}</p>}<ConflictReview error={error} projectId={project.id} accept={v=>{setVersion(v);setError("");}}/><div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : confirmed ? "Refresh workspace" : "Save project"}</button></div></form></Modal>;
}
export function ProjectFolders({data,saved,browse,selected}: {data:Workspace;saved:()=>Promise<void>;browse:(id:string)=>void;selected:string}) {
  const [editor,setEditor]=useState<{folder?:Folder} | null>(null);
  const manager=data.identity.role==="admin";
  return <section className="folder-browser" aria-labelledby="folders-heading">
    <div className="section-heading"><div><h2 id="folders-heading">Folders</h2><p className="section-copy">Group related projects together. Each project keeps its own team, updates and history.</p></div>{manager && <button className="button secondary" onClick={()=>setEditor({})}><PlusIcon size={16} aria-hidden="true"/>Create folder</button>}</div>
    {!data.folders.length && <p className="folder-empty">No folders yet. {manager ? "Create a folder, then open a project and choose Change type or folder to add it." : "Ask the lab manager to create a folder. Project leads and supervisors can add their projects to it."}</p>}
    <div className="folder-grid">{data.folders.map(f=><article className={`folder-card ${selected===f.id ? "is-selected" : ""}`} key={f.id}>
      <button className="folder-browse" aria-pressed={selected===f.id} onClick={()=>browse(selected===f.id ? "" : f.id)} aria-label={`Browse folder ${f.name}`}><FolderIcon size={28} aria-hidden="true"/><span><strong>{f.name}</strong><span>{data.projects.filter(p=>p.folderId===f.id).length} projects</span></span><ArrowRightIcon size={20} aria-hidden="true"/></button>
      {f.description && <p className="folder-description">{f.description}</p>}{manager && <button className="text-action folder-edit" aria-label={`Edit folder ${f.name}`} onClick={()=>setEditor({folder:f})}>Edit folder</button>}
    </article>)}</div>
    <button className="text-action" aria-pressed={selected==="ungrouped"} onClick={()=>browse(selected==="ungrouped" ? "" : "ungrouped")}>Browse ungrouped projects ({data.projects.filter(p=>!p.folderId).length})</button>
    {!!data.folders.length && <p className="field-help">To move a project into a folder, its lead, a supervisor or the lab manager can open the project and choose Change type or folder.</p>}
    {editor && <FolderEditor folder={editor.folder} data={data} saved={saved} close={()=>setEditor(null)}/>}
  </section>;
}
function FolderEditor({folder,data,saved,close}: {folder?:Folder;data:Workspace;saved:()=>Promise<void>;close:()=>void}) {
  const [id]=useState(folder?.id ?? crypto.randomUUID());const [name,setName]=useState(folder?.name ?? ""),[description,setDescription]=useState(folder?.description ?? ""),[version,setVersion]=useState(folder?.version ?? 0),[remove,setRemove]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[confirmed,setConfirmed]=useState(false);
  const count=data.projects.filter(p=>p.folderId===id).length;
  return <Modal title={folder ? "Edit folder" : "Create folder"} close={close}><form className="modal-body" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{if(!confirmed){await mutate("/api/folders",{id,expectedVersion:version,...(remove ? {action:"remove"} : {action:"save",name,description})},"PATCH");setConfirmed(true);}await saved();close();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><fieldset className="entry-fields" disabled={busy || confirmed}>{remove ? <p>Remove <strong>{folder?.name}</strong>? Its {count} {count===1 ? "project will" : "projects will"} become ungrouped. All projects, teams, reports and history will remain.</p> : <><label>Folder name<input required maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label><label>Description <span className="optional-label">Optional</span><textarea maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)}/></label>{folder && <button type="button" className="button danger" onClick={()=>setRemove(true)}>Remove folder</button>}</>}</fieldset>{error && <p className="error" role="alert">{error}</p>}<ConflictReview error={error} folderId={id} accept={v=>{setVersion(v);setError("");}}/><div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className={`button ${remove ? "danger" : "primary"}`} disabled={busy}>{busy ? "Saving…" : confirmed ? "Refresh workspace" : remove ? "Confirm removal" : "Save folder"}</button></div></form></Modal>;
}
