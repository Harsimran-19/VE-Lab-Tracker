"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, CircleIcon } from "@phosphor-icons/react";
import { STAGES, type Project, type Update, type Workspace } from "@/lib/types";
import { latestReports, shortDate } from "@/lib/format";
import { dayDifference } from "@/lib/calendar";
import type { ProjectAction } from "./forms";
import { canEditProject, canManageProject, isApproved } from "@/lib/access";
import { ProjectTeam } from "./project-team";
import { ProjectActivity } from "./project-activity";
import { ProjectClassification } from "./project-folders";
import { reportDate } from "@/lib/format";
import { ProjectContext } from "./project-details";
import { ApprovalPanel, ProjectAttributes } from "./project-governance";
import { ProjectOutputs } from "./project-outputs";
import { HoursSummary } from "./weekly-report";
import { ProjectFormRequests } from "./form-requests";

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");
export function ProjectWorkspace({ project, data, busy, edit, saved, clearMilestone, reportCard }: {
  project: Project; data: Workspace; busy: boolean;
  edit: (action: ProjectAction) => void; saved: () => Promise<void>;
  clearMilestone: () => Promise<void>; reportCard: (u: Update) => ReactNode;
}) {
  const [tab, setTab] = useState("Overview");
  const [history, setHistory] = useState(false);
  const [limit, setLimit] = useState(12);
  const manager = canEditProject(data, data.identity, project);
  const manage = canManageProject(data,data.identity,project);
  const tabs = ["Overview", "Updates", "Data & outputs", "Resources", "People", "Activity"];
  const lead = data.people.find((p) => p.id === project.leadId);
  const supervisors = data.memberships.filter(m=>m.projectId===project.id && m.supervisor).map(m=>data.people.find(p=>p.id===m.personId));
  const latest = latestReports(data.updates).filter((u) => u.projectId === project.id);
  const previous = data.updates.filter((u) => u.projectId === project.id && !latest.some((r) => r.id === u.id)).sort((a,b) => b.weekStart.localeCompare(a.weekStart));
  const lastChange = data.activities.findLast(a=>a.projectId===project.id);
  const last = [...latest].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const management = manage && <details className="project-management"><summary>Manage project</summary><div className="management-actions">
    {project.state === "active" && <button className="button secondary" onClick={() => edit("pause")}>Pause project</button>}
    <button className="button secondary" onClick={() => edit(project.state === "active" ? "complete" : "reopen")}>{project.state === "active" ? "Complete project" : "Reopen project"}</button>
  </div></details>;

  return <div className="project-workspace">
    <ApprovalPanel project={project} data={data} saved={saved} />
    <div id="form-requests"><ProjectFormRequests project={project} data={data} saved={saved} /></div>
    <section className="project-access" aria-label="Your project access">
      <div><h2>{manager ? "You can edit this project" : "Join the team to edit this project"}</h2><p>{manager ? "Edit details, resources, milestones and responsibilities. Your changes are shared with the team and recorded in Activity." : !isApproved(project) ? "This project is waiting for approval. Its lead can add you to the team." : project.state === "active" ? "Choose Join project above to become a contributor. You can then edit details and progress alongside the other members." : "This project is not active. Ask its lead or the lab manager about joining."}</p><p>Team: {data.memberships.filter(m=>m.projectId===project.id).map(m=>data.people.find(p=>p.id===m.personId)?.name || "Member").join(" · ") || "No members yet"}</p>{manage && <p>You can also manage members, supervisors and the project’s folder.</p>}</div>
      <button className="button secondary" onClick={()=>setTab("People")}>View project team</button>
    </section>
    <div className="project-lead-line"><span>{project.type === "Research" ? "Lead researcher" : "Project lead"}: {lead ? <Link href={`/team/${lead.id}`} prefetch={false}>{lead.name}</Link> : "Unassigned"}</span><span>Supervisors: {supervisors.length ? supervisors.map((person,i)=><span key={i}>{i>0 && " · "}{person ? <Link href={`/team/${person.id}`} prefetch={false}>{person.name}</Link> : "Unassigned"}</span>) : "Unassigned"}</span>{project.priority && <span>Priority: {project.priority}</span>}{manager && project.state === "active" && <button className="text-action" onClick={() => edit("phase")}>Change phase</button>}</div>
    {project.phase && STAGES.some(stage=>stage===project.phase) ? <ol className="research-timeline" aria-label="Project phase">{STAGES.map((stage) => <li key={stage} className={stage === project.phase ? "current" : ""} aria-current={stage === project.phase ? "step" : undefined}><CircleIcon size={20} weight={stage === project.phase ? "fill" : "regular"} className="timeline-dot" aria-hidden="true" /><span>{stage}</span></li>)}</ol> : <p className="section-copy">{project.phase ? `Current phase: ${project.phase}` : "Project phase not set."}</p>}
    {project.updatedAt && <p className="section-copy">Last updated by {lastChange?.actorName || data.people.find(p=>p.id===project.updatedBy)?.name || "Former member"} · <time dateTime={project.updatedAt} title={project.updatedAt}>{reportDate(project.updatedAt,data.settings.timezone)}</time></p>}
    <div className="workspace-tabs" role="tablist" aria-label="Project sections">{tabs.map((name) => <button key={name} id={`project-tab-${slug(name)}`} role="tab" aria-selected={tab === name} aria-controls={`project-panel-${slug(name)}`} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={(e) => { if (["ArrowRight","ArrowLeft","Home","End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length-1 : (tabs.indexOf(name) + (e.key === "ArrowRight" ? 1 : tabs.length-1)) % tabs.length; setTab(tabs[next]); document.getElementById(`project-tab-${slug(tabs[next])}`)?.focus(); } }}>{name}{name === "Updates" && latest.length > 0 && <span className="tab-count">{latest.length}</span>}</button>)}</div>
    <section role="tabpanel" id={`project-panel-${slug(tab)}`} aria-labelledby={`project-tab-${slug(tab)}`}>
      {tab === "Overview" && <div className="project-overview-grid">
        <div>
          <ProjectContext project={project} data={data} saved={saved} mode="resources" />
          <section className="project-next-step"><p className="field-label">Next milestone</p><h2>{project.milestone || "No milestone set"}</h2>{project.due && <p className="milestone-date">Due {shortDate(project.due)}{project.state === "active" && dayDifference(project.due, data.today) < 0 ? " · Overdue" : ""}</p>}{manager && project.state === "active" && <div className="inline-actions"><button className="text-action" onClick={() => edit("milestone")}>{project.milestone ? "Edit milestone" : "Set milestone"}</button>{project.milestone && <button className="text-action muted" disabled={busy} onClick={() => { void clearMilestone(); }}>Remove milestone</button>}</div>}</section>
          <ProjectContext project={project} data={data} saved={saved} mode="responsibilities" />
        </div>
        <aside className="project-side-context">
          <ProjectClassification project={project} data={data} saved={saved} />
          <ProjectAttributes project={project} data={data} saved={saved} />
          <ProjectContext project={project} data={data} saved={saved} mode="publication" />
          <section className="project-latest"><h2>Latest update</h2>{last ? <><p className="muted">{data.people.find((p) => p.id === last.personId)?.name || "Member"} · {shortDate(last.weekStart)}</p><p className="latest-excerpt">{last.progress}</p><button className="text-action" onClick={() => setTab("Updates")}>View updates <ArrowRightIcon size={15} aria-hidden="true" /></button></> : <p className="muted">Updates appear here as the team shares progress.</p>}</section>
          {management}
        </aside>
      </div>}
      {tab === "Updates" && <div className="project-updates"><HoursSummary project={project} data={data} /><div className="section-heading"><div><h2>{history ? "Earlier updates" : "Team updates"}</h2><p className="section-copy">{history ? "Previous weekly reports from this project." : "The latest weekly report from each member."}</p></div>{previous.length > 0 && <button className="button secondary" onClick={() => {setHistory(!history);setLimit(12);}}>{history ? "Latest updates" : "Earlier weeks"}</button>}</div><div className="update-feed">{(history ? previous : latest).slice(0,limit).map(reportCard)}{!(history ? previous : latest).length && <p className="quiet-empty">No updates shared yet.</p>}</div>{(history ? previous : latest).length > limit && <button className="button secondary load-more" onClick={() => setLimit(limit + 12)}>Load more updates</button>}</div>}
      {tab === "Data & outputs" && <ProjectOutputs project={project} data={data} saved={saved} />}
      {tab === "Resources" && <ProjectContext project={project} data={data} saved={saved} mode="resources" />}
      {tab === "People" && <div className="project-people"><ProjectTeam project={project} data={data} saved={saved} /><ProjectContext project={project} data={data} saved={saved} mode="people" /></div>}
      {tab === "Activity" && <ProjectActivity key={project.id} project={project} data={data} />}

    </section>
  </div>;
}
