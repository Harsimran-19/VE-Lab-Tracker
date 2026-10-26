"use client";
import Link from "next/link";
import type { Workspace } from "@/lib/types";
import { isApproved, isLive } from "@/lib/access";
import { membershipJoinedBefore } from "@/lib/calendar";
import { latestReports, reportDate, shortDate } from "@/lib/format";

export function AdminDashboard({ data }: { data: Workspace }) {
  if (data.identity.role !== "admin") return null;
  const live = data.projects.filter(isLive);
  const help = latestReports(data.updates).filter(u => u.needsHelp === "true" && live.some(p => p.id === u.projectId));
  const logins = [...data.people].sort((a, b) => (data.logins.find(l => l.id === b.id)?.at || "").localeCompare(data.logins.find(l => l.id === a.id)?.at || "") || a.name.localeCompare(b.name));
  return <section className="home-section admin-dashboard" aria-label="Admin dashboard"><div className="home-section-heading"><h2>Lab dashboard</h2><Link href="/team">Manage lab members →</Link></div>
    <dl className="dashboard-metrics"><div><dt>Active projects</dt><dd>{live.length}</dd></div><div><dt>Awaiting approval</dt><dd>{data.projects.filter(p => p.approval === "pending").length}</dd></div><div><dt>Help requests</dt><dd>{help.length}</dd></div><div><dt>Open form requests</dt><dd>{data.projects.flatMap(p => p.formRequests ?? []).filter(r => !r.completedAt).length}</dd></div></dl>
    <div className="directory-table-wrap"><table className="directory-table"><caption>Progress across all projects</caption><thead><tr><th>Project</th><th>State</th><th>Project phase</th><th>Tasks completed</th><th>Weekly reports</th><th>Next milestone</th></tr></thead><tbody>{[...data.projects].sort((a, b) => a.name.localeCompare(b.name)).map(p => {
      const tasks = (p.workstreams ?? []).filter(w => !w.archived);
      const reports = data.updates.filter(u => u.projectId === p.id && u.weekStart === data.weekStart);
      const members = data.memberships.filter(m => m.projectId === p.id && (membershipJoinedBefore(m, data.settings.timezone, `${data.reportingDue.date}T${data.reportingDue.time}`) || reports.some(u => u.personId === m.personId)));
      const submitted = members.filter(m => reports.some(u => u.personId === m.personId)).length;
      return <tr key={p.id}><td data-label="Project"><Link href={`/projects/${p.id}`} prefetch={false}>{p.name}</Link></td><td data-label="State">{!isApproved(p) ? p.approval === "pending" ? "Awaiting approval" : "Needs revision" : p.state === "on-hold" ? "On hold" : p.state === "completed" ? "Completed" : "Active"}</td><td data-label="Project phase">{p.phase || "Not set"}</td><td data-label="Tasks completed">{tasks.length ? `${tasks.filter(w => w.status === "Done").length}/${tasks.length}` : "No tasks"}{tasks.some(w => w.status === "Blocked") && <small className="project-row-meta">{tasks.filter(w => w.status === "Blocked").length} blocked</small>}</td><td data-label="Weekly reports">{isLive(p) ? `${submitted}/${members.length} shared` : "Not collecting"}</td><td data-label="Next milestone">{p.milestone || "Not set"}{p.due && <small className="project-row-meta">{shortDate(p.due)}{isLive(p) && p.due < data.today ? " · Overdue" : ""}</small>}</td></tr>;
    })}</tbody></table>{!data.projects.length && <p className="quiet-empty">Create a project to start tracking progress.</p>}</div>
    <h3>Member sign-ins</h3><p className="section-copy">Last successful Google sign-in, shown in {data.settings.timezone}. Tracking starts with this update.{data.demo && " This sample workspace records demo sign-ins."}</p>
    <div className="directory-table-wrap"><table className="directory-table"><thead><tr><th>Member</th><th>Last sign-in</th><th>Profile</th></tr></thead><tbody>{logins.map(p => { const login = data.logins.find(l => l.id === p.id); return <tr key={p.id}><td data-label="Member"><Link href={`/team/${p.id}`} prefetch={false}>{p.name}</Link></td><td data-label="Last sign-in">{login ? <time dateTime={login.at}>{reportDate(login.at, data.settings.timezone)}</time> : "No sign-in recorded"}</td><td data-label="Profile">{p.setupComplete === "true" ? "Complete" : "Awaiting profile"}</td></tr>; })}</tbody></table></div>
  </section>;
}
