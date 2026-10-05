"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FlaskConical } from "lucide-react";
import type { Workspace } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { mutate } from "./forms";
import { HelpTip } from "./help-tip";
export function Welcome({
  data,
  saved,
}: {
  data: Workspace;
  saved: () => Promise<void>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const person = data.people.find((p) => p.id === data.identity.personId);
  const profile = data.profiles?.find((p) => p.id === person?.id);
  const [step, setStep] = useState(1),
    [name, setName] = useState(person?.name ?? data.identity.name),
    [rosterId, setRoster] = useState(""),
    [position, setPosition] = useState(profile?.position ?? ""),
    [expertise, setExpertise] = useState(profile?.expertise ?? ""),
    [projects, setProjects] = useState<string[]>(
      data.assignments
        .filter((a) => a.personId === person?.id)
        .map((a) => a.projectId),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  const candidates = data.people.filter(
    (p) =>
      p.role === "member" &&
      !p.email &&
      !data.onboarding?.some(
        (r) => r.id === p.id && ["archived", "linking"].includes(r.status),
      ),
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate("/api/onboarding", {
        name,
        position,
        expertise,
        rosterId,
        projectIds: projects,
      });
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
            {step > 1 ? <Check size={14} /> : 1} Your name
          </span>
          <span className={step === 2 ? "current" : ""}>2 Your projects</span>
          <span>3 Share progress</span>
        </div>
        <p className="eyebrow">WELCOME TO THE TEAM</p>
        <h1 ref={headingRef} tabIndex={-1}>
          {step === 1
            ? "Let’s get to know you."
            : "Which projects are you working on?"}
        </h1>
        <p className="lead">
          {step === 1
            ? "Choose the name your teammates will see. You can change it later."
            : "Select your projects to build your personal workspace. You can also join later."}
        </p>
        <form onSubmit={submit}>
          <fieldset className="entry-fields" disabled={busy}>
            {step === 1 ? (
              <>
                {candidates.length > 0 && (
                  <>
                    <label>
                      Already in the lab’s spreadsheet?
                      <select
                        aria-label="Existing lab name"
                        value={rosterId}
                        onChange={(e) => {
                          setRoster(e.target.value);
                          const selected = candidates.find(
                            (p) => p.id === e.target.value,
                          );
                          if (selected) {
                            setName(selected.name);
                            setProjects(
                              data.assignments
                                .filter((a) => a.personId === selected.id)
                                .map((a) => a.projectId),
                            );
                          }
                        }}
                      >
                        <option value="">I’m new / enter my own name</option>
                        {candidates.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="field-help">
                      Select your existing name to request your previous project
                      history.{" "}
                      <HelpTip label="Connecting previous work">
                        The lab admin confirms this connection so nobody can
                        claim another person’s work. You can start reporting
                        immediately.
                      </HelpTip>
                    </p>
                  </>
                )}
                <label>
                  Your name
                  <input
                    aria-label="Your name"
                    required
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Position <span className="optional">Optional</span>
                    <select
                      aria-label="Position"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    >
                      <option value="">Choose a position</option>
                      {POSITIONS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Expertise <span className="optional">Optional</span>
                    <input
                      aria-label="Expertise"
                      maxLength={1000}
                      placeholder="e.g. Interviews, LLMs, statistics"
                      value={expertise}
                      onChange={(e) => setExpertise(e.target.value)}
                    />
                  </label>
                </div>
                <p className="field-help">
                  Your expertise helps teammates find you for collaboration.
                </p>
                <div className="account-note">
                  Signed in as <strong>{data.identity.email}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="project-checklist">
                  {data.projects.map((p) => (
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
                              ? [...new Set([...projects, p.id])]
                              : projects.filter((id) => id !== p.id),
                          )
                        }
                      />
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.stage}
                          {p.title ? ` · ${p.title}` : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="field-help">
                  Joining lets you post your own updates and receive deadline
                  reminders. Everyone in this team can read shared progress.
                </p>
                {rosterId && (
                  <p className="info-note">
                    We’ll ask the admin to connect your previous work. You can
                    start using your account now.
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
                onClick={() => setStep(1)}
                disabled={busy}
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
                    ? "Open my workspace"
                    : "Choose projects later"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </section>
      <p className="welcome-footer">
        A small workspace for your team’s research.
      </p>
    </main>
  );
}
