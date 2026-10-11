import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import type { Project, Workspace } from "@/lib/types";
import { shortDate } from "@/lib/format";

export function ProjectTable({ projects, data, showLead = true }: { projects: Project[]; data: Workspace; showLead?: boolean }) {
  return <div className="directory-table-wrap"><table className="directory-table project-table">
    <thead><tr><th>Project</th>{showLead && <th>Lead and supervisors</th>}<th>Phase</th><th>Next milestone</th><th>Due date</th><th><span className="sr-only">Open project</span></th></tr></thead>
    <tbody>{projects.map((p) => <tr key={p.id}>
      <td data-label="Project"><Link className="directory-name" href={`/projects/${encodeURIComponent(p.id)}`} prefetch={false}>{p.name}</Link><small className="project-row-meta muted">{p.type || "Unclassified"}{p.folderId && ` · ${data.folders.find(f=>f.id===p.folderId)?.name || "Ungrouped"}`}</small></td>
      {showLead && <td data-label="Lead and supervisors">{data.people.find((person) => person.id === p.leadId)?.name || <span className="muted">Unassigned</span>}<small className="project-row-meta muted">Supervisors: {data.memberships.filter(m=>m.projectId===p.id && m.supervisor).map(m=>data.people.find(person=>person.id===m.personId)?.name || "Member").join(" · ") || "Unassigned"}</small></td>}
      <td data-label="Phase"><span className="home-phase">{p.state === "completed" ? "Completed" : p.state === "on-hold" ? "Paused" : p.phase || "Not set"}</span></td>
      <td data-label="Next milestone">{p.milestone || <span className="muted">No milestone set</span>}</td>
      <td data-label="Due date" className="directory-date">{p.due ? shortDate(p.due) : <span className="muted">—</span>}</td>
      <td><Link className="home-row-link" href={`/projects/${encodeURIComponent(p.id)}`} prefetch={false} aria-label={`Open ${p.name}`}><ArrowRightIcon size={20} aria-hidden="true" /></Link></td>
    </tr>)}</tbody>
  </table></div>;
}
