"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CalendarBlankIcon, CheckCircleIcon, UserIcon } from "@phosphor-icons/react";
import type { Workspace, Workstream } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { localDateTime } from "@/lib/calendar";
import { Modal } from "./modal";

export function HomePage({ data, busy, writeUpdate, createProject, changeStatus }: {
  data: Workspace;
  busy: boolean;
  writeUpdate: (projectId: string) => void;
  createProject: () => void;
  changeStatus: (projectId: string, workstreamId: string, status: Workstream["status"]) => Promise<void>;
}) {
  const [chooseProject, setChooseProject] = useState(false);
  const manager = data.identity.role === "admin";
  const active = data.projects.filter((p) => p.state === "active");
  const ownIds = new Set(data.memberships.filter((m) => m.personId === data.identity.personId).map((m) => m.projectId));
  const ownProjects = active.filter((p) => ownIds.has(p.id));
  const projects = manager && !ownProjects.length ? active : ownProjects;
  const current = data.updates.filter((u) => u.weekStart === data.weekStart);
  const reported = (projectId: string, personId = data.identity.personId) => current.some((u) => u.projectId === projectId && u.personId === personId);
  const pending = ownProjects.filter((p) => !reported(p.id));
  const responsibilities = active.flatMap((p) => (p.workstreams ?? [])
    .filter((w) => !w.archived && w.ownerId === data.identity.personId)
    .map((w) => ({ ...w, projectId: p.id, projectName: p.name })))
    .sort((a, b) => Number(a.status === "Done") - Number(b.status === "Done") || (a.due || "9999").localeCompare(b.due || "9999"));
  const date = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.today}T12:00:00Z`));
  const dueDay = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }).format(new Date(`${data.reportingDue.date}T12:00:00Z`));
  const allSubmitted = ownProjects.length > 0 && pending.length === 0;

  function openUpdate() {
    if (ownProjects.length === 1) writeUpdate(ownProjects[0].id);
    else setChooseProject(true);
  }

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-heading">
        <Image src="/images/home-week-artwork.png" alt="" width={1983} height={793} unoptimized preload className="home-hero-artwork" />
        <div className="home-hero-copy">
          <h1 id="home-heading">Your week</h1>
          <p>{date}</p>
        </div>
      </section>

      <section className="home-report-banner" aria-label="Weekly reporting">
        {allSubmitted ? <CheckCircleIcon size={26} aria-hidden="true" /> : <CalendarBlankIcon size={26} aria-hidden="true" />}
        <div>
          <h2>{allSubmitted ? "Your updates are up to date" : ownProjects.length ? data.reportingDue.passed ? "Your weekly update is due" : `Your update is due ${dueDay}` : manager ? "This week in the lab" : "Find your next project"}</h2>
          <p>{ownProjects.length ? allSubmitted ? "You can edit your updates until the reporting week closes." : `Share progress on your project work. Due ${shortDate(data.reportingDue.date)} at ${data.reportingDue.time} (${data.settings.timezone}).` : manager ? `Team updates are due ${shortDate(data.reportingDue.date)} at ${data.reportingDue.time} (${data.settings.timezone}).` : "Join the projects you work on to share progress with the team."}</p>
        </div>
        {ownProjects.length ? <button className="home-primary" onClick={openUpdate}>{allSubmitted ? "Edit an update" : "Write an update"}</button> : <Link className="home-primary" href={manager && active.length ? "#lab-reporting" : "/projects"}>{manager && active.length ? "View reporting" : "Browse projects"}</Link>}
      </section>

      <section className="home-section" aria-labelledby="home-projects-heading">
        <div className="home-section-heading">
          <h2 id="home-projects-heading">{manager && !ownProjects.length ? "Lab projects" : "Your projects"}</h2>
          <Link href="/projects" prefetch={false}>View all projects <ArrowRightIcon size={16} aria-hidden="true" /></Link>
        </div>
        {projects.length ? (
          <div className="home-table-wrap">
            <table className="home-project-table">
              <thead><tr><th>Project</th><th>Phase</th><th>Next milestone</th><th>Due date</th><th><span className="sr-only">Open project</span></th></tr></thead>
              <tbody>{projects.slice(0, 6).map((p) => <tr key={p.id}>
                <td><Link href={`/projects/${p.id}`} prefetch={false} className="home-project-name">{p.name}</Link></td>
                <td><span className="home-phase">{p.phase}</span></td>
                <td>{p.milestone || <span className="home-muted">No milestone set</span>}</td>
                <td className="home-date">{p.due ? shortDate(p.due) : <span className="home-muted">No due date</span>}</td>
                <td><Link href={`/projects/${p.id}`} prefetch={false} className="home-row-link" aria-label={`Open ${p.name}`}><ArrowRightIcon size={20} aria-hidden="true" /></Link></td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <div className="home-empty"><h3>{manager ? "Start with your first project" : "You haven’t joined a project yet"}</h3><p>{manager ? "Give your research a clear goal and a next milestone." : "Open Projects and join the research you are working on."}</p>{manager ? <button className="home-primary" onClick={createProject}>Create project</button> : <Link className="home-primary" href="/projects">Explore projects</Link>}</div>}
      </section>

      <section className="home-section" aria-labelledby="home-responsibilities-heading">
        <div className="home-section-heading"><h2 id="home-responsibilities-heading">Your responsibilities</h2></div>
        {responsibilities.length ? <ul className="home-responsibilities">
          {responsibilities.map((w) => <li key={w.id} className={w.status === "Done" ? "is-done" : ""}>
            <label className="home-task"><input type="checkbox" checked={w.status === "Done"} disabled={busy} aria-label={`Mark ${w.name} ${w.status === "Done" ? "in progress" : "done"}`} onChange={(e) => { void changeStatus(w.projectId, w.id, e.target.checked ? "Done" : "In progress"); }} /><span>{w.name}</span></label>
            <Link href={`/projects/${w.projectId}`} prefetch={false}>{w.projectName}</Link>
            <span className="home-date">{w.due ? shortDate(w.due) : <span className="home-muted">No due date</span>}</span>
            {w.status === "Blocked" && <span className="home-blocked">Blocked</span>}
          </li>)}
        </ul> : <p className="home-empty-line">No responsibilities assigned to you yet. Project owners can add them in the project workspace.</p>}
      </section>

      {manager && active.length > 0 && <details className="home-reporting" id="lab-reporting">
        <summary>Lab reporting <span>{current.length} {current.length === 1 ? "update" : "updates"} shared this week</span></summary>
        <p className="home-muted">One update per person, per project. Members joining after the deadline start reporting next week.</p>
        <ul>{active.map((p) => {
          const members = data.memberships.filter((m) => m.projectId === p.id && (localDateTime(new Date(m.joinedAt), data.settings.timezone) <= `${data.reportingDue.date}T${data.reportingDue.time}` || reported(p.id, m.personId)));
          const missing = members.filter((m) => !reported(p.id, m.personId));
          const helping = current.filter((u) => u.projectId === p.id && u.needsHelp === "true");
          return <li key={p.id}><Link href={`/projects/${p.id}`} prefetch={false}>{p.name}</Link><span>{members.length - missing.length}/{members.length} shared</span><span className="home-muted">{helping.length ? `${helping.length} needing help` : missing.length ? `${missing.length} ${data.reportingDue.passed ? "missing" : "awaited"}` : members.length ? "Up to date" : "No reports expected"}</span></li>;
        })}</ul>
      </details>}

      {chooseProject && <Modal title={allSubmitted ? "Edit a weekly update" : "Choose a project"} close={() => setChooseProject(false)}>
        <p className="home-chooser-help">One update covers your work on each project this week.</p>
        <div className="home-project-chooser">{ownProjects.map((p) => <button key={p.id} onClick={() => { setChooseProject(false); writeUpdate(p.id); }}><UserIcon size={20} aria-hidden="true" /><span><strong>{p.name}</strong><small>{reported(p.id) ? "Update shared · Edit" : "Write this week’s update"}</small></span><ArrowRightIcon size={18} aria-hidden="true" /></button>)}</div>
      </Modal>}
    </div>
  );
}
