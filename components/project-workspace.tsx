"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, UserIcon, CircleIcon } from "@phosphor-icons/react";
import { STAGES, type Project, type Update, type Workspace } from "@/lib/types";
import { latestReports, shortDate } from "@/lib/format";
import { dayDifference } from "@/lib/calendar";
import type { ProjectAction } from "./forms";
import { ProjectContext } from "./project-details";

export function ProjectWorkspace({ project, data, busy, edit, saved, clearMilestone, reportCard }: {
  project: Project; data: Workspace; busy: boolean;
  edit: (action: ProjectAction) => void; saved: () => Promise<void>;
  clearMilestone: () => Promise<void>; reportCard: (u: Update) => ReactNode;
}) {
  const [tab, setTab] = useState("Overview");
  const [history, setHistory] = useState(false);
  const [limit, setLimit] = useState(12);
  const manager = data.identity.role === "admin";
  const lead = data.people.find((p) => p.id === project.leadId);
  const latest = latestReports(data.updates).filter((u) => u.projectId === project.id);
  const previous = data.updates.filter((u) => u.projectId === project.id && !latest.some((r) => r.id === u.id)).sort((a,b) => b.weekStart.localeCompare(a.weekStart));
  const members = data.memberships.filter((m) => m.projectId === project.id);
  const last = [...latest].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const management = manager && <details className="project-management"><summary>Manage project</summary><div className="management-actions">
    {project.state === "active" && <button className="button secondary" onClick={() => edit("pause")}>Pause project</button>}
    <button className="button secondary" onClick={() => edit(project.state === "active" ? "complete" : "reopen")}>{project.state === "active" ? "Complete project" : "Reopen project"}</button>
  </div></details>;

  return <div className="project-workspace">
    <div className="project-lead-line"><span>Lead: {lead ? <Link href={`/team/${lead.id}`} prefetch={false}>{lead.name}</Link> : "Unassigned"}</span>{project.priority && <span>Priority: {project.priority}</span>}{manager && project.state === "active" && <button className="text-action" onClick={() => edit("phase")}>Change phase</button>}</div>
    <ol className="research-timeline" aria-label="Research phase">{STAGES.map((stage) => <li key={stage} className={stage === project.phase ? "current" : ""} aria-current={stage === project.phase ? "step" : undefined}><CircleIcon size={20} weight={stage === project.phase ? "fill" : "regular"} className="timeline-dot" aria-hidden="true" /><span>{stage}</span></li>)}</ol>
    <div className="workspace-tabs" role="tablist" aria-label="Project sections">{["Overview", "Updates", "Resources", "People"].map((name) => <button key={name} id={`project-tab-${name}`} role="tab" aria-selected={tab === name} aria-controls={`project-panel-${name}`} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={(e) => { const tabs = ["Overview", "Updates", "Resources", "People"]; if (["ArrowRight","ArrowLeft","Home","End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? 3 : (tabs.indexOf(name) + (e.key === "ArrowRight" ? 1 : 3)) % 4; setTab(tabs[next]); document.getElementById(`project-tab-${tabs[next]}`)?.focus(); } }}>{name}{name === "Updates" && latest.length > 0 && <span className="tab-count">{latest.length}</span>}</button>)}</div>
    <section role="tabpanel" id={`project-panel-${tab}`} aria-labelledby={`project-tab-${tab}`}>
      {tab === "Overview" && <div className="project-overview-grid">
        <div>
          <section className="project-next-step"><p className="field-label">Next milestone</p><h2>{project.milestone || "No milestone set"}</h2>{project.due && <p className="milestone-date">Due {shortDate(project.due)}{project.state === "active" && dayDifference(project.due, data.today) < 0 ? " · Overdue" : ""}</p>}{manager && project.state === "active" && <div className="inline-actions"><button className="text-action" onClick={() => edit("milestone")}>{project.milestone ? "Edit milestone" : "Set milestone"}</button>{project.milestone && <button className="text-action muted" disabled={busy} onClick={() => { void clearMilestone(); }}>Remove milestone</button>}</div>}</section>
          <ProjectContext project={project} data={data} saved={saved} mode="responsibilities" />
        </div>
        <aside className="project-side-context">
          <ProjectContext project={project} data={data} saved={saved} mode="publication" />
          <section className="project-latest"><h2>Latest update</h2>{last ? <><p className="muted">{data.people.find((p) => p.id === last.personId)?.name || "Member"} · {shortDate(last.weekStart)}</p><p className="latest-excerpt">{last.progress}</p><button className="text-action" onClick={() => setTab("Updates")}>View updates <ArrowRightIcon size={15} aria-hidden="true" /></button></> : <p className="muted">Updates appear here as the team shares progress.</p>}</section>
          {management}
        </aside>
      </div>}
      {tab === "Updates" && <div className="project-updates"><div className="section-heading"><div><h2>{history ? "Earlier updates" : "Team updates"}</h2><p className="section-copy">{history ? "Previous weekly reports from this project." : "The latest weekly report from each member."}</p></div>{previous.length > 0 && <button className="button secondary" onClick={() => {setHistory(!history);setLimit(12);}}>{history ? "Latest updates" : "Earlier weeks"}</button>}</div><div className="update-feed">{(history ? previous : latest).slice(0,limit).map(reportCard)}{!(history ? previous : latest).length && <p className="quiet-empty">No updates shared yet.</p>}</div>{(history ? previous : latest).length > limit && <button className="button secondary load-more" onClick={() => setLimit(limit + 12)}>Load more updates</button>}</div>}
      {tab === "Resources" && <ProjectContext project={project} data={data} saved={saved} mode="resources" />}
      {tab === "People" && <div className="project-people"><section><h2>Project members</h2><div className="project-member-list">{members.map((m) => { const person = data.people.find((p) => p.id === m.personId); return <Link key={m.id} href={`/team/${m.personId}`} prefetch={false}><UserIcon size={26} aria-hidden="true" /><span><strong>{person?.name || "Member"}{m.personId === data.identity.personId ? " · You" : ""}</strong><small>{[person?.academicRole,person?.affiliation].filter(Boolean).join(" · ")}</small></span><ArrowRightIcon size={18} aria-hidden="true" /></Link>; })}{!members.length && <p className="quiet-empty">No members have joined yet.</p>}</div></section><ProjectContext project={project} data={data} saved={saved} mode="people" /></div>}
    </section>
  </div>;
}
