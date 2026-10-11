"use client";
import { useState } from "react";
import type { Workspace } from "@/lib/types";
import { reportDate } from "@/lib/format";

export function ConflictReview({ error, projectId, updateId, folderId, accept }: { error: string; projectId?: string; updateId?: string; folderId?: string; accept: (version: number) => void }) {
  const [latest, setLatest] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  if (!/latest version|while saving|could not be confirmed/.test(error)) return null;
  const project = latest?.projects.find(p => p.id === projectId);
  const update = latest?.updates.find(u => updateId === "new-report" ? u.projectId === projectId && u.personId === latest.identity.personId && u.weekStart === latest.weekStart : u.id === updateId);
  const folder = latest?.folders.find(f => f.id === folderId);
  return <div className="setup-section">
    <p>Your input is still in this form. Load the latest saved values before retrying.</p>
    {!latest && <button type="button" className="button secondary" disabled={busy} onClick={async () => {
      setBusy(true); setFailure("");
      try { const response = await fetch("/api/workspace", {cache:"no-store"}); const value = await response.json(); if (!response.ok) throw new Error(value.error); setLatest(value); } catch(e) { setFailure((e as Error).message); } finally { setBusy(false); }
    }}>{busy ? "Loading…" : "Review latest version"}</button>}
    {latest && <>
      {folderId ? folder ? <><p>{folder.name} · {folder.description || "No description"}</p><p>Contains {latest.projects.filter(p=>p.folderId===folder.id).length} projects. Removing the folder will keep these projects and make them ungrouped.</p></> : <p>This folder has been removed. Close this form and refresh the workspace.</p> : updateId ? update ? <><p><strong>Saved progress:</strong> {update.progress}</p><p><strong>Saved next step:</strong> {update.nextPlan}</p><p><strong>Help needed:</strong> {update.needsHelp === "true" ? update.blockers : "No"}</p><p><strong>Covered responsibilities:</strong> {update.workstreams?.map(w=>w.name).join("; ") || "None"}</p></> : <p>No weekly update is currently saved.</p> : project ? <><p><strong>{project.name}</strong> · {project.type || "Unclassified"} · {project.phase || "Phase not set"}</p><p>{project.goal}</p><p>Milestone: {project.milestone || "Not set"} · {project.due || "No due date"}</p><p>Lead: {latest.people.find(p => p.id === project.leadId)?.name || "Unassigned"}</p><p>Team: {latest.memberships.filter(m => m.projectId === project.id).map(m => `${latest.people.find(p => p.id === m.personId)?.name || "Member"}${m.supervisor ? " (Supervisor)" : ""}`).join("; ") || "Unassigned"}</p><details><summary>Review saved project details</summary><dl className="research-details">{Object.entries(project).filter(([key]) => !["id","version","updatedBy"].includes(key)).map(([key,value]) => <div key={key}><dt>{fieldLabels[key] ?? key.replace(/([A-Z])/g," $1")}</dt><dd>{savedValue(value, latest)}</dd></div>)}</dl></details>{project.updatedAt && <p>{reportDate(project.updatedAt,latest.settings.timezone)}</p>}</> : <p>This project is no longer available.</p>}
      {(!folderId || folder) && (folderId || project) && <button type="button" className="button secondary" onClick={() => {accept(folderId ? folder!.version : updateId ? update?.version ?? 0 : project?.version ?? 0); setLatest(null);}}>Use reviewed version and keep my input</button>}
    </>}
    {failure && <p className="error" role="alert">{failure}</p>}
  </div>;
}

const fieldLabels: Record<string,string> = { name:"Project name", goal:"Goal", phase:"Research phase", milestone:"Milestone", due:"Due date", state:"Project state", leadId:"Project lead", type:"Project type", folderId:"Folder", updatedAt:"Last updated", fullTitle:"Full title", priority:"Priority", methods:"Methods", publicationStatus:"Publication status", targetJournal:"Target journal", altJournal:"Alternative journal", targetConference:"Target conference", notes:"Notes", links:"Resources", workstreams:"Responsibilities", collaborators:"External collaborators", reporting:"Reporting relationships", researcherId:"Contributor", supervisorId:"Supervisor", ownerId:"Owner", archived:"Archived", email:"Email", contactVia:"Contact through" };
function savedValue(value:unknown,data:Workspace):string {
  if(value===undefined || value===null || value==="")return "Unassigned";
  if(typeof value==="boolean")return value ? "Yes" : "No";
  if(typeof value==="string")return data.people.find(p=>p.id===value)?.name ?? data.folders.find(f=>f.id===value)?.name ?? value;
  if(Array.isArray(value))return value.map(v=>savedValue(v,data)).join("; ") || "None";
  if(typeof value==="object")return Object.entries(value).filter(([key])=>key!=="id").map(([key,v])=>`${fieldLabels[key] ?? key}: ${savedValue(v,data)}`).join(", ");
  return String(value);
}
