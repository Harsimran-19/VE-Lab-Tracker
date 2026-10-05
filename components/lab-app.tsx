"use client";
import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import type { Project, Update, Workspace } from "@/lib/types";
import { localDateTime, dayDifference } from "@/lib/calendar";
import { initials, latestReports, reportDate, shortDate } from "@/lib/format";
import { mutate, ProjectForm, type ProjectAction } from "./forms";
import { EntryForm } from "./entry-form";
import { ProfileForm, SettingsForm } from "./profile-form";
import { Welcome } from "./welcome";
import { HelpTip } from "./help-tip";
import { TeamDirectory, MemberContact, memberProjects } from "./team-directory";
import { ProjectContext } from "./project-details";
import type { Screen } from "./workspace-page";
function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initials(name)}
    </span>
  );
}
export function LabApp({
  initial,
  screen = "dashboard",
  projectId,
  personId,
}: {
  initial: Workspace;
  screen?: Screen;
  projectId?: string;
  personId?: string;
}) {
  const [data, setData] = useState(initial),
    [search, setSearch] = useState(""),
    [onlyMine, setOnlyMine] = useState(false),
    [completed, setCompleted] = useState(
      initial.projects.length > 0 &&
        !initial.projects.some((p) => p.state === "active") &&
        initial.projects.some((p) => p.state === "completed"),
    ),
    [history, setHistory] = useState(false),
    [detailView, setDetailView] = useState(false),
    [onHold, setOnHold] = useState(
      !initial.projects.some(
        (p) => p.state === "active" || p.state === "completed",
      ) && initial.projects.some((p) => p.state === "on-hold"),
    ),
    [limit, setLimit] = useState(12),
    [entry, setEntry] = useState<string | null>(null),
    [editing, setEditing] = useState<{
      project?: Project;
      action: ProjectAction;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const manager = data.identity.role === "admin",
    own = data.memberships.filter((m) => m.personId === data.identity.personId),
    ownIds = new Set(own.map((m) => m.projectId)),
    active = data.projects.filter((p) => p.state === "active"),
    myProjects = active.filter((p) => ownIds.has(p.id)),
    chosen = data.projects.find((p) => p.id === projectId),
    person = data.people.find((p) => p.id === personId);
  const expected = data.memberships.filter(
    (m) =>
      active.some((p) => p.id === m.projectId) &&
      (localDateTime(new Date(m.joinedAt), data.settings.timezone) <=
        `${data.reportingDue.date}T${data.reportingDue.time}` ||
        data.updates.some(
          (u) =>
            u.weekStart === data.weekStart &&
            u.personId === m.personId &&
            u.projectId === m.projectId,
        )),
  );
  const current = data.updates.filter((u) => u.weekStart === data.weekStart),
    reported = (projectId: string, personId: string) =>
      current.some((u) => u.projectId === projectId && u.personId === personId),
    gaps = expected.filter((m) => !reported(m.projectId, m.personId));
  const latest = latestReports(data.updates),
    blockedWork = active.flatMap((p) =>
      (p.workstreams ?? [])
        .filter((w) => !w.archived && w.status === "Blocked")
        .map((w) => ({ ...w, projectId: p.id, projectName: p.name })),
    ),
    help = latest.filter(
      (u) => u.needsHelp === "true" && active.some((p) => p.id === u.projectId),
    ),
    deadlines = active
      .flatMap((p) => [
        ...(p.due && (manager || ownIds.has(p.id))
          ? [{ ...p, deadlineKey: p.id }]
          : []),
        ...(p.workstreams ?? [])
          .filter(
            (w) =>
              !w.archived &&
              w.status !== "Done" &&
              w.due &&
              (manager || w.ownerId === data.identity.personId),
          )
          .map((w) => ({
            ...p,
            milestone: w.name,
            due: w.due,
            deadlineKey: w.id,
          })),
      ])
      .filter((p) => dayDifference(p.due, data.today) <= 7)
      .sort((a, b) => a.due.localeCompare(b.due));
  const filtered = data.projects.filter(
    (p) =>
      p.state === (onHold ? "on-hold" : completed ? "completed" : "active") &&
      (!onlyMine || ownIds.has(p.id)) &&
      `${p.name} ${p.fullTitle ?? ""} ${p.goal}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const projectLatest = latest.filter((u) => u.projectId === projectId),
    previous = data.updates
      .filter(
        (u) =>
          u.projectId === projectId &&
          !projectLatest.some((r) => r.id === u.id),
      )
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  async function refresh() {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Could not load the lab.");
    setData(value);
  }
  async function action(run: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    await action(async () => {
      await navigator.clipboard.writeText(window.location.origin);
      setNotice(
        "Website link copied. Members sign in and choose their projects themselves.",
      );
    });
  }
  async function join(id: string) {
    await action(async () => {
      await mutate("/api/join", { projectId: id });
      await refresh();
      setNotice("Project joined. You can now write your weekly update.");
    });
  }
  function reportCard(u: Update) {
    const name = data.people.find((p) => p.id === u.personId)?.name ?? "Member";
    return (
      <article className="update-card" key={u.id}>
        <div className="update-card-head">
          <Avatar name={name} />
          <div>
            <Link
              href={`/team/${encodeURIComponent(u.personId)}`}
              prefetch={false}
            >
              <strong>{name}</strong>
            </Link>
            <p>
              Week of {shortDate(u.weekStart)} ·{" "}
              {reportDate(u.updatedAt, data.settings.timezone)}
            </p>
          </div>
          <span
            className={`report-status ${u.needsHelp === "true" ? "blocked" : ""}`}
          >
            {u.needsHelp === "true" ? "Needs help" : "Shared"}
          </span>
        </div>
        <span className="field-label">Progress</span>
        {!!u.workstreams?.length && (
          <p className="report-workstreams">
            {u.workstreams.map((w) => w.name).join(" · ")}
          </p>
        )}
        <p className="update-progress">{u.progress}</p>
        <p className="next-plan">
          <strong>Next step:</strong> {u.nextPlan}
        </p>
        {u.needsHelp === "true" && (
          <div className="blocker">
            <strong>Help needed</strong>
            <p>{u.blockers}</p>
          </div>
        )}
      </article>
    );
  }
  function deadlinePanel() {
    return (
      <section className="panel dashboard-panel">
        <div className="section-heading">
          <h2>Upcoming deadlines</h2>
          <CalendarDays size={19} />
        </div>
        {deadlines.length ? (
          <>
            <p className="section-copy">Next seven days and overdue work.</p>
            {deadlines.slice(0, 5).map((p) => (
              <Link
                className="deadline-row"
                href={`/projects/${p.id}`}
                key={p.deadlineKey}
              >
                <span
                  className={`deadline-date ${dayDifference(p.due, data.today) < 0 ? "late" : ""}`}
                >
                  {shortDate(p.due)}
                </span>
                <div>
                  <strong>{p.milestone}</strong>
                  <p>{p.name}</p>
                  {dayDifference(p.due, data.today) < 0 && (
                    <small className="late-label">Overdue</small>
                  )}
                </div>
              </Link>
            ))}
          </>
        ) : (
          <p className="quiet-empty">No deadlines coming up.</p>
        )}
      </section>
    );
  }
  function projectCard(p: Project) {
    const count = data.memberships.filter((m) => m.projectId === p.id).length;
    const last = lastReport(p.id);
    return (
      <Link
        prefetch={false}
        href={`/projects/${p.id}`}
        className="research-card"
        key={p.id}
      >
        <span className="project-symbol">
          <FolderKanban size={22} />
        </span>
        <div className="project-summary">
          <div className="project-card-title">
            <h2>{p.name}</h2>
            {ownIds.has(p.id) && <span className="joined-label">Joined</span>}
          </div>
          <p>{p.goal}</p>
          <small>
            {count} {count === 1 ? "member" : "members"}
            {p.due && p.state === "active"
              ? ` · Milestone due ${shortDate(p.due)}`
              : ""}
          </small>
          <small className="project-recency">
            {p.priority ? `${p.priority} priority · ` : ""}
            {last}
          </small>
        </div>
        <span className="stage-pill">
          {p.state === "completed"
            ? "Completed"
            : p.state === "on-hold"
              ? "On hold"
              : p.phase}
        </span>
        <ChevronRight size={18} />
      </Link>
    );
  }
  function lastReport(id: string) {
    const report = data.updates
      .filter((u) => u.projectId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!report) return "No reports yet";
    const date = localDateTime(
      new Date(report.updatedAt),
      data.settings.timezone,
    ).slice(0, 10);
    const days = Math.max(0, dayDifference(data.today, date));
    return days === 0
      ? "Last report today"
      : days === 1
        ? "Last report yesterday"
        : `Last report ${days} days ago`;
  }
  if (data.needsOnboarding) return <Welcome data={data} saved={refresh} />;
  const heading =
    screen === "dashboard"
      ? manager
        ? "Lab overview"
        : "My work"
      : screen === "projects"
        ? "Projects"
        : screen === "team"
          ? "Team"
          : screen === "member"
            ? person?.name
            : screen === "account"
              ? manager
                ? "Account & settings"
                : "Account"
              : chosen?.name;
  const deadlineText = `${shortDate(data.reportingDue.date)} at ${data.reportingDue.time} (${data.settings.timezone})`;
  return (
    <div className="lab-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <header className="lab-header">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <FlaskConical size={22} />
          </span>
          <span>
            VE <strong>Lab</strong>
            <small>Venture Engineering Lab</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {[
            {
              path: "/",
              label: manager ? "Lab overview" : "My work",
              icon: LayoutDashboard,
              active: screen === "dashboard",
            },
            {
              path: "/projects",
              label: "Projects",
              icon: FolderKanban,
              active: screen === "projects" || screen === "project",
            },
            {
              path: "/team",
              label: "Team",
              icon: Users,
              active: screen === "team" || screen === "member",
            },
            {
              path: "/account",
              label: manager ? "Account & settings" : "Account",
              icon: UserRound,
              active: screen === "account",
            },
          ].map((item) => (
            <Link
              prefetch={false}
              key={item.path}
              href={item.path}
              className={item.active ? "active" : ""}
              aria-current={item.active ? "page" : undefined}
            >
              <item.icon size={19} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-help">
          <strong>
            {manager ? "A useful weekly review" : "Your weekly routine"}
          </strong>
          <p>
            {manager
              ? "Check what moved forward, who needs help and what is due next."
              : "Share your progress, next step and any help you need."}
          </p>
        </div>
        <div className="lab-account">
          <Avatar name={data.identity.name} />
          <div>
            <strong>{data.identity.name}</strong>
            <small>{manager ? "Manager" : "Member"}</small>
          </div>
          {!data.demo && (
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>
      <div className="workspace-content">
        {data.demo && (
          <div className="demo-banner">
            <span>
              <strong>Local test workspace</strong> · Starts empty. Emails are
              simulated.
            </span>
            <div className="sample-actions">
              <form action="/api/demo" method="post">
                <input
                  type="hidden"
                  name="view"
                  value={manager ? "new" : "admin"}
                />
                <button>
                  {manager ? "Try new member" : "Manager view"}
                  <ArrowRight size={14} />
                </button>
              </form>
            </div>
          </div>
        )}
        <main id="workspace-main" className="lab-main">
          {screen === "project" && (
            <Link className="breadcrumb" href="/projects">
              Projects <ChevronRight size={14} />
              {chosen?.name}
            </Link>
          )}
          {screen === "member" && (
            <Link className="breadcrumb" href="/team">
              Team <ChevronRight size={14} />
              {person?.name}
            </Link>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {screen === "dashboard"
                  ? `WEEK OF ${shortDate(data.weekStart).toUpperCase()}`
                  : "VENTURE ENGINEERING LAB"}
              </p>
              <h1>{heading}</h1>
              <p>
                {screen === "dashboard"
                  ? manager
                    ? "What moved forward? Who needs help? What is due next?"
                    : `Your weekly updates are due ${deadlineText}.`
                  : screen === "projects"
                    ? "Open a project to read progress. Join the projects you work on."
                    : screen === "team"
                      ? "Everyone who has signed in to the lab. Select a person to see their contact details and projects."
                      : screen === "member"
                        ? "Contact details and projects. Open a project to read shared progress."
                        : screen === "account"
                          ? "Keep your account and reporting preferences up to date."
                          : chosen?.goal}
              </p>
            </div>
            <div className="page-actions">
              {manager &&
                ((screen === "dashboard" && !active.length) ||
                  screen === "projects") && (
                  <button
                    className="button primary"
                    onClick={() => setEditing({ action: "create" })}
                  >
                    <Plus size={16} />
                    Create project
                  </button>
                )}
              {manager && screen === "dashboard" && active.length > 0 && (
                <button
                  className="button secondary"
                  onClick={copyLink}
                  disabled={busy}
                >
                  <Copy size={16} />
                  Share website
                </button>
              )}
              {screen === "project" &&
                chosen &&
                (chosen.state === "active" ? (
                  ownIds.has(chosen.id) ? (
                    <button
                      className="button primary"
                      onClick={() => setEntry(chosen.id)}
                    >
                      <Pencil size={16} />
                      {reported(chosen.id, data.identity.personId)
                        ? "Edit this week’s update"
                        : "Write weekly update"}
                    </button>
                  ) : (
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => join(chosen.id)}
                    >
                      <Plus size={16} />
                      Join project
                    </button>
                  )
                ) : (
                  <span
                    className={`report-status ${chosen.state === "completed" ? "done" : ""}`}
                  >
                    {chosen.state === "on-hold"
                      ? "Project on hold"
                      : "Completed project"}
                  </span>
                ))}
            </div>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="success" role="status">
              {notice}
            </p>
          )}
          {screen === "dashboard" && (
            <>
              {manager ? (
                !active.length ? (
                  <section className="panel first-action">
                    <span className="large-icon">
                      <FolderKanban size={30} />
                    </span>
                    <h2>
                      {data.projects.length
                        ? "No active projects"
                        : "Start with your first project"}
                    </h2>
                    <p>
                      {data.projects.length
                        ? "Completed and paused projects are available in Projects. Create a project when new work begins."
                        : "Give it a name and a clear goal. Then share this website so your team can join and report progress."}
                    </p>
                    {data.projects.length > 0 && (
                      <Link className="section-link" href="/projects">
                        View projects <ArrowRight size={14} />
                      </Link>
                    )}
                  </section>
                ) : (
                  <>
                    <div className="dashboard-metrics">
                      <div>
                        <span>Active projects</span>
                        <strong>{active.length}</strong>
                      </div>
                      <div>
                        <span>
                          {data.reportingDue.passed
                            ? "Missing weekly updates"
                            : "Updates still expected"}
                        </span>
                        <strong>{gaps.length}</strong>
                      </div>
                      <div>
                        <span>Members needing help</span>
                        <strong>
                          {
                            new Set([
                              ...help.map((u) => u.personId),
                              ...blockedWork.map((w) => w.ownerId),
                            ]).size
                          }
                        </strong>
                      </div>
                    </div>
                    <div className="dashboard-columns">
                      <div>
                        <section className="panel dashboard-panel">
                          <div className="section-heading">
                            <h2>This week’s reporting</h2>
                            <HelpTip label="Weekly reporting">
                              Members report once per project each week. Their
                              last edit replaces that week’s report. Members who
                              join after the deadline start reporting next week.
                            </HelpTip>
                          </div>
                          <p className="section-copy">
                            Due {deadlineText}.{" "}
                            {data.reportingDue.passed
                              ? "Missing reports need follow-up."
                              : "Reports are still being collected."}
                          </p>
                          <div className="manager-table-wrap">
                            <table className="manager-table">
                              <thead>
                                <tr>
                                  <th>Project</th>
                                  <th>This week</th>
                                  <th>Needs help</th>
                                </tr>
                              </thead>
                              <tbody>
                                {active.map((p) => {
                                  const required = expected.filter(
                                      (m) => m.projectId === p.id,
                                    ),
                                    pending = gaps.filter(
                                      (m) => m.projectId === p.id,
                                    ),
                                    assistance = help.filter(
                                      (u) => u.projectId === p.id,
                                    );
                                  return (
                                    <tr key={p.id}>
                                      <td data-label="Project">
                                        <Link href={`/projects/${p.id}`}>
                                          {p.name}
                                        </Link>
                                        <small>
                                          {p.phase}
                                          {p.priority ? ` · ${p.priority}` : ""}
                                        </small>
                                        <small>{lastReport(p.id)}</small>
                                      </td>
                                      <td data-label="This week">
                                        <strong>
                                          {
                                            required.filter((m) =>
                                              reported(m.projectId, m.personId),
                                            ).length
                                          }
                                          /{required.length} shared
                                        </strong>
                                        <small>
                                          {!required.length
                                            ? "No reports expected yet"
                                            : pending.length
                                              ? `${data.reportingDue.passed ? "Missing" : "Awaiting"}: ${pending.map((m) => data.people.find((p) => p.id === m.personId)?.name).join(", ")}`
                                              : "Everyone is up to date"}
                                        </small>
                                      </td>
                                      <td data-label="Needs help">
                                        {assistance.length ? (
                                          <span className="needs-help-names">
                                            {assistance
                                              .map(
                                                (u) =>
                                                  data.people.find(
                                                    (p) => p.id === u.personId,
                                                  )?.name,
                                              )
                                              .join(", ")}
                                          </span>
                                        ) : (
                                          <span className="muted">None</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </section>
                        {(help.length > 0 || blockedWork.length > 0) && (
                          <section className="panel dashboard-panel">
                            <h2>Requests for help</h2>
                            <p className="section-copy">
                              Open a project to review help requests and blocked
                              responsibilities.
                            </p>
                            {help.map((u) => (
                              <Link
                                className="attention-row"
                                href={`/projects/${u.projectId}`}
                                key={u.id}
                              >
                                <span className="attention-dot" />
                                <div>
                                  <strong>
                                    {
                                      data.people.find(
                                        (p) => p.id === u.personId,
                                      )?.name
                                    }{" "}
                                    ·{" "}
                                    {
                                      data.projects.find(
                                        (p) => p.id === u.projectId,
                                      )?.name
                                    }
                                  </strong>
                                  <p>{u.blockers}</p>
                                </div>
                                <ChevronRight size={16} />
                              </Link>
                            ))}
                            {blockedWork.map((w) => (
                              <Link
                                className="attention-row"
                                href={`/projects/${w.projectId}`}
                                key={w.id}
                              >
                                <span className="attention-dot" />
                                <div>
                                  <strong>
                                    {data.people.find((p) => p.id === w.ownerId)
                                      ?.name ?? "Member"}{" "}
                                    · {w.projectName}
                                  </strong>
                                  <p>{w.name} is blocked.</p>
                                </div>
                                <ChevronRight size={16} />
                              </Link>
                            ))}
                          </section>
                        )}
                      </div>
                      <aside>
                        {deadlinePanel()}
                        <section className="panel dashboard-panel">
                          <h2>Invite your team</h2>
                          <p className="section-copy">
                            Share the website. Members sign in, confirm their
                            name and choose their projects.
                          </p>
                        </section>
                      </aside>
                    </div>
                  </>
                )
              ) : !myProjects.length ? (
                <section className="panel first-action">
                  <span className="large-icon">
                    <FolderKanban size={30} />
                  </span>
                  <h2>
                    {active.length
                      ? "Choose your first project"
                      : data.projects.some(
                            (p) => ownIds.has(p.id) && p.state === "completed",
                          )
                        ? "Your projects are complete"
                        : data.projects.some(
                              (p) => ownIds.has(p.id) && p.state === "on-hold",
                            )
                          ? "Your projects are on hold"
                          : "No projects yet"}
                  </h2>
                  <p>
                    {active.length
                      ? "Open the project you work on and select Join project. Then you can share progress here."
                      : data.projects.some(
                            (p) => ownIds.has(p.id) && p.state === "completed",
                          )
                        ? "Your earlier reports are available in Projects. New active work will appear here when you join it."
                        : data.projects.some(
                              (p) => ownIds.has(p.id) && p.state === "on-hold",
                            )
                          ? "Weekly reporting is paused. Your projects and earlier reports are available in Projects."
                          : "Your manager will create the lab’s projects. They will appear here when ready."}
                  </p>
                  {active.length > 0 && (
                    <Link className="button primary" href="/projects">
                      Choose a project <ArrowRight size={16} />
                    </Link>
                  )}
                  {!active.length &&
                    data.projects.some(
                      (p) => ownIds.has(p.id) && p.state === "completed",
                    ) && (
                      <Link className="button secondary" href="/projects">
                        View completed work
                      </Link>
                    )}
                </section>
              ) : (
                <div className="dashboard-columns">
                  <div>
                    <section className="panel dashboard-panel">
                      <h2>Your projects this week</h2>
                      <p className="section-copy">
                        Share what you accomplished and what you will do next.
                      </p>
                      {myProjects.map((p) => {
                        const saved = reported(p.id, data.identity.personId);
                        return (
                          <div className="weekly-row" key={p.id}>
                            <div>
                              <Link href={`/projects/${p.id}`}>{p.name}</Link>
                              <span>
                                {saved
                                  ? "Shared this week"
                                  : gaps.some(
                                        (m) =>
                                          m.projectId === p.id &&
                                          m.personId === data.identity.personId,
                                      )
                                    ? data.reportingDue.passed
                                      ? "Update missing"
                                      : "Ready for your update"
                                    : "First update expected next week"}
                              </span>
                              {(p.workstreams ?? [])
                                .filter(
                                  (w) =>
                                    !w.archived &&
                                    w.ownerId === data.identity.personId,
                                )
                                .map((w) => (
                                  <Link
                                    className={`my-responsibility ${w.status === "Blocked" ? "late-label" : ""}`}
                                    key={w.id}
                                    href={`/projects/${p.id}`}
                                  >
                                    {w.name} · {w.status}
                                    {w.due && w.status !== "Done"
                                      ? ` · Due ${shortDate(w.due)}`
                                      : ""}
                                  </Link>
                                ))}
                            </div>
                            {saved && (
                              <CheckCircle2 className="green-icon" size={18} />
                            )}
                            <button
                              className="button secondary"
                              aria-label={`${saved ? "Edit" : "Write"} update for ${p.name}`}
                              onClick={() => setEntry(p.id)}
                            >
                              {saved ? "Edit update" : "Write update"}
                            </button>
                          </div>
                        );
                      })}
                    </section>
                    {latest.some((u) => ownIds.has(u.projectId)) && (
                      <section className="panel dashboard-panel">
                        <h2>Recent team progress</h2>
                        {latest
                          .filter((u) => ownIds.has(u.projectId))
                          .slice(0, 3)
                          .map((u) => (
                            <Link
                              className="activity-row"
                              href={`/projects/${u.projectId}`}
                              key={u.id}
                            >
                              <Avatar
                                name={
                                  data.people.find((p) => p.id === u.personId)
                                    ?.name ?? "Member"
                                }
                              />
                              <div>
                                <strong>
                                  {
                                    data.people.find((p) => p.id === u.personId)
                                      ?.name
                                  }
                                </strong>
                                <p>{u.progress}</p>
                              </div>
                              <ChevronRight size={16} />
                            </Link>
                          ))}
                      </section>
                    )}
                  </div>
                  <aside>
                    {deadlinePanel()}
                    <section className="panel dashboard-panel guide-card">
                      <h2>A useful update</h2>
                      <ol>
                        <li>What did you accomplish?</li>
                        <li>What will you do next?</li>
                        <li>Do you need help?</li>
                      </ol>
                      <p className="field-help">
                        Your name and date are recorded automatically.
                      </p>
                    </section>
                  </aside>
                </div>
              )}
            </>
          )}
          {screen === "projects" && (
            <>
              {data.projects.length > 0 && (
                <div className="directory-toolbar">
                  {!manager && own.length > 0 && (
                    <div className="segmented" aria-label="Project scope">
                      <button
                        className={!onlyMine ? "selected" : ""}
                        aria-pressed={!onlyMine}
                        onClick={() => setOnlyMine(false)}
                      >
                        All projects
                      </button>
                      <button
                        className={onlyMine ? "selected" : ""}
                        aria-pressed={onlyMine}
                        onClick={() => setOnlyMine(true)}
                      >
                        My projects
                      </button>
                    </div>
                  )}
                  {data.projects.some((p) => p.state === "completed") && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={completed}
                        onChange={(e) => {
                          setCompleted(e.target.checked);
                          setOnHold(false);
                        }}
                      />
                      Show completed projects
                    </label>
                  )}
                  {data.projects.some((p) => p.state === "on-hold") && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={onHold}
                        onChange={(e) => {
                          setOnHold(e.target.checked);
                          setCompleted(false);
                        }}
                      />
                      Show projects on hold
                    </label>
                  )}
                  {data.projects.length > 5 && (
                    <div className="search-field">
                      <Search size={18} />
                      <input
                        aria-label="Search projects"
                        placeholder="Search projects…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="projects-list">{filtered.map(projectCard)}</div>
              {!filtered.length && (
                <section className="panel empty-state">
                  <h2>
                    {!data.projects.length
                      ? "No projects yet"
                      : search
                        ? "No matching projects"
                        : "No projects in this view"}
                  </h2>
                  <p>
                    {!data.projects.length
                      ? manager
                        ? "Create a project with its name and goal to get started."
                        : "Your manager will create the projects. Check back when they’re ready."
                      : "Try changing the current filter."}
                  </p>
                </section>
              )}
            </>
          )}
          {screen === "project" && chosen && (
            <>
              <section className="project-overview panel">
                <div className="phase-summary">
                  <span className="field-label">
                    Research phase{" "}
                    <HelpTip label="Research phase">
                      This is the stage of the whole research project. Your
                      weekly report describes your individual progress.
                    </HelpTip>
                  </span>
                  <span className="stage-pill">{chosen.phase}</span>
                  {manager && chosen.state === "active" && (
                    <button
                      className="text-action"
                      onClick={() =>
                        setEditing({ project: chosen, action: "phase" })
                      }
                    >
                      Change phase
                    </button>
                  )}
                </div>
                {(chosen.milestone || manager) && (
                  <div className="milestone-strip">
                    <span className="field-label">Next milestone</span>
                    {chosen.milestone ? (
                      <>
                        <strong>{chosen.milestone}</strong>
                        <span>
                          <CalendarDays size={15} />
                          {shortDate(chosen.due)}
                          {chosen.state === "active" &&
                          dayDifference(chosen.due, data.today) < 0
                            ? " · Overdue"
                            : ""}
                        </span>
                      </>
                    ) : (
                      <p className="field-help">
                        Add one when there is a concrete deadline.
                      </p>
                    )}
                    {manager && chosen.state === "active" && (
                      <div className="inline-actions">
                        <button
                          className="text-action"
                          onClick={() =>
                            setEditing({ project: chosen, action: "milestone" })
                          }
                        >
                          {chosen.milestone
                            ? "Edit milestone"
                            : "Set milestone"}
                        </button>
                        {chosen.milestone && (
                          <button
                            className="text-action muted"
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                await mutate(
                                  "/api/projects",
                                  { id: chosen.id, action: "clear-milestone" },
                                  "PATCH",
                                );
                                await refresh();
                                setNotice("Milestone removed.");
                              })
                            }
                          >
                            Remove milestone
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
              {chosen.state === "active" && !ownIds.has(chosen.id) && (
                <p className="directory-explanation">
                  You can read shared progress. Join this project to write your
                  own weekly updates.
                </p>
              )}
              <div className="project-meta">
                <span>
                  {chosen.leadId && (
                    <>
                      Led by{" "}
                      <Link href={`/team/${encodeURIComponent(chosen.leadId)}`}>
                        {data.people.find((p) => p.id === chosen.leadId)
                          ?.name ?? "Lab member"}
                      </Link>{" "}
                      ·{" "}
                    </>
                  )}
                  {chosen.priority && <>{chosen.priority} priority · </>}
                  {lastReport(chosen.id)}
                </span>
                {manager && (
                  <button
                    className="button secondary small-button"
                    onClick={() =>
                      setEditing({ project: chosen, action: "settings" })
                    }
                  >
                    Project settings
                  </button>
                )}
              </div>
              <div
                className="segmented project-view-switch"
                aria-label="Project view"
              >
                <button
                  aria-pressed={!detailView}
                  className={!detailView ? "selected" : ""}
                  onClick={() => setDetailView(false)}
                >
                  Progress
                </button>
                <button
                  aria-pressed={detailView}
                  className={detailView ? "selected" : ""}
                  onClick={() => setDetailView(true)}
                >
                  Project details
                </button>
              </div>
              {detailView ? (
                <ProjectContext
                  project={chosen}
                  data={data}
                  saved={refresh}
                  mode="details"
                />
              ) : (
                <div className="dashboard-columns project-columns">
                  <section>
                    <ProjectContext
                      project={chosen}
                      data={data}
                      saved={refresh}
                      mode="responsibilities"
                    />
                    <div className="section-heading">
                      <div>
                        <h2>
                          {history ? "Earlier reports" : "Latest team progress"}
                        </h2>
                        <p className="section-copy">
                          {history
                            ? "Earlier weekly reports created in this app."
                            : "The latest report from each member. Each report shows its week."}
                        </p>
                      </div>
                      {previous.length > 0 && (
                        <button
                          className="button secondary"
                          onClick={() => {
                            setHistory(!history);
                            setLimit(12);
                          }}
                        >
                          {history ? "Latest progress" : "Earlier weeks"}
                        </button>
                      )}
                    </div>
                    <div className="update-feed">
                      {(history ? previous : projectLatest)
                        .slice(0, limit)
                        .map(reportCard)}
                      {!projectLatest.length && (
                        <section className="panel empty-state">
                          <h3>No progress shared yet</h3>
                          <p>
                            {chosen.state === "completed"
                              ? "No reports were submitted for this project."
                              : chosen.state === "on-hold"
                                ? "Weekly reporting is paused until this project resumes."
                                : ownIds.has(chosen.id)
                                  ? "Write your first weekly update using the button above."
                                  : "Reports will appear as members join and share their work."}
                          </p>
                        </section>
                      )}
                    </div>
                    {(history ? previous : projectLatest).length > limit && (
                      <button
                        className="button secondary load-more"
                        onClick={() => setLimit(limit + 12)}
                      >
                        Load more reports
                      </button>
                    )}
                  </section>
                  <aside>
                    <section className="panel dashboard-panel">
                      <h2>Project members</h2>
                      <div className="project-members">
                        {data.memberships
                          .filter((m) => m.projectId === chosen.id)
                          .map((m) => {
                            const name =
                              data.people.find((p) => p.id === m.personId)
                                ?.name ?? "Member";
                            return (
                              <Link
                                key={m.id}
                                href={`/team/${encodeURIComponent(m.personId)}`}
                                prefetch={false}
                              >
                                <Avatar name={name} />
                                <span>
                                  {name}
                                  {m.personId === data.identity.personId && (
                                    <small>You</small>
                                  )}
                                </span>
                              </Link>
                            );
                          })}
                      </div>
                      {!data.memberships.some(
                        (m) => m.projectId === chosen.id,
                      ) && (
                        <p className="quiet-empty">
                          No members have joined yet.
                        </p>
                      )}
                    </section>
                    {manager && (
                      <details className="panel dashboard-panel management-disclosure">
                        <summary>
                          <h2>Manage project</h2>
                        </summary>
                        <div className="management-actions">
                          <button
                            className="button secondary"
                            onClick={() =>
                              setEditing({ project: chosen, action: "goal" })
                            }
                          >
                            Edit name and goal
                          </button>
                          {chosen.state === "active" && (
                            <button
                              className="button secondary"
                              onClick={() =>
                                setEditing({ project: chosen, action: "pause" })
                              }
                            >
                              Put on hold
                            </button>
                          )}
                          <button
                            className="button secondary"
                            onClick={() =>
                              setEditing({
                                project: chosen,
                                action:
                                  chosen.state === "active"
                                    ? "complete"
                                    : "reopen",
                              })
                            }
                          >
                            {chosen.state === "active"
                              ? "Complete project"
                              : "Reopen project"}
                          </button>
                        </div>
                      </details>
                    )}
                  </aside>
                </div>
              )}
            </>
          )}
          {screen === "team" && <TeamDirectory data={data} />}
          {screen === "member" && person && (
            <div className="member-layout">
              <MemberContact
                person={person}
                own={person.id === data.identity.personId}
              />
              <section aria-label="Member projects">
                <h2 className="member-project-heading">Projects</h2>
                {memberProjects(data, person.id).length ? (
                  <div className="projects-list">
                    {memberProjects(data, person.id).map(projectCard)}
                  </div>
                ) : (
                  <div className="panel empty-state">
                    <h3>No projects joined</h3>
                    <p>
                      {person.name} is part of the team and hasn’t joined a
                      project yet.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
          {screen === "account" && (
            <div className="profile-layout">
              <div className="settings-stack">
                <ProfileForm data={data} saved={refresh} />
                {manager && <SettingsForm data={data} saved={refresh} />}
              </div>
              <aside>
                {manager && (
                  <section className="panel dashboard-panel email-settings">
                    <div className="section-heading">
                      <h2>Lab email reminders</h2>
                      <Mail size={20} />
                    </div>
                    <p className="section-copy">
                      Email reminders cover outstanding updates, project
                      deadline reminders and your weekly lab summary.
                    </p>
                    <span
                      className={`email-state ${data.emailReady ? "ready" : ""}`}
                    >
                      {data.demo
                        ? "Local test mode"
                        : data.emailReady
                          ? "Email configured"
                          : "Email setup needed"}
                    </span>
                    {data.demo || data.emailReady ? (
                      <>
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              const result = await mutate(
                                "/api/email-test",
                                {},
                              );
                              setNotice(result.message);
                              await refresh();
                            })
                          }
                        >
                          <Mail size={16} />
                          {data.demo
                            ? "Preview test email"
                            : "Send me a test email"}
                        </button>
                        <p className="field-help">
                          {data.demo
                            ? "Preview only. No email is sent."
                            : `The test goes only to ${data.identity.email}.`}
                        </p>
                      </>
                    ) : (
                      <p className="field-help">
                        Activate email once using the{" "}
                        <a
                          href="https://github.com/Harsimran-19/VE-Lab-Tracker/blob/main/docs/GOOGLE_SETUP.md#email-reminders"
                          target="_blank"
                          rel="noreferrer"
                        >
                          setup guide
                        </a>
                        . No purchased domain is needed.
                      </p>
                    )}
                    {!data.demo && !data.cronReady && (
                      <p className="field-help">
                        The daily scheduler still needs activation in Vercel.
                        See the same setup guide.
                      </p>
                    )}
                    {Boolean(data.reminderHealth?.pending) && (
                      <p className="info-note">
                        {data.reminderHealth!.pending} email attempts need
                        review. Uncertain sends are held to prevent duplicates.
                      </p>
                    )}
                  </section>
                )}
                <section className="panel dashboard-panel guide-card">
                  <h2>Your Google account</h2>
                  <p className="section-copy">
                    Google handles sign-in. Your password is never stored in
                    this app.
                  </p>
                  {!data.demo && (
                    <button
                      className="button secondary"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      Sign out
                    </button>
                  )}
                </section>
              </aside>
            </div>
          )}
        </main>
      </div>
      {entry && (
        <EntryForm
          data={data}
          projectId={entry}
          refresh={refresh}
          close={() => setEntry(null)}
          saved={async () => {
            await refresh();
            setNotice("Weekly update saved. Your team can now see it.");
          }}
        />
      )}
      {editing && (
        <ProjectForm
          people={data.people}
          project={editing.project}
          action={editing.action}
          close={() => setEditing(null)}
          saved={async () => {
            await refresh();
            setNotice(
              editing.action === "complete"
                ? "Project completed. Reporting and reminders have stopped."
                : "Project saved.",
            );
          }}
        />
      )}
    </div>
  );
}
