"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FlaskConical } from "lucide-react";
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
    setBusy(true);
    setError("");
    try {
      await mutate("/api/onboarding", { name, projectIds: projects });
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="welcome-page">
      <div className="welcome-brand">
        <FlaskConical size={24} />
        <strong>VE Lab</strong>
        <span>Venture Engineering Lab</span>
      </div>
      <section className="welcome-card">
        <div
          className="welcome-progress"
          aria-label={`Setup step ${step} of 2`}
        >
          <span className={step === 1 ? "current" : "complete"}>
            {step === 1 ? 1 : <Check size={14} />} Your name
          </span>
          <span className={step === 2 ? "current" : ""}>2 Your projects</span>
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {step === 1 ? "What should we call you?" : "Choose your projects"}
        </h1>
        <p className="lead">
          {step === 1
            ? "Confirm the name your teammates will see. You can change it later."
            : available.length
              ? "Select only the projects you work on. These will appear on My work."
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
                  <div className="project-checklist">
                    {available.map((p) => (
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
                          <small>{p.goal}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {available.length > 0 && (
                  <p className="field-help">
                    Joining lets you report your own progress and receive
                    relevant reminders. Your team can read shared project
                    updates.
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
                    ? "Open my work"
                    : available.length
                      ? "Choose projects later"
                      : "Finish setup"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
