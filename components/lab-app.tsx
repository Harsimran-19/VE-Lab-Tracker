"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
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
import type { Person, Project, Update, Workspace } from "@/lib/types";
import { STAGES } from "@/lib/types";
import {
  initials,
  latestByAssignment,
  reportDate,
  shortDate,
} from "@/lib/format";
import { dayDifference, reportedThisWeek } from "@/lib/calendar";
import { AssignmentList, mutate, PersonEditor, ProjectEditor } from "./forms";
import { EntryForm } from "./entry-form";
import { ProfileForm } from "./profile-form";
import { Modal } from "./modal";
import { Welcome } from "./welcome";
import { HelpTip } from "./help-tip";
import type { Screen } from "./workspace-page";
const subscribeReady = () => () => {};
function Avatar({ name }: { name: string }) {
  return <span className="avatar">{initials(name)}</span>;
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`report-status ${value === "Blocked" ? "blocked" : value === "Done" ? "done" : ""}`}
    >
      {value === "Blocked" ? "Needs help" : value}
    </span>
  );
}
const blankProject = (id: string): Project => ({
  id,
  name: "",
  title: "",
  stage: "Idea",
  pipeline: "Not submitted",
  methods: "",
  journal: "",
  conference: "",
  priority: "P2 - steady",
  milestone: "",
  due: "",
  notes: "",
});
export function LabApp({
  initial,
  screen = "dashboard",
  projectId,
}: {
  initial: Workspace;
  screen?: Screen;
  projectId?: string;
}) {
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const [data, setData] = useState(initial),
    [search, setSearch] = useState(""),
    [onlyMine, setOnlyMine] = useState(
      initial.identity.role !== "admin" &&
        initial.assignments.some(
          (a) => a.personId === initial.identity.personId,
        ),
    ),
    [tab, setTab] = useState("updates"),
    [personFilter, setPersonFilter] = useState(""),
    [limit, setLimit] = useState(12);
  const [entry, setEntry] = useState<{ projectId?: string } | null>(null),
    [editing, setEditing] = useState<{
      project: Project;
      create?: boolean;
    } | null>(null),
    [person, setPerson] = useState<Person | null>(null),
    [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const admin = data.identity.role === "admin",
    readOnly = Boolean(data.preview);
  const href = (path: string) =>
    readOnly
      ? `${path}?preview=${encodeURIComponent(data.identity.personId)}`
      : path;
  const projectHref = (id: string) =>
    href(`/projects/${encodeURIComponent(id)}`);
  const own = data.assignments.filter(
      (a) => a.personId === data.identity.personId,
    ),
    ownIds = new Set(own.map((a) => a.projectId)),
    myProjects = data.projects.filter((p) => ownIds.has(p.id));
  const sorted = [...data.updates].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const blocked = latestByAssignment(data.updates).filter(
    (u) => u.status !== "Done" && (u.status === "Blocked" || u.blockers.trim()),
  );
  const reported = (id: string, memberId: string) =>
    data.updates.some(
      (u) =>
        u.projectId === id &&
        u.personId === memberId &&
        reportedThisWeek(u.createdAt, data.weekStart, data.timezone),
    );
  const pairs = data.assignments
      .filter((a) => a.status !== "Done")
      .filter(
        (a, i, rows) =>
          rows.findIndex(
            (r) => r.projectId === a.projectId && r.personId === a.personId,
          ) === i,
      ),
    gaps = pairs.filter((a) => !reported(a.projectId, a.personId));
  const deadlines = [
    ...data.projects
      .filter(
        (p) =>
          p.due &&
          p.pipeline !== "Accepted" &&
          (admin ||
            own.some((a) => a.projectId === p.id && a.status !== "Done")),
      )
      .map((p) => ({
        id: `p-${p.id}`,
        projectId: p.id,
        title: p.milestone || "Project milestone",
        due: p.due,
      })),
    ...data.assignments
      .filter(
        (a) =>
          a.due &&
          a.status !== "Done" &&
          (admin || a.personId === data.identity.personId),
      )
      .map((a) => ({
        id: a.id,
        projectId: a.projectId,
        title: a.responsibility,
        due: a.due,
      })),
  ]
    .filter((d) => dayDifference(d.due, data.today) <= 7)
    .sort((a, b) => a.due.localeCompare(b.due));
  const chosen = data.projects.find((p) => p.id === projectId),
    filteredProjects = data.projects.filter(
      (p) =>
        (!onlyMine || ownIds.has(p.id)) &&
        `${p.id} ${p.name} ${p.title}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  const filteredPeople = data.people.filter((p) => {
    const profile = data.profiles?.find((r) => r.id === p.id);
    return `${p.name} ${p.affiliation} ${profile?.expertise ?? ""} ${profile?.position ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  const projectUpdates = sorted.filter(
    (u) =>
      u.projectId === projectId &&
      (!personFilter || u.personId === personFilter),
  );
  const pending = data.onboarding?.filter((r) => r.status === "pending") ?? [],
    connection = data.onboarding?.find(
      (r) => r.id === data.identity.personId && r.status === "pending",
    );
  async function refresh() {
    const response = await fetch(
      readOnly
        ? `/api/member-preview?personId=${encodeURIComponent(data.identity.personId)}`
        : "/api/workspace",
      { cache: "no-store" },
    );
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Could not load the lab.");
    setData(value);
  }
  async function action(run: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join(id: string) {
    await action(async () => {
      await mutate("/api/join", { projectId: id });
      await refresh();
      setNotice("Project joined. You can now share weekly progress.");
    });
  }
  async function copyLink() {
    await action(async () => {
      await navigator.clipboard.writeText(window.location.origin);
      setNotice("Invite link copied. Members join with their Google account.");
    });
  }
  function updateCard(u: Update) {
    const author = data.people.find((p) => p.id === u.personId);
    return (
      <article className="update-card" key={u.id}>
        <div className="update-card-head">
          <Avatar name={author?.name ?? "Member"} />
          <div>
            <strong>{author?.name ?? "Member"}</strong>
            <p>{reportDate(u.createdAt, data.timezone)}</p>
          </div>
          <Status value={u.status} />
        </div>
        <p className="update-progress">{u.progress}</p>
        {u.blockers && (
          <div className="blocker">
            <strong>Help needed</strong>
            <p>{u.blockers}</p>
          </div>
        )}
        {u.nextPlan && (
          <p className="next-plan">
            <strong>Next week:</strong> {u.nextPlan}
          </p>
        )}
      </article>
    );
  }
  function projectCard(p: Project) {
    const members = new Set(
      data.assignments
        .filter((a) => a.projectId === p.id)
        .map((a) => a.personId),
    );
    return (
      <Link
        prefetch={false}
        href={projectHref(p.id)}
        className="research-card"
        key={p.id}
      >
        <span className="project-symbol">
          <FolderKanban size={23} />
        </span>
        <div className="project-summary">
          <div className="project-card-title">
            <span className="project-code">
              {p.id.startsWith("P-") ? "PROJECT" : p.id}
            </span>
            <h2>{p.name}</h2>
            {ownIds.has(p.id) && <span className="joined-label">Joined</span>}
          </div>
          <p>
            {p.title || p.milestone || "View this project’s progress and team."}
          </p>
          <small>
            {members.size} {members.size === 1 ? "member" : "members"}
            {p.due ? ` · Next deadline ${shortDate(p.due)}` : ""}
          </small>
        </div>
        <span className="stage-pill">{p.stage}</span>
        <ChevronRight size={19} />
      </Link>
    );
  }
  if (data.needsOnboarding && !readOnly)
    return <Welcome data={data} saved={refresh} />;
  const heading =
    screen === "dashboard"
      ? admin
        ? "Lab overview"
        : "My work"
      : screen === "projects"
        ? "Projects"
        : screen === "people"
          ? "Teammates"
          : screen === "profile"
            ? "My profile"
            : chosen?.name;
  return (
    <div className="lab-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <header className="lab-header">
        <Link className="brand" href={href("/")}>
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
              label: admin ? "Lab overview" : "My work",
              path: "/",
              icon: LayoutDashboard,
              active: screen === "dashboard",
            },
            {
              label: "Projects",
              path: "/projects",
              icon: FolderKanban,
              active: screen === "projects" || screen === "project",
            },
            {
              label: "Teammates",
              path: "/people",
              icon: Users,
              active: screen === "people",
            },
            {
              label: "My profile",
              path: "/profile",
              icon: UserRound,
              active: screen === "profile",
            },
          ].map((item) => (
            <Link
              prefetch={false}
              key={item.path}
              href={href(item.path)}
              className={item.active ? "active" : ""}
              aria-current={item.active ? "page" : undefined}
            >
              <item.icon size={19} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-help">
          <strong>Your weekly routine</strong>
          <p>
            Open a project, share progress, and let your team know if you need
            help.
          </p>
        </div>
        <div className="lab-account">
          <Avatar name={data.identity.name} />
          <div>
            <strong>
              {data.people.find((p) => p.id === data.identity.personId)?.name ??
                data.identity.name}
            </strong>
            <small>{admin ? "Administrator" : "Lab member"}</small>
          </div>
          {!data.demo && !readOnly && (
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
              <strong>Sample workspace</strong> · Emails are simulated.
            </span>
            {!readOnly && (
              <div className="sample-actions">
                <form action="/api/demo" method="post">
                  <input
                    type="hidden"
                    name="view"
                    value={admin ? "member" : "admin"}
                  />
                  <button>
                    {admin ? "Member view" : "Admin view"}
                    <ArrowRight size={14} />
                  </button>
                </form>
                {admin && (
                  <form action="/api/demo" method="post">
                    <input type="hidden" name="view" value="new" />
                    <button>
                      New member view
                      <ArrowRight size={14} />
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
        {readOnly && (
          <section className="preview-banner" aria-label="Member preview">
            <div>
              <strong>
                <Eye size={18} /> Member preview: {data.identity.name}
              </strong>
              <p>
                Read-only. You remain signed in as {data.preview?.adminName}.
              </p>
            </div>
            <Link className="button secondary" href="/people">
              Return to admin
            </Link>
          </section>
        )}
        <main id="workspace-main" className="lab-main">
          {screen === "project" && (
            <Link className="breadcrumb" href={href("/projects")}>
              Projects <ChevronRight size={14} /> {chosen?.name}
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
                  ? admin
                    ? "See who needs help and how the lab is progressing."
                    : `Welcome, ${data.people.find((p) => p.id === data.identity.personId)?.name ?? data.identity.name}. Here’s your work for this week.`
                  : screen === "projects"
                    ? "Find your research projects and follow the team’s progress."
                    : screen === "people"
                      ? "Find a teammate by name or expertise, then explore their work."
                      : screen === "profile"
                        ? "Choose how you introduce yourself and receive reminders."
                        : chosen?.title ||
                          "Share progress and collaborate with your project team."}
              </p>
            </div>
            <div className="page-actions">
              {screen === "dashboard" && admin && !data.needsSetup && (
                <button
                  disabled={!ready}
                  className="button secondary"
                  onClick={copyLink}
                >
                  <Copy size={16} />
                  Invite the lab
                </button>
              )}
              {screen === "projects" && admin && (
                <button
                  disabled={!ready}
                  className="button primary"
                  onClick={() =>
                    setEditing({
                      project: blankProject(`P-${crypto.randomUUID()}`),
                      create: true,
                    })
                  }
                >
                  <Plus size={17} />
                  Create project
                </button>
              )}
              {screen === "project" && chosen && (
                <>
                  {admin && (
                    <button
                      className="button secondary"
                      disabled={!ready}
                      onClick={() => setEditing({ project: chosen })}
                    >
                      <Pencil size={16} />
                      Manage project
                    </button>
                  )}
                  {ownIds.has(chosen.id) ? (
                    <button
                      disabled={!ready}
                      className="button primary"
                      onClick={() => setEntry({ projectId: chosen.id })}
                    >
                      <Pencil size={16} />
                      Write weekly update
                    </button>
                  ) : (
                    <button
                      disabled={busy || !ready || readOnly}
                      className="button primary"
                      onClick={() => join(chosen.id)}
                    >
                      <Plus size={16} />
                      {busy ? "Joining…" : "Join project"}
                    </button>
                  )}
                </>
              )}
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
          {connection && (
            <p className="info-note">
              Your name is set. The admin will confirm the connection to your
              previous work. You can join projects and report now.
            </p>
          )}
          {data.needsSetup ? (
            <section className="panel setup-panel">
              <FlaskConical size={36} />
              <h2>Prepare the lab once</h2>
              <p>
                Initialize your new spreadsheet, then share the website with
                your team. Members set up their own profile.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await mutate("/api/setup", {});
                    await refresh();
                  })
                }
              >
                {busy ? "Setting up…" : "Initialize lab spreadsheet"}
              </button>
            </section>
          ) : (
            <>
              {screen === "dashboard" && (
                <>
                  {admin ? (
                    <>
                      <div className="dashboard-metrics">
                        <div>
                          <span>Research projects</span>
                          <strong>{data.projects.length}</strong>
                          <FolderKanban size={20} />
                        </div>
                        <div>
                          <span>Updates missing this week</span>
                          <strong>{gaps.length}</strong>
                          <CalendarDays size={20} />
                        </div>
                        <div>
                          <span>People needing help</span>
                          <strong>
                            {new Set(blocked.map((u) => u.personId)).size}
                          </strong>
                          <Users size={20} />
                        </div>
                      </div>
                      <div className="dashboard-columns">
                        <div>
                          <section className="panel dashboard-panel">
                            <div className="section-heading">
                              <h2>Needs attention</h2>
                              <HelpTip label="Needs attention">
                                The latest report for each responsibility is
                                checked. A completed responsibility no longer
                                counts as blocked.
                              </HelpTip>
                            </div>
                            {blocked.length ? (
                              blocked.slice(0, 5).map((u) => (
                                <Link
                                  className="attention-row"
                                  href={projectHref(u.projectId)}
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
                                    <p>{u.blockers || u.progress}</p>
                                  </div>
                                  <ChevronRight size={16} />
                                </Link>
                              ))
                            ) : (
                              <p className="section-copy">
                                No one has reported needing help.
                              </p>
                            )}
                          </section>
                          <section className="panel dashboard-panel">
                            <div className="section-heading">
                              <h2>Weekly reporting</h2>
                              <span className="count-label">
                                {pairs.length - gaps.length}/{pairs.length}{" "}
                                shared
                              </span>
                            </div>
                            <p className="section-copy">
                              One update per active member and project each
                              week. Open a project to read the full history.
                            </p>
                            {gaps.slice(0, 6).map((a) => (
                              <Link
                                className="reporting-row"
                                href={projectHref(a.projectId)}
                                key={`${a.personId}-${a.projectId}`}
                              >
                                <Avatar
                                  name={
                                    data.people.find((p) => p.id === a.personId)
                                      ?.name ?? "Member"
                                  }
                                />
                                <div>
                                  <strong>
                                    {
                                      data.people.find(
                                        (p) => p.id === a.personId,
                                      )?.name
                                    }
                                  </strong>
                                  <p>
                                    {
                                      data.projects.find(
                                        (p) => p.id === a.projectId,
                                      )?.name
                                    }
                                  </p>
                                </div>
                                <span>Not shared yet</span>
                              </Link>
                            ))}
                            {!gaps.length && (
                              <p className="success">Everyone is up to date.</p>
                            )}
                            {gaps.length > 6 && (
                              <Link
                                className="section-link"
                                href={href("/projects")}
                              >
                                Review all projects <ArrowRight size={15} />
                              </Link>
                            )}
                          </section>
                          {pending.length > 0 && (
                            <Link
                              className="info-note request-shortcut"
                              href={href("/people")}
                            >
                              {pending.length} existing profile{" "}
                              {pending.length === 1
                                ? "connection needs"
                                : "connections need"}{" "}
                              confirmation <ArrowRight size={16} />
                            </Link>
                          )}
                        </div>
                        <aside>
                          {deadlinePanel()}
                          <section className="panel dashboard-panel">
                            <h2>Invite your team</h2>
                            <p className="section-copy">
                              Share the website. Members sign in with Google,
                              choose their name and join projects themselves.
                            </p>
                            <button
                              className="button secondary"
                              onClick={copyLink}
                              disabled={!ready}
                            >
                              <Copy size={16} />
                              Copy invite link
                            </button>
                          </section>
                        </aside>
                      </div>
                    </>
                  ) : !myProjects.length ? (
                    <section className="panel first-action">
                      <span className="large-icon">
                        <FolderKanban size={30} />
                      </span>
                      <p className="eyebrow">YOUR NEXT STEP</p>
                      <h2>Choose your first project</h2>
                      <p>
                        Find the project you work on and select “Join project”.
                        Your weekly updates and deadlines will then appear here.
                      </p>
                      <Link className="button primary" href={href("/projects")}>
                        Choose a project <ArrowRight size={16} />
                      </Link>
                    </section>
                  ) : (
                    <div className="dashboard-columns">
                      <div>
                        <section className="panel dashboard-panel">
                          <div className="section-heading">
                            <h2>Your projects this week</h2>
                            <Link
                              className="section-link"
                              href={href("/projects")}
                            >
                              Find more projects
                            </Link>
                          </div>
                          <p className="section-copy">
                            Write a short update for each project. Progress,
                            help needed, and your next step.
                          </p>
                          {myProjects.map((p) => (
                            <div className="weekly-row" key={p.id}>
                              <span className="project-symbol">
                                <FolderKanban size={22} />
                              </span>
                              <div>
                                <Link href={projectHref(p.id)}>{p.name}</Link>
                                <span>
                                  {p.stage} ·{" "}
                                  {reported(p.id, data.identity.personId)
                                    ? "Shared this week"
                                    : "Ready for your update"}
                                </span>
                              </div>
                              {reported(p.id, data.identity.personId) && (
                                <CheckCircle2
                                  size={18}
                                  className="green-icon"
                                />
                              )}
                              <button
                                className="button secondary"
                                disabled={!ready}
                                aria-label={`Write weekly update for ${p.name}`}
                                onClick={() => setEntry({ projectId: p.id })}
                              >
                                Write update
                              </button>
                            </div>
                          ))}
                        </section>
                        <section className="panel dashboard-panel">
                          <h2>Recent progress in your projects</h2>
                          <p className="section-copy">
                            Your teammates’ work is shared here so you can stay
                            connected.
                          </p>
                          {sorted
                            .filter((u) => ownIds.has(u.projectId))
                            .slice(0, 3)
                            .map((u) => (
                              <Link
                                className="activity-row"
                                key={u.id}
                                href={projectHref(u.projectId)}
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
                                      data.people.find(
                                        (p) => p.id === u.personId,
                                      )?.name
                                    }
                                  </strong>
                                  <p>{u.progress}</p>
                                </div>
                                <ChevronRight size={16} />
                              </Link>
                            ))}
                          {!sorted.some((u) => ownIds.has(u.projectId)) && (
                            <p className="field-help">
                              Your first update will start the project’s
                              progress history.
                            </p>
                          )}
                        </section>
                      </div>
                      <aside>
                        {deadlinePanel()}
                        <section className="panel dashboard-panel guide-card">
                          <h2>How to report</h2>
                          <ol>
                            <li>Choose your project.</li>
                            <li>Write what you accomplished.</li>
                            <li>Ask for help and add next week’s plan.</li>
                          </ol>
                          <p className="field-help">
                            Your name and date are added automatically.
                          </p>
                        </section>
                      </aside>
                    </div>
                  )}
                </>
              )}
              {screen === "projects" && (
                <>
                  <div className="directory-toolbar">
                    <div className="segmented" aria-label="Project scope">
                      <button
                        aria-pressed={onlyMine}
                        className={onlyMine ? "selected" : ""}
                        onClick={() => setOnlyMine(true)}
                      >
                        My projects <span>{myProjects.length}</span>
                      </button>
                      <button
                        aria-pressed={!onlyMine}
                        className={!onlyMine ? "selected" : ""}
                        onClick={() => setOnlyMine(false)}
                      >
                        All lab projects <span>{data.projects.length}</span>
                      </button>
                    </div>
                    <div className="search-field">
                      <Search size={18} />
                      <input
                        aria-label="Search projects"
                        placeholder="Search projects…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="directory-explanation">
                    {onlyMine
                      ? "Projects you have joined. Open one to write your weekly update."
                      : "Shared research for this team. Open a project and join if you work on it."}{" "}
                    <HelpTip label="Project access">
                      Everyone in the lab can read progress. Joining adds a
                      project to My work and lets you report your own progress.
                    </HelpTip>
                  </p>
                  <div className="projects-list">
                    {filteredProjects.map(projectCard)}
                  </div>
                  {!filteredProjects.length && (
                    <section className="panel empty-state">
                      <h2>
                        {search
                          ? "No matching projects"
                          : "You haven’t joined a project yet"}
                      </h2>
                      <p>
                        {search
                          ? "Try another search."
                          : "Browse all lab projects and choose the research you work on."}
                      </p>
                      {onlyMine && (
                        <button
                          className="button primary"
                          onClick={() => setOnlyMine(false)}
                        >
                          Browse lab projects
                        </button>
                      )}
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
                          This describes the whole project’s research stage.
                          Your weekly update describes your own progress.
                        </HelpTip>
                      </span>
                      <span
                        className="stage-pill"
                        aria-label={`Research phase: ${chosen.stage}`}
                      >
                        {chosen.stage}
                      </span>
                    </div>
                    <div className="milestone-strip">
                      <span className="field-label">Next milestone</span>
                      <strong>
                        {chosen.milestone ||
                          "The team hasn’t added a milestone yet."}
                      </strong>
                      {chosen.due && (
                        <span>
                          <CalendarDays size={15} />
                          {shortDate(chosen.due)}
                          {dayDifference(chosen.due, data.today) < 0
                            ? " · Overdue"
                            : ""}
                        </span>
                      )}
                    </div>
                  </section>
                  {!ownIds.has(chosen.id) && (
                    <p className="directory-explanation">
                      You can read this project’s updates. Select “Join project”
                      above to add your own progress.
                    </p>
                  )}
                  <div
                    className="project-tabs"
                    role="tablist"
                    aria-label="Project sections"
                  >
                    {[
                      { key: "updates", label: "Weekly progress" },
                      { key: "team", label: "Team & responsibilities" },
                      { key: "details", label: "Project details" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        id={`tab-${t.key}`}
                        role="tab"
                        aria-selected={tab === t.key}
                        aria-controls={`panel-${t.key}`}
                        tabIndex={tab === t.key ? 0 : -1}
                        onKeyDown={(e) => {
                          const keys = ["updates", "team", "details"];
                          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                            e.preventDefault();
                            const next =
                              keys[
                                (keys.indexOf(tab) +
                                  (e.key === "ArrowRight" ? 1 : 2)) %
                                  3
                              ];
                            setTab(next);
                            document.getElementById(`tab-${next}`)?.focus();
                          }
                        }}
                        onClick={() => setTab(t.key)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <section
                    role="tabpanel"
                    id={`panel-${tab}`}
                    aria-labelledby={`tab-${tab}`}
                    className="project-tab-content"
                  >
                    {tab === "updates" ? (
                      <>
                        <div className="section-heading">
                          <div>
                            <h2>Team’s weekly progress</h2>
                            <p className="section-copy">
                              Read what changed, see who needs help, and follow
                              the next steps.
                            </p>
                          </div>
                          <select
                            aria-label="Filter updates by member"
                            value={personFilter}
                            onChange={(e) => setPersonFilter(e.target.value)}
                          >
                            <option value="">Everyone</option>
                            {data.people
                              .filter((p) =>
                                data.assignments.some(
                                  (a) =>
                                    a.personId === p.id &&
                                    a.projectId === chosen.id,
                                ),
                              )
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="update-feed">
                          {projectUpdates.slice(0, limit).map(updateCard)}
                          {!projectUpdates.length && (
                            <div className="panel empty-state">
                              <h3>No progress shared yet</h3>
                              <p>
                                {ownIds.has(chosen.id)
                                  ? "Share your first weekly update using the button above."
                                  : "Join this project to start its progress history."}
                              </p>
                            </div>
                          )}
                        </div>
                        {projectUpdates.length > limit && (
                          <button
                            className="button secondary"
                            onClick={() => setLimit(limit + 12)}
                          >
                            Load earlier updates
                          </button>
                        )}
                      </>
                    ) : tab === "team" ? (
                      <>
                        <p className="section-copy">
                          Members can join themselves. The admin can add a
                          specific responsibility and deadline.
                        </p>
                        <AssignmentList
                          data={data}
                          projectId={chosen.id}
                          refresh={refresh}
                        />
                        {data.collaborators.filter(
                          (c) => c.projectId === chosen.id,
                        ).length > 0 && (
                          <section className="panel dashboard-panel">
                            <h3>External collaborators</h3>
                            {data.collaborators
                              .filter((c) => c.projectId === chosen.id)
                              .map((c) => (
                                <p key={c.id}>
                                  {c.name} · {c.affiliation} · {c.role}
                                </p>
                              ))}
                          </section>
                        )}
                      </>
                    ) : (
                      <div className="panel details-panel">
                        <h2>Research details</h2>
                        <div
                          className="phase-track"
                          aria-label="Research stages"
                        >
                          {STAGES.map((s) => (
                            <span
                              className={chosen.stage === s ? "current" : ""}
                              key={s}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                        <dl className="project-details">
                          {[
                            ["Research title", chosen.title],
                            ["Methods", chosen.methods],
                            ["Publication status", chosen.pipeline],
                            ["Target journal", chosen.journal],
                            ["Target conference", chosen.conference],
                            ["Priority", chosen.priority],
                            ["Notes", chosen.notes],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value || "Not added yet"}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </section>
                </>
              )}
              {screen === "people" && (
                <>
                  {admin && pending.length > 0 && (
                    <section className="panel connection-requests">
                      <h2>Connect existing lab profiles</h2>
                      <p className="section-copy">
                        Confirm only if this Google account belongs to the named
                        teammate. Their previous reports and responsibilities
                        will join their account.
                      </p>
                      {pending.map((r) => (
                        <div className="connection-row" key={r.id}>
                          <div>
                            <strong>
                              {data.people.find((p) => p.id === r.id)?.name} →{" "}
                              {
                                data.people.find((p) => p.id === r.rosterId)
                                  ?.name
                              }
                            </strong>
                            <p>{r.requesterEmail}</p>
                          </div>
                          <button
                            className="button primary"
                            disabled={busy}
                            aria-label={`Confirm connection for ${r.requesterEmail}`}
                            onClick={() =>
                              action(async () => {
                                await mutate("/api/roster-links", {
                                  id: r.id,
                                  approve: true,
                                });
                                await refresh();
                                setNotice(
                                  "Previous work connected to the member’s account.",
                                );
                              })
                            }
                          >
                            Confirm connection
                          </button>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                await mutate("/api/roster-links", {
                                  id: r.id,
                                  approve: false,
                                });
                                await refresh();
                              })
                            }
                          >
                            Keep separate
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                  <div className="directory-toolbar">
                    <div className="search-field">
                      <Search size={18} />
                      <input
                        aria-label="Search people and expertise"
                        placeholder="Search a name or skill…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Link className="button secondary" href={href("/profile")}>
                      Add my expertise
                    </Link>
                  </div>
                  <p className="directory-explanation">
                    {filteredPeople.length} teammates · Skills help you find
                    someone to collaborate with.
                  </p>
                  <div className="people-grid">
                    {filteredPeople.map((p) => {
                      const profile = data.profiles?.find((r) => r.id === p.id),
                        projects = data.projects.filter((project) =>
                          data.assignments.some(
                            (a) =>
                              a.projectId === project.id && a.personId === p.id,
                          ),
                        );
                      return (
                        <article className="person-card panel" key={p.id}>
                          <div className="person-card-heading">
                            <Avatar name={p.name} />
                            <div>
                              <h2>{p.name}</h2>
                              <p>
                                {profile?.position ||
                                  (p.role === "admin"
                                    ? "Administrator"
                                    : "Lab member")}
                              </p>
                            </div>
                            {admin && (
                              <button
                                disabled={!ready}
                                className="icon-button"
                                aria-label={`Edit account for ${p.name}`}
                                onClick={() => setPerson(p)}
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                          </div>
                          <div className="expertise-tags">
                            {profile?.expertise ? (
                              profile.expertise
                                .split(",")
                                .filter(Boolean)
                                .slice(0, 5)
                                .map((skill, i) => (
                                  <span key={i}>{skill.trim()}</span>
                                ))
                            ) : (
                              <p className="field-help">
                                Expertise not added yet
                              </p>
                            )}
                          </div>
                          <p className="person-projects">
                            {projects.length}{" "}
                            {projects.length === 1 ? "project" : "projects"}
                          </p>
                          <div className="person-card-actions">
                            <button
                              className="button secondary"
                              disabled={!ready}
                              onClick={() => setSelectedPerson(p)}
                            >
                              View profile
                            </button>
                            {admin && p.role === "member" && (
                              <Link
                                aria-label={`Preview ${p.name}`}
                                href={`/?preview=${encodeURIComponent(p.id)}`}
                              >
                                <Eye size={15} />
                                Preview view
                              </Link>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {!filteredPeople.length && (
                    <p className="section-copy">
                      No teammates match this search.
                    </p>
                  )}
                </>
              )}
              {screen === "profile" && (
                <div className="profile-layout">
                  <ProfileForm data={data} saved={refresh} />
                  <aside>
                    {admin && (
                      <section className="panel dashboard-panel email-settings">
                        <div className="section-heading">
                          <h2>Lab email reminders</h2>
                          <Mail size={20} />
                        </div>
                        <p className="section-copy">
                          Send from your existing Gmail account. No purchased
                          domain is needed.
                        </p>
                        <span
                          className={`email-state ${data.emailReady ? "ready" : ""}`}
                        >
                          {data.demo
                            ? "Sample mode"
                            : data.emailReady
                              ? "Gmail configured"
                              : "Gmail setup needed"}
                        </span>
                        <p className="field-help">
                          {data.emailReady
                            ? "Test delivery to your own Google email before relying on scheduled reminders."
                            : "The setup guide explains the two Gmail settings. After saving them in Vercel, redeploy and test here."}
                        </p>
                        <button
                          className="button primary"
                          disabled={
                            busy || (!data.demo && !data.emailReady) || readOnly
                          }
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
                        {data.demo && (
                          <p className="field-help">
                            Preview: “VE Lab · Gmail test”. No email will be
                            sent.
                          </p>
                        )}
                        {data.reminderHealth && (
                          <p className="field-help">
                            {data.reminderHealth.sent} accepted ·{" "}
                            {data.reminderHealth.pending} awaiting review. An
                            uncertain send is held to avoid sending twice.
                          </p>
                        )}
                      </section>
                    )}
                    <section className="panel dashboard-panel guide-card">
                      <h2>Your profile is shared</h2>
                      <p className="section-copy">
                        Your name, skills and research interests help the team
                        find you. Your Google password is never shared with this
                        app.
                      </p>
                    </section>
                  </aside>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {entry && (
        <EntryForm
          data={data}
          initialProjectId={entry.projectId}
          close={() => setEntry(null)}
          saved={refresh}
        />
      )}{" "}
      {editing && (
        <ProjectEditor
          project={editing.project}
          create={editing.create}
          close={() => setEditing(null)}
          saved={refresh}
        />
      )}{" "}
      {person && (
        <PersonEditor
          person={person}
          protectedAccount={Boolean(
            data.protectedPersonIds?.includes(person.id),
          )}
          close={() => setPerson(null)}
          saved={refresh}
        />
      )}{" "}
      {selectedPerson && (
        <Modal
          title={selectedPerson.name}
          close={() => setSelectedPerson(null)}
        >
          <div className="modal-body">
            <p>
              {data.profiles?.find((p) => p.id === selectedPerson.id)
                ?.position || "Lab member"}{" "}
              · {selectedPerson.affiliation || "Venture Engineering Lab"}
            </p>
            <h3>Expertise</h3>
            <p>
              {data.profiles?.find((p) => p.id === selectedPerson.id)
                ?.expertise || "Not added yet"}
            </p>
            <h3>Research interests</h3>
            <p>
              {data.profiles?.find((p) => p.id === selectedPerson.id)?.bio ||
                "Not added yet"}
            </p>
            <h3>Projects</h3>
            {data.projects
              .filter((p) =>
                data.assignments.some(
                  (a) =>
                    a.projectId === p.id && a.personId === selectedPerson.id,
                ),
              )
              .map((p) => (
                <Link
                  className="person-project-link"
                  key={p.id}
                  href={projectHref(p.id)}
                >
                  {p.name}
                  <ChevronRight size={16} />
                </Link>
              ))}
            {selectedPerson.email && (
              <a
                className="button secondary"
                href={`mailto:${selectedPerson.email}`}
              >
                <Mail size={16} />
                Contact by email
              </a>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
  function deadlinePanel() {
    return (
      <section className="panel dashboard-panel">
        <div className="section-heading">
          <h2>Upcoming deadlines</h2>
          <HelpTip label="Deadline reminders">
            Deadlines come from project milestones and your responsibilities.
            Gmail checks them daily and emails members who have reminders
            enabled.
          </HelpTip>
        </div>
        <p className="section-copy">Next seven days and overdue work.</p>
        {deadlines.slice(0, 5).map((d) => (
          <Link
            className="deadline-row"
            href={projectHref(d.projectId)}
            key={d.id}
          >
            <span
              className={`deadline-date ${dayDifference(d.due, data.today) < 0 ? "late" : ""}`}
            >
              {shortDate(d.due)}
            </span>
            <div>
              <strong>{d.title}</strong>
              <p>{data.projects.find((p) => p.id === d.projectId)?.name}</p>
              {dayDifference(d.due, data.today) < 0 && (
                <small className="late-label">Overdue</small>
              )}
            </div>
          </Link>
        ))}
        {!deadlines.length && (
          <p className="quiet-empty">
            No deadlines coming up. You’re clear for now.
          </p>
        )}
        <Link className="section-link" href={href("/profile")}>
          Email preferences <ArrowRight size={14} />
        </Link>
      </section>
    );
  }
}
