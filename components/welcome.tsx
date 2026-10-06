"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon as ArrowRight, CheckIcon as Check } from "@phosphor-icons/react";
import { signOut } from "next-auth/react";
import { workspaceFontClasses } from "./workspace-chrome";
import type { Workspace } from "@/lib/types";
import { mutate } from "./forms";
export function Welcome({
  data,
  saved,
}: {
  data: Workspace;
  saved: () => Promise<void>;
}) {
  const heading = useRef<HTMLHeadingElement>(null),
    [step, setStep] = useState(1),
    [search, setSearch] = useState(""),
    [name, setName] = useState(data.identity.name),
    [projects, setProjects] = useState<string[]>(
      data.memberships
        .filter(
          (m) =>
            m.personId === data.identity.personId &&
            data.projects.some(
              (p) => p.id === m.projectId && p.state === "active",
            ),
        )
        .map((m) => m.projectId),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const available = data.projects.filter((p) => p.state === "active");
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  async function finishSetup(projectIds: string[]) {
    setBusy(true);
    setError("");
    try {
      await mutate("/api/onboarding", { name, projectIds });
      await saved();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!name.trim()) {
        setError("Enter your name.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    await finishSetup(projects);
  }
  return (
    <main className={`welcome-page ${workspaceFontClasses}`}>
      <header className="welcome-brand"><span>Venture Engineering Lab Tracker</span>{!data.demo && <button className="text-action" onClick={() => signOut({callbackUrl:"/"})}>Sign out</button>}</header>
      <section className="welcome-card">
        <p className="welcome-progress" aria-label={`Setup step ${step} of 2`}>Step {step} of 2</p>
        <h1 ref={heading} tabIndex={-1}>
          {step === 1 ? "What should we call you?" : "Choose your projects"}
        </h1>
        <p className="lead">
          {step === 1
            ? "Confirm the name your teammates will see. You can change it later."
            : available.length
              ? "Join the projects you work on. You can change this later."
              : "The manager hasn’t created any projects yet. You can finish setup and join when they’re ready."}
        </p>
        <form onSubmit={submit}>
          <fieldset className="entry-fields" disabled={busy}>
            {step === 1 ? (
              <>
                <label>
                  Your name
                  <input
                    required
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="account-note">
                  Signed in as <strong>{data.identity.email}</strong>
                </div>
              </>
            ) : (
              <>
                {available.length > 0 && (
                  <><div className="search-field"><input aria-label="Search projects" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="project-checklist">
                    {available.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).map((p) => (
                      <label
                        key={p.id}
                        className={projects.includes(p.id) ? "selected" : ""}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Join ${p.name}`}
                          checked={projects.includes(p.id)}
                          onChange={(e) =>
                            setProjects(
                              e.target.checked
                                ? [...projects, p.id]
                                : projects.filter((id) => id !== p.id),
                            )
                          }
                        />
                        <span>
                          <strong>{p.name}</strong>
                          <small className="home-phase">{p.phase}</small>
                        </span>
                      </label>
                    ))}
                  </div>{!available.some((p) => p.name.toLowerCase().includes(search.toLowerCase())) && <p className="quiet-empty">No matching projects.</p>}</>
                )}
                {available.length > 0 && (
                  <p className="field-help">
                    {projects.length} {projects.length === 1 ? "project" : "projects"} selected
                  </p>
                )}
              </>
            )}
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="welcome-actions">
            {step === 2 && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setStep(1)}
              >
                Back
              </button>
            )}
            <button className="button primary" disabled={busy}>
              {busy
                ? "Preparing your workspace…"
                : step === 1
                  ? "Continue"
                  : projects.length
                    ? "Open workspace"
                    : available.length
                      ? "Open workspace"
                      : "Finish setup"}
              <ArrowRight size={16} />
            </button>
            {step === 2 && available.length > 0 && <button type="button" className="text-action" disabled={busy} onClick={() => { void finishSetup([]); }}>Skip for now</button>}
          </div>
        </form>
      </section>
    </main>
  );
}
