"use client";
import { useState } from "react";
import type { Workspace } from "@/lib/types";
import { mutate } from "./forms";
export function ProfileForm({
  data,
  saved,
}: {
  data: Workspace;
  saved: () => Promise<void>;
}) {
  const person = data.people.find((p) => p.id === data.identity.personId)!,
    [name, setName] = useState(person.name),
    [reminders, setReminders] = useState(person.reminders !== "false"),
    [academicRole, setAcademicRole] = useState(person.academicRole ?? ""),
    [affiliation, setAffiliation] = useState(person.affiliation ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate(
        "/api/profile",
        { name, reminders, academicRole, affiliation },
        "PATCH",
      );
      await saved();
      setNotice("Account saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel profile-form" onSubmit={submit}>
      <h2>Your account</h2>
      <p className="section-copy">
        Introduce yourself to the lab. Your name, academic role and affiliation
        appear in the team directory.
      </p>
      <fieldset className="entry-fields" disabled={busy}>
        <label>
          Your name
          <input
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Academic role <span className="optional-label">Optional</span>
            <input
              aria-label="Academic role"
              maxLength={150}
              placeholder="e.g. PhD student or research assistant"
              value={academicRole}
              onChange={(e) => setAcademicRole(e.target.value)}
            />
          </label>
          <label>
            Affiliation <span className="optional-label">Optional</span>
            <input
              aria-label="Affiliation"
              maxLength={300}
              placeholder="University, school or research group"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={reminders}
            onChange={(e) => setReminders(e.target.checked)}
          />
          Email me relevant reminders
        </label>
        <p className="field-help">
          Weekly reminders only for updates you haven’t submitted, plus
          deadlines for your active projects.
        </p>
      </fieldset>
      <div className="profile-account">
        <span>Google account</span>
        <strong>{person.email}</strong>
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
      <div className="profile-actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save account"}
        </button>
      </div>
    </form>
  );
}
export function SettingsForm({
  data,
  saved,
}: {
  data: Workspace;
  saved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
      reportingDay: data.settings.reportingDay,
      reportingTime: data.settings.reportingTime,
      timezone: data.settings.timezone,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await mutate("/api/settings", form, "PATCH");
      await saved();
      setNotice("Reporting schedule saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const zones = [
    ...new Set([form.timezone, "Asia/Kolkata", "Asia/Hong_Kong", "UTC"]),
  ];
  return (
    <form className="panel profile-form" onSubmit={submit}>
      <h2>Weekly reporting schedule</h2>
      <p className="section-copy">
        Set this once for the whole team. It controls reporting gaps and
        reminder emails.
      </p>
      <fieldset disabled={busy} className="entry-fields">
        <div className="form-grid">
          <label>
            Reporting day
            <select
              aria-label="Reporting day"
              value={form.reportingDay}
              onChange={(e) =>
                setForm({ ...form, reportingDay: e.target.value })
              }
            >
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reporting time
            <input
              required
              type="time"
              value={form.reportingTime}
              onChange={(e) =>
                setForm({ ...form, reportingTime: e.target.value })
              }
            />
          </label>
        </div>
        <label>
          Lab timezone
          <select
            aria-label="Lab timezone"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          >
            {zones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
      </fieldset>
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
      <div className="profile-actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save schedule"}
        </button>
      </div>
    </form>
  );
}
