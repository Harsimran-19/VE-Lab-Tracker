"use client";
import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ArrowRightIcon as ArrowRight, CaretRightIcon as ChevronRight,
  SignOutIcon as LogOut, EnvelopeIcon as Mail,
  PencilSimpleIcon as Pencil, PlusIcon as Plus, MagnifyingGlassIcon as Search,
  UserIcon as UserRound,
} from "@phosphor-icons/react";
import type { Project, Update, Workspace } from "@/lib/types";
import { latestReports, reportDate, shortDate } from "@/lib/format";
import { mutate, ProjectForm, type ProjectAction } from "./forms";
import { EntryForm } from "./entry-form";
import { ProfileForm, SettingsForm } from "./profile-form";
import { Welcome } from "./welcome";
import { TeamDirectory, MemberContact, memberProjects } from "./team-directory";
import type { Screen } from "./workspace-page";
import { WorkspaceChrome } from "./workspace-chrome";
import { HomePage } from "./home-page";
import { ProjectTable } from "./project-table";
import { ProjectWorkspace } from "./project-workspace";
import { UserIcon } from "@phosphor-icons/react";
function Avatar() {
  return (
    <span className="avatar" aria-hidden="true">
      <UserIcon size={24} weight="regular" />
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
    [accountTab, setAccountTab] = useState("details"),
    [onHold, setOnHold] = useState(
      !initial.projects.some(
        (p) => p.state === "active" || p.state === "completed",
      ) && initial.projects.some((p) => p.state === "on-hold"),
    ),
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
    chosen = data.projects.find((p) => p.id === projectId),
    person = data.people.find((p) => p.id === personId);
  const current = data.updates.filter((u) => u.weekStart === data.weekStart),
    reported = (projectId: string, personId: string) =>
      current.some((u) => u.projectId === projectId && u.personId === personId);
  const latest = latestReports(data.updates);
  const filtered = data.projects.filter(
    (p) =>
      p.state === (onHold ? "on-hold" : completed ? "completed" : "active") &&
      (!onlyMine || ownIds.has(p.id)) &&
      `${p.name} ${p.fullTitle ?? ""} ${p.goal}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
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
          <Avatar />
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
              ? "Account"
              : chosen?.name;
  return (
    <WorkspaceChrome screen={screen}>
      <div className="workspace-content">
        {data.demo && (
          <div className="demo-banner">
            <span>
              <strong>Local preview</strong> · Example data. Emails are simulated.
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
        <main id="workspace-main" className={`lab-main${screen === "dashboard" ? " home-main" : ""}`}>
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
          {screen !== "dashboard" && <div className="page-heading">
            <div>

              <h1>{screen === "member" && <UserIcon size={34} aria-hidden="true" />}{heading}</h1>
              <p>
                {screen === "projects"
                    ? `${data.projects.length} research ${data.projects.length === 1 ? "project" : "projects"}`
                    : screen === "team"
                      ? "Find the people behind the work."
                      : screen === "member"
                        ? [person?.academicRole, person?.affiliation].filter(Boolean).join(" · ")
                        : screen === "account"
                          ? "Manage your details and reporting preferences."
                          : chosen?.goal}
              </p>
            </div>
            <div className="page-actions">
              {manager && screen === "projects" && (
                  <button
                    className="button primary"
                    onClick={() => setEditing({ action: "create" })}
                  >
                    <Plus size={16} />
                    New project
                  </button>
                )}
              {screen === "project" && chosen && manager && <button className="button secondary" onClick={() => setEditing({ project: chosen, action: "settings" })}>Project settings</button>}
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
          </div>}
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
            <HomePage
              data={data}
              busy={busy}
              writeUpdate={setEntry}
              createProject={() => setEditing({ action: "create" })}
              changeStatus={async (projectId, workstreamId, status) => {
                await action(async () => {
                  await mutate("/api/workstreams", { action: "status", projectId, workstreamId, status }, "PATCH");
                  await refresh();
                  setNotice(status === "Done" ? "Responsibility completed." : "Responsibility reopened.");
                });
              }}
            />
          )}
          {screen === "projects" && (
            <>
              <div className="directory-toolbar">
                <div className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="Search projects" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                <div className="segmented" aria-label="Project state">
                  {[{label:"Active",state:"active"},{label:"Completed",state:"completed"},{label:"Paused",state:"on-hold"}].map(({label,state}) => <button key={state} className={(onHold ? "on-hold" : completed ? "completed" : "active") === state ? "selected" : ""} aria-pressed={(onHold ? "on-hold" : completed ? "completed" : "active") === state} onClick={() => {setCompleted(state === "completed");setOnHold(state === "on-hold");}}>{label}</button>)}
                </div>
              </div>
              {!manager && own.length > 0 && <label className="check-label scope-toggle"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Only my projects</label>}
              {filtered.length > 0 ? <ProjectTable projects={[...filtered].sort((a,b) => a.name.localeCompare(b.name))} data={data} /> : <section className="empty-state"><h2>{!data.projects.length ? "No projects yet" : search ? "No matching projects" : "No projects in this view"}</h2><p>{!data.projects.length ? manager ? "Create a project with a clear goal to get started." : "Projects will appear when the manager adds them." : "Try another search or project filter."}</p></section>}
            </>
          )}
          {screen === "project" && chosen && <ProjectWorkspace project={chosen} data={data} busy={busy} edit={(action) => setEditing({ project: chosen, action })} saved={refresh} reportCard={reportCard} clearMilestone={async () => {await action(async () => {await mutate("/api/projects", {id:chosen.id,action:"clear-milestone"}, "PATCH");await refresh();setNotice("Milestone removed.");});}} />}
          {screen === "team" && <TeamDirectory data={data} />}
          {screen === "member" && person && (
            <div className="member-workspace">
              <MemberContact person={person} own={person.id === data.identity.personId} />
              <section className="member-section"><h2>Projects</h2>{memberProjects(data,person.id).length ? <ProjectTable projects={memberProjects(data,person.id)} data={data} showLead={false} /> : <p className="quiet-empty">No projects joined yet.</p>}</section>
              <section className="member-section"><h2>Current responsibilities</h2><ul className="member-responsibilities">{active.flatMap((p) => (p.workstreams ?? []).filter((w) => !w.archived && w.ownerId === person.id && w.status !== "Done").map((w) => <li key={w.id}><span>{w.name}</span><Link href={`/projects/${p.id}`} prefetch={false}>{p.name}</Link><span>{w.due ? shortDate(w.due) : "No due date"}</span><span className="home-phase">{w.status}</span></li>))}</ul>{!active.some((p) => (p.workstreams ?? []).some((w) => !w.archived && w.ownerId === person.id && w.status !== "Done")) && <p className="quiet-empty">No current responsibilities.</p>}</section>
              <section className="member-section"><h2>Recent updates</h2><div className="update-feed">{latest.filter((u) => u.personId === person.id).slice(0,3).map(reportCard)}</div>{!latest.some((u) => u.personId === person.id) && <p className="quiet-empty">No updates shared yet.</p>}</section>
            </div>
          )}
          {screen === "account" && (
            <div className="account-workspace">
              {manager && <div className="workspace-tabs" aria-label="Account sections"><button aria-pressed={accountTab === "details"} onClick={() => setAccountTab("details")}>Your details</button><button aria-pressed={accountTab === "lab"} onClick={() => setAccountTab("lab")}>Lab settings <span className="tab-count">Managers only</span></button></div>}
              {accountTab === "details" ? <><ProfileForm data={data} saved={refresh} />{!data.demo && <button className="text-action account-signout" onClick={() => signOut({ callbackUrl:"/" })}>Sign out</button>}</> : manager && <><SettingsForm data={data} saved={refresh} /><details className="email-diagnostics"><summary>Email reminders</summary>
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
              </details></>}
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
    </WorkspaceChrome>
  );
}
