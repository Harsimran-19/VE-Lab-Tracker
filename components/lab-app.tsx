"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
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
      {value}
    </span>
  );
}
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <FolderKanban size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
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
    [stageFilter, setStageFilter] = useState(""),
    [onlyMine, setOnlyMine] = useState(false);
  const [personFilter, setPersonFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [limit, setLimit] = useState(12);
  const [entry, setEntry] = useState<{ projectId?: string } | null>(null),
    [editing, setEditing] = useState<{
      project: Project;
      create?: boolean;
    } | null>(null);
  const [person, setPerson] = useState<Person | null>(null),
    [selectedPerson, setSelectedPerson] = useState<Person | null>(null),
    [tab, setTab] = useState("updates");
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
  );
  const ownIds = new Set(own.map((a) => a.projectId)),
    myProjects = data.projects.filter((p) => ownIds.has(p.id));
  const sorted = [...data.updates].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const latest = latestByAssignment(data.updates),
    blocked = latest.filter(
      (u) =>
        u.status !== "Done" && (u.status === "Blocked" || u.blockers.trim()),
    );
  const reported = (id: string, memberId: string) =>
    data.updates.some(
      (u) =>
        u.projectId === id &&
        u.personId === memberId &&
        reportedThisWeek(u.createdAt, data.weekStart, data.timezone),
    );
  const activeOwnIds = new Set(
    own.filter((a) => a.status !== "Done").map((a) => a.projectId),
  );
  const dueUpdates = myProjects.filter(
    (p) => activeOwnIds.has(p.id) && !reported(p.id, data.identity.personId),
  );
  const pairs = data.assignments
    .filter((a) => a.status !== "Done")
    .filter(
      (a, i, rows) =>
        rows.findIndex(
          (r) => r.projectId === a.projectId && r.personId === a.personId,
        ) === i,
    );
  const gaps = pairs.filter((a) => !reported(a.projectId, a.personId));
  const deadlines = [
    ...data.projects
      .filter(
        (p) =>
          p.due &&
          p.pipeline !== "Accepted" &&
          (admin || activeOwnIds.has(p.id)),
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
        id: `a-${a.id}`,
        projectId: a.projectId,
        title: a.responsibility,
        due: a.due,
      })),
  ]
    .filter((d) => dayDifference(d.due, data.today) <= 7)
    .sort((a, b) => a.due.localeCompare(b.due));
  const chosen = data.projects.find((p) => p.id === projectId);
  const filteredProjects = data.projects.filter(
    (p) =>
      (!onlyMine || ownIds.has(p.id)) &&
      (!stageFilter || p.stage === stageFilter) &&
      `${p.name} ${p.title} ${p.methods}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const filteredPeople = data.people.filter((p) => {
    const profile = data.profiles?.find((r) => r.id === p.id);
    return `${p.name} ${p.affiliation} ${profile?.position ?? ""} ${profile?.expertise ?? ""} ${profile?.bio ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  const projectUpdates = sorted.filter(
    (u) =>
      u.projectId === projectId &&
      (!personFilter || u.personId === personFilter) &&
      (!statusFilter ||
        (statusFilter === "Blocked"
          ? u.status === "Blocked" || Boolean(u.blockers)
          : u.status === statusFilter)) &&
      `${u.progress} ${u.blockers} ${data.people.find((p) => p.id === u.personId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
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
  async function copyLink() {
    await action(async () => {
      await navigator.clipboard.writeText(window.location.origin);
      setNotice("Invite link copied. Members join with their Google account.");
    });
  }
  async function join(id: string) {
    await action(async () => {
      await mutate("/api/join", { projectId: id });
      await refresh();
      setNotice("You joined this project. You can now share weekly updates.");
    });
  }
  function updateCard(update: Update) {
    const author = data.people.find((p) => p.id === update.personId);
    return (
      <article className="update-card" key={update.id}>
        <div className="update-card-head">
          <Avatar name={author?.name ?? "Member"} />
          <div>
            <strong>{author?.name ?? "Member"}</strong>
            <p>{reportDate(update.createdAt, data.timezone)}</p>
          </div>
          <Status value={update.status} />
        </div>
        <p className="update-progress">{update.progress}</p>
        {update.blockers && (
          <div className="blocker">
            <CircleHelp size={16} />
            <p>{update.blockers}</p>
          </div>
        )}
        {update.nextPlan && (
          <p className="next-plan">
            <strong>Next week:</strong> {update.nextPlan}
          </p>
        )}
      </article>
    );
  }
  function projectCard(project: Project) {
    const members = data.people.filter((p) =>
      data.assignments.some(
        (a) => a.projectId === project.id && a.personId === p.id,
      ),
    );
    const last = sorted.find((u) => u.projectId === project.id);
    const activeMembers = members.filter((p) =>
      data.assignments.some(
        (a) =>
          a.projectId === project.id &&
          a.personId === p.id &&
          a.status !== "Done",
      ),
    );
    const shared = activeMembers.filter((p) =>
      reported(project.id, p.id),
    ).length;
    const help = blocked.filter((u) => u.projectId === project.id).length;
    return (
      <Link
        prefetch={false}
        href={projectHref(project.id)}
        className="research-card"
        key={project.id}
      >
        <div className="research-card-top">
          <span className="project-code">
            {project.id.startsWith("P-") ? "RESEARCH" : project.id}
          </span>
          <span className="stage-pill">{project.stage}</span>
        </div>
        <h2>{project.name}</h2>
        <p className="project-description">
          {project.title ||
            project.milestone ||
            "Open the workspace to see research details and team progress."}
        </p>
        <div className="project-team">
          <div className="avatar-stack">
            {members.slice(0, 3).map((p) => (
              <Avatar key={p.id} name={p.name} />
            ))}
          </div>
          <span>
            {members.length
              ? `${members.length} ${members.length === 1 ? "member" : "members"}`
              : "Open to collaborators"}
          </span>
          {ownIds.has(project.id) && (
            <span className="joined-label">Joined</span>
          )}
        </div>
        <div className="project-weekly-health">
          <span>
            {activeMembers.length
              ? `${shared}/${activeMembers.length} shared this week`
              : "No active memberships"}
          </span>
          {help > 0 && <span className="help-label">{help} need help</span>}
        </div>
        <div className="research-card-bottom">
          <span>
            {last
              ? `Updated ${shortDate(last.createdAt)}`
              : "No weekly updates yet"}
          </span>
          <ArrowUpRight size={17} />
        </div>
      </Link>
    );
  }
  const heading =
    screen === "dashboard"
      ? admin
        ? "Lab dashboard"
        : "My dashboard"
      : screen === "projects"
        ? "Projects"
        : screen === "people"
          ? "People"
          : screen === "profile"
            ? "My profile"
            : chosen?.name;
  const subtitle =
    screen === "dashboard"
      ? admin
        ? "A clear view of progress, reporting gaps and work that needs attention."
        : "Your research, this week’s updates and upcoming deadlines."
      : screen === "projects"
        ? "Explore the lab’s research. Open a project to see the team’s progress or join in."
        : screen === "people"
          ? "Find the right collaborator by expertise, research interests or project."
          : screen === "profile"
            ? "Introduce yourself to the lab and choose your reminder preferences."
            : chosen?.title ||
              "A shared workspace for research and weekly progress.";
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
            <small>RESEARCH WORKSPACE</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {[
            {
              label: "Dashboard",
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
              label: "People",
              path: "/people",
              icon: Users,
              active: screen === "people",
            },
          ].map((item) => (
            <Link
              key={item.path}
              prefetch={false}
              href={href(item.path)}
              className={item.active ? "active" : ""}
              aria-current={item.active ? "page" : undefined}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="lab-account">
          <button
            className="icon-button"
            aria-label="Refresh workspace"
            disabled={busy || !ready}
            onClick={() => action(refresh)}
          >
            <RefreshCw size={17} />
          </button>
          <details className="account-menu">
            <summary aria-label="Account menu">
              <Avatar name={data.identity.name} />
              <span>
                {data.people.find((p) => p.id === data.identity.personId)
                  ?.name || data.identity.name}
                <small>{admin ? "Administrator" : "Lab member"}</small>
              </span>
            </summary>
            <div className="account-dropdown">
              <Link href={href("/profile")}>My profile</Link>
              {!data.demo && !readOnly && (
                <button onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogOut size={15} />
                  Sign out
                </button>
              )}
            </div>
          </details>
        </div>
      </header>
      {data.demo && (
        <div className="demo-banner">
          <span>
            <strong>Sample workspace</strong> · Local data resets on server
            restart. Emails are disabled.
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
              <Eye size={18} />
              Member preview: {data.identity.name}
            </strong>
            <p>Read-only. You remain signed in as {data.preview?.adminName}.</p>
          </div>
          <Link className="button secondary" href="/people">
            Return to admin
          </Link>
        </section>
      )}
      <main id="workspace-main" className="lab-main">
        {screen === "project" && (
          <Link className="breadcrumb" href={href("/projects")}>
            Projects <ChevronRight size={14} /> Project workspace
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
            <p>{subtitle}</p>
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
            {screen === "dashboard" && !admin && own.length > 0 && (
              <button
                className="button primary"
                disabled={!ready}
                onClick={() => setEntry({})}
              >
                <Plus size={17} />
                Weekly update
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
                    <Plus size={16} />
                    Weekly update
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
          <div className="error global-error" role="alert">
            {error}
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <p className="success workspace-notice" role="status">
            {notice}
            <button
              className="icon-button"
              aria-label="Dismiss notice"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </p>
        )}
        {data.needsSetup ? (
          <section className="panel setup-panel">
            <FlaskConical size={36} />
            <h2>Prepare the lab once</h2>
            <p>
              Initialize the new spreadsheet, then invite the lab. Members
              create their own account with Google.
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
                <div className="dashboard-metrics">
                  <div>
                    <span>{admin ? "Research projects" : "My projects"}</span>
                    <strong>
                      {admin ? data.projects.length : myProjects.length}
                    </strong>
                    <FolderKanban size={20} />
                  </div>
                  <div>
                    <span>
                      {admin
                        ? "Updates missing this week"
                        : "Updates to share this week"}
                    </span>
                    <strong>{admin ? gaps.length : dueUpdates.length}</strong>
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <span>
                      {admin ? "Responsibilities needing help" : "My blockers"}
                    </span>
                    <strong>
                      {admin
                        ? blocked.length
                        : blocked.filter(
                            (u) => u.personId === data.identity.personId,
                          ).length}
                    </strong>
                    <CircleHelp size={20} />
                  </div>
                </div>
                {!admin && !own.length && (
                  <section className="welcome-panel">
                    <div>
                      <span className="welcome-icon">
                        <FlaskConical size={26} />
                      </span>
                      <h2>Your account is ready.</h2>
                      <p>
                        Start by joining a project. Then share a weekly update
                        and get to know your collaborators.
                      </p>
                      <Link className="button primary" href={href("/projects")}>
                        Explore projects
                        <ArrowRight size={16} />
                      </Link>
                      <Link
                        className="welcome-profile-link"
                        href={href("/profile")}
                      >
                        Add your expertise to your profile
                      </Link>
                    </div>
                  </section>
                )}
                <div className="dashboard-columns">
                  <div>
                    {admin ? (
                      <section className="panel dashboard-panel">
                        <div className="section-heading">
                          <h2>Needs attention</h2>
                          <span className="count-label">
                            {blocked.length} blockers
                          </span>
                        </div>
                        {blocked.length ? (
                          blocked.slice(0, 5).map((u) => (
                            <Link
                              href={projectHref(u.projectId)}
                              className="attention-row"
                              key={u.id}
                            >
                              <span className="attention-dot" />
                              <div>
                                <strong>
                                  {
                                    data.projects.find(
                                      (p) => p.id === u.projectId,
                                    )?.name
                                  }
                                </strong>
                                <p>
                                  {
                                    data.people.find((p) => p.id === u.personId)
                                      ?.name
                                  }{" "}
                                  · {u.blockers || u.progress}
                                </p>
                              </div>
                              <ChevronRight size={16} />
                            </Link>
                          ))
                        ) : (
                          <Empty title="No reported blockers">
                            The team’s latest updates have no open blockers.
                          </Empty>
                        )}
                        {blocked.length > 5 && (
                          <Link
                            className="section-link"
                            href={href("/projects")}
                          >
                            Review projects
                            <ArrowRight size={15} />
                          </Link>
                        )}
                      </section>
                    ) : (
                      own.length > 0 && (
                        <section className="panel dashboard-panel">
                          <div className="section-heading">
                            <h2>This week’s updates</h2>
                            <span className="count-label">
                              {dueUpdates.length} to share
                            </span>
                          </div>
                          {myProjects.map((p) => (
                            <div className="weekly-row" key={p.id}>
                              <div>
                                <Link href={projectHref(p.id)}>{p.name}</Link>
                                <span>
                                  {reported(p.id, data.identity.personId)
                                    ? "Shared this week"
                                    : activeOwnIds.has(p.id)
                                      ? "Waiting for your update"
                                      : "Your responsibilities are complete"}
                                </span>
                              </div>
                              {reported(p.id, data.identity.personId) ||
                              !activeOwnIds.has(p.id) ? (
                                <CheckCircle2
                                  className="green-icon"
                                  size={20}
                                />
                              ) : (
                                <button
                                  className="button secondary small-button"
                                  disabled={!ready}
                                  aria-label={`Update ${p.name}`}
                                  onClick={() => setEntry({ projectId: p.id })}
                                >
                                  Write update
                                </button>
                              )}
                            </div>
                          ))}
                        </section>
                      )
                    )}
                    <section className="panel dashboard-panel">
                      <div className="section-heading">
                        <h2>
                          {admin ? "Weekly reporting" : "Recent team activity"}
                        </h2>
                        {admin && (
                          <span className="count-label">
                            {pairs.length - gaps.length}/{pairs.length} shared
                          </span>
                        )}
                      </div>
                      {admin ? (
                        <>
                          <p className="section-copy">
                            One update per active member and project each week.
                            History stays in the project workspace.
                          </p>
                          {gaps.slice(0, 5).map((a) => (
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
                                    data.people.find((p) => p.id === a.personId)
                                      ?.name
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
                            <Empty title="Everyone is up to date">
                              All active project memberships have an update this
                              week.
                            </Empty>
                          )}
                          {gaps.length > 5 && (
                            <p className="field-help">
                              {gaps.length - 5} more memberships awaiting an
                              update. Open Projects to review each team.
                            </p>
                          )}
                        </>
                      ) : (
                        sorted
                          .filter((u) => ownIds.has(u.projectId))
                          .slice(0, 4)
                          .map((u) => (
                            <Link
                              className="activity-row"
                              href={projectHref(u.projectId)}
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
                                <p>
                                  {
                                    data.projects.find(
                                      (p) => p.id === u.projectId,
                                    )?.name
                                  }
                                </p>
                                <span>{u.progress}</span>
                              </div>
                              <small>{shortDate(u.createdAt)}</small>
                            </Link>
                          ))
                      )}
                      {!admin &&
                        !sorted.some((u) => ownIds.has(u.projectId)) && (
                          <Empty title="Progress starts here">
                            Your projects’ weekly updates will appear here.
                          </Empty>
                        )}
                    </section>
                  </div>
                  <aside>
                    <section className="panel dashboard-panel">
                      <div className="section-heading">
                        <h2>Deadlines</h2>
                        <CalendarDays size={19} />
                      </div>
                      <p className="section-copy">
                        Next seven days and overdue work.
                      </p>
                      {deadlines.slice(0, 6).map((d) => (
                        <Link
                          className="deadline-row"
                          href={projectHref(d.projectId)}
                          key={d.id}
                        >
                          <span
                            className={
                              dayDifference(d.due, data.today) < 0
                                ? "deadline-date late"
                                : "deadline-date"
                            }
                          >
                            {shortDate(d.due)}
                          </span>
                          <div>
                            <strong>{d.title}</strong>
                            <p>
                              {
                                data.projects.find((p) => p.id === d.projectId)
                                  ?.name
                              }
                            </p>
                            {dayDifference(d.due, data.today) < 0 && (
                              <small className="late-label">Overdue</small>
                            )}
                          </div>
                        </Link>
                      ))}
                      {!deadlines.length && (
                        <Empty title="No upcoming deadlines">
                          Project milestones and responsibility due dates appear
                          here.
                        </Empty>
                      )}
                    </section>
                    <section className="collaboration-note">
                      <Users size={24} />
                      <h2>Research works better together.</h2>
                      <p>
                        Find a lab member with the skills your project needs.
                      </p>
                      <Link href={href("/people")}>
                        Explore expertise
                        <ArrowRight size={16} />
                      </Link>
                    </section>
                    {admin && (
                      <section className="panel email-status">
                        <div>
                          <Mail size={18} />
                          <h3>Deadline emails</h3>
                        </div>
                        <p>
                          {data.demo
                            ? "Disabled in sample mode."
                            : data.emailReady
                              ? "Configured. Deadlines are checked daily after deployment."
                              : "Not activated yet. Add the sender and email keys in Vercel."}
                        </p>
                        {!data.demo && data.reminderHealth && (
                          <small>
                            {data.reminderHealth.sent} accepted ·{" "}
                            {data.reminderHealth.pending} awaiting confirmation
                          </small>
                        )}
                        {!data.demo && !data.emailReady && (
                          <p className="field-help">
                            Follow the Email alerts section in the setup guide.
                          </p>
                        )}
                      </section>
                    )}
                  </aside>
                </div>
              </>
            )}
            {screen === "projects" && (
              <>
                <div className="directory-toolbar">
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      disabled={!ready}
                      aria-label="Search projects"
                      placeholder="Search projects or methods…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Filter research stage"
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                  >
                    <option value="">All research phases</option>
                    {STAGES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <div className="segmented-filter">
                    <button
                      className={!onlyMine ? "active" : ""}
                      onClick={() => setOnlyMine(false)}
                    >
                      All projects
                    </button>
                    <button
                      className={onlyMine ? "active" : ""}
                      onClick={() => setOnlyMine(true)}
                    >
                      My projects
                    </button>
                  </div>
                </div>
                <p className="directory-count">
                  {filteredProjects.length}{" "}
                  {filteredProjects.length === 1 ? "project" : "projects"}
                </p>
                <div className="project-grid">
                  {filteredProjects.map(projectCard)}
                </div>
                {!filteredProjects.length && (
                  <Empty title="No matching projects">
                    Try another search or switch to All projects.
                  </Empty>
                )}
              </>
            )}
            {screen === "project" && chosen && (
              <>
                <section className="project-overview panel">
                  <div className="project-overview-meta">
                    <span className="stage-pill">{chosen.stage}</span>
                    <span>
                      {
                        data.people.filter((p) =>
                          data.assignments.some(
                            (a) =>
                              a.projectId === chosen.id && a.personId === p.id,
                          ),
                        ).length
                      }{" "}
                      team members
                    </span>
                    <span>
                      {
                        data.updates.filter((u) => u.projectId === chosen.id)
                          .length
                      }{" "}
                      weekly updates
                    </span>
                    {ownIds.has(chosen.id) && (
                      <span className="joined-label">You’re on this team</span>
                    )}
                  </div>
                  <div
                    className="phase-track"
                    aria-label={`Research phase: ${chosen.stage}`}
                  >
                    {STAGES.map((stage, i) => (
                      <div
                        key={stage}
                        className={
                          i <
                          STAGES.indexOf(
                            chosen.stage as (typeof STAGES)[number],
                          )
                            ? "complete"
                            : stage === chosen.stage
                              ? "current"
                              : ""
                        }
                      >
                        <span>
                          {i <
                          STAGES.indexOf(
                            chosen.stage as (typeof STAGES)[number],
                          ) ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <small>{stage}</small>
                      </div>
                    ))}
                  </div>
                  <div className="milestone-strip">
                    <CalendarDays size={19} />
                    <div>
                      <span>Next milestone</span>
                      <strong>
                        {chosen.milestone || "No milestone set yet"}
                      </strong>
                    </div>
                    <p>
                      {chosen.due
                        ? `Due ${shortDate(chosen.due)}`
                        : "No deadline set"}
                    </p>
                  </div>
                </section>
                <div
                  className="workspace-tabs"
                  role="tablist"
                  aria-label="Project sections"
                  onKeyDown={(event) => {
                    const ids = ["updates", "team", "details"];
                    const current = ids.indexOf(tab);
                    const next =
                      event.key === "ArrowRight"
                        ? (current + 1) % 3
                        : event.key === "ArrowLeft"
                          ? (current + 2) % 3
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? 2
                              : -1;
                    if (next >= 0) {
                      event.preventDefault();
                      setTab(ids[next]);
                      document.getElementById(`tab-${ids[next]}`)?.focus();
                    }
                  }}
                >
                  {[
                    { id: "updates", label: "Weekly updates" },
                    { id: "team", label: "Team & responsibilities" },
                    { id: "details", label: "Research details" },
                  ].map((t) => (
                    <button
                      role="tab"
                      disabled={!ready}
                      tabIndex={tab === t.id ? 0 : -1}
                      id={`tab-${t.id}`}
                      aria-selected={tab === t.id}
                      aria-controls={`panel-${t.id}`}
                      key={t.id}
                      className={tab === t.id ? "active" : ""}
                      onClick={() => {
                        setTab(t.id);
                        setSearch("");
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <section
                  role="tabpanel"
                  id={`panel-${tab}`}
                  aria-labelledby={`tab-${tab}`}
                >
                  {tab === "updates" && (
                    <>
                      <div className="section-heading">
                        <div>
                          <h2>Team progress</h2>
                          <p>
                            Everyone’s weekly updates, newest first. Use the
                            history to review progress over time.
                          </p>
                        </div>
                        {ownIds.has(chosen.id) && (
                          <button
                            className="button secondary"
                            disabled={!ready}
                            onClick={() => setEntry({ projectId: chosen.id })}
                          >
                            Write weekly update
                          </button>
                        )}
                      </div>
                      <div className="directory-toolbar">
                        <div className="search-field">
                          <Search size={17} />
                          <input
                            aria-label="Search weekly updates"
                            placeholder="Search progress or blockers…"
                            value={search}
                            onChange={(e) => {
                              setSearch(e.target.value);
                              setLimit(12);
                            }}
                          />
                        </div>
                        <select
                          aria-label="Filter by person"
                          value={personFilter}
                          onChange={(e) => {
                            setPersonFilter(e.target.value);
                            setLimit(12);
                          }}
                        >
                          <option value="">Everyone</option>
                          {data.people
                            .filter(
                              (p) =>
                                data.assignments.some(
                                  (a) =>
                                    a.projectId === chosen.id &&
                                    a.personId === p.id,
                                ) ||
                                data.updates.some(
                                  (u) =>
                                    u.projectId === chosen.id &&
                                    u.personId === p.id,
                                ),
                            )
                            .map((p) => (
                              <option value={p.id} key={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        <select
                          aria-label="Filter by status"
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setLimit(12);
                          }}
                        >
                          <option value="">All statuses</option>
                          <option>On track</option>
                          <option>Blocked</option>
                          <option>Done</option>
                        </select>
                      </div>
                      <div className="weekly-feed">
                        {projectUpdates.slice(0, limit).map(updateCard)}
                      </div>
                      {!projectUpdates.length && (
                        <Empty
                          title={
                            search || personFilter || statusFilter
                              ? "No matching updates"
                              : "No weekly updates yet"
                          }
                        >
                          {ownIds.has(chosen.id)
                            ? "Share your progress to start the project history."
                            : "Join this project to share your own progress."}
                        </Empty>
                      )}
                      {projectUpdates.length > limit && (
                        <button
                          className="button secondary load-more"
                          onClick={() => setLimit(limit + 12)}
                        >
                          Load older updates
                        </button>
                      )}
                    </>
                  )}
                  {tab === "team" && (
                    <div className="panel project-team-panel">
                      <AssignmentList
                        data={data}
                        projectId={chosen.id}
                        refresh={refresh}
                      />
                      {data.collaborators.filter(
                        (c) => c.projectId === chosen.id,
                      ).length > 0 && (
                        <section className="detail-section">
                          <h3>External collaborators</h3>
                          {data.collaborators
                            .filter((c) => c.projectId === chosen.id)
                            .map((c) => (
                              <div className="assignment-row" key={c.id}>
                                <div>
                                  <strong>{c.name}</strong>
                                  <p>
                                    {c.affiliation} · {c.role}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </section>
                      )}
                      <Link className="section-link" href={href("/people")}>
                        Find collaborators in People
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  )}
                  {tab === "details" && (
                    <div className="panel research-details">
                      <h2>Research details</h2>
                      <dl>
                        <div>
                          <dt>Purpose / research title</dt>
                          <dd>{chosen.title || "Not added yet"}</dd>
                        </div>
                        <div>
                          <dt>Methods</dt>
                          <dd>{chosen.methods || "Not added yet"}</dd>
                        </div>
                        <div>
                          <dt>Publication status</dt>
                          <dd>{chosen.pipeline}</dd>
                        </div>
                        <div>
                          <dt>Target journal</dt>
                          <dd>{chosen.journal || "Not set"}</dd>
                        </div>
                        <div>
                          <dt>Target conference</dt>
                          <dd>{chosen.conference || "Not set"}</dd>
                        </div>
                        <div>
                          <dt>Priority</dt>
                          <dd>{chosen.priority}</dd>
                        </div>
                        <div>
                          <dt>Notes</dt>
                          <dd>{chosen.notes || "No notes yet"}</dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </section>
              </>
            )}
            {screen === "people" && (
              <>
                <div className="directory-toolbar">
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      disabled={!ready}
                      aria-label="Search people and expertise"
                      placeholder="Search a name, skill or research interest…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Link className="button secondary" href={href("/profile")}>
                    Add my expertise
                  </Link>
                </div>
                <p className="directory-count">
                  {filteredPeople.length} lab members
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
                        <p className="person-affiliation">
                          {p.affiliation || "Venture Engineering Lab"}
                        </p>
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
                            <span className="no-expertise">
                              Expertise not added yet
                            </span>
                          )}
                        </div>
                        <p className="person-projects">
                          {projects.length}{" "}
                          {projects.length === 1 ? "project" : "projects"}
                          {projects[0]
                            ? ` · ${projects[0].name}`
                            : " · Ready to collaborate"}
                        </p>
                        <div className="person-card-footer">
                          <button
                            className="text-link"
                            disabled={!ready}
                            onClick={() => setSelectedPerson(p)}
                          >
                            View profile
                            <ArrowRight size={14} />
                          </button>
                          {admin && p.role === "member" && (
                            <Link
                              aria-label={`Preview ${p.name}`}
                              className="icon-button"
                              href={`/?preview=${encodeURIComponent(p.id)}`}
                            >
                              <Eye size={16} />
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!filteredPeople.length && (
                  <Empty title="No matching collaborators">
                    Try a name or a different skill.
                  </Empty>
                )}
              </>
            )}
            {screen === "profile" && (
              <ProfileForm data={data} saved={refresh} />
            )}
          </>
        )}
        <footer className="workspace-footer">
          <span>Venture Engineering Lab</span>
          <span>
            {data.demo ? "Sample data" : "Weekly research workspace"} ·{" "}
            {data.timezone}
          </span>
        </footer>
      </main>
      {entry && (
        <EntryForm
          data={data}
          initialProjectId={entry.projectId}
          close={() => setEntry(null)}
          saved={refresh}
        />
      )}
      {editing && (
        <ProjectEditor
          project={editing.project}
          create={editing.create}
          close={() => setEditing(null)}
          saved={refresh}
        />
      )}
      {person && (
        <PersonEditor
          person={person}
          protectedAccount={data.protectedPersonIds?.includes(person.id)}
          close={() => setPerson(null)}
          saved={refresh}
        />
      )}
      {selectedPerson && (
        <Modal
          title={selectedPerson.name}
          close={() => setSelectedPerson(null)}
        >
          <div className="modal-body person-detail">
            <Avatar name={selectedPerson.name} />
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
                    a.personId === selectedPerson.id && a.projectId === p.id,
                ),
              )
              .map((p) => (
                <Link
                  className="person-project-link"
                  key={p.id}
                  href={projectHref(p.id)}
                >
                  {p.name}
                  <ArrowUpRight size={15} />
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
}
