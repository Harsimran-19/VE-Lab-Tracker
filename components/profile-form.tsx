"use client";
import { useState } from "react";
import type { ResourceLink, Workspace } from "@/lib/types";
import { mutate } from "./forms";
import { LinkListEditor } from "./link-list";

const TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Shanghai": "China (Beijing, Shanghai) · UTC+8",
  "Asia/Hong_Kong": "Hong Kong · UTC+8",
  "Asia/Singapore": "Singapore · UTC+8",
  "Asia/Tokyo": "Japan · UTC+9",
  "Asia/Kolkata": "India · UTC+5:30",
  "Europe/London": "United Kingdom",
  "America/New_York": "US Eastern",
  "America/Los_Angeles": "US Pacific",
  UTC: "UTC",
};
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
    [bio, setBio] = useState(person.bio ?? ""),
    [interests, setInterests] = useState(person.interests ?? ""),
    [skills, setSkills] = useState(person.skills ?? ""),
    [profileLinks, setProfileLinks] = useState<ResourceLink[]>(person.profileLinks ?? []),
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
        { name, reminders, academicRole, affiliation, bio, interests, skills, profileLinks },
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
      <h2>Profile</h2>
      <p className="section-copy">
        Introduce yourself so lab members can find you. Everything except your
        reminder setting appears in the team directory.
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
            <span>Academic role <span className="optional-label">Optional</span></span>
            <input
              aria-label="Academic role"
              maxLength={150}
              placeholder="e.g. PhD student or research assistant"
              value={academicRole}
              onChange={(e) => setAcademicRole(e.target.value)}
            />
          </label>
          <label>
            <span>Affiliation <span className="optional-label">Optional</span></span>
            <input
              aria-label="Affiliation"
              maxLength={300}
              placeholder="University, school or research group"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
            />
          </label>
        </div>
        <label>
          <span>About you <span className="optional-label">Optional</span></span>
          <textarea
            aria-label="About you"
            rows={3}
            maxLength={1000}
            placeholder="A few sentences about your background and what you work on."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            <span>Research interests <span className="optional-label">Optional</span></span>
            <input
              aria-label="Research interests"
              maxLength={500}
              placeholder="e.g. entrepreneurship education, LLMs"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
            />
          </label>
          <label>
            <span>Skills <span className="optional-label">Optional</span></span>
            <input
              aria-label="Skills"
              maxLength={500}
              placeholder="e.g. Python, interviews, survey design"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </label>
        </div>
        <LinkListEditor label="Profile links" itemName="Profile link" max={5} links={profileLinks} onChange={setProfileLinks} />
        <div className="profile-account"><span>Google account</span><strong>{person.email}</strong></div>
        <section className="profile-reminders"><h2>Reminders</h2>
        <label className="check-label"><input type="checkbox" role="switch" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />Email me relevant reminders</label>
        <p className="field-help">Weekly reminders only for updates you haven’t submitted, plus deadlines for your active projects.</p></section>
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
    ...new Set([form.timezone, ...Object.keys(TIMEZONE_LABELS)]),
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
              <option key={z} value={z}>
                {TIMEZONE_LABELS[z] ?? z}
              </option>
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
      <p className="schedule-preview">Updates are due every {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][Number(form.reportingDay)-1]} at {form.reportingTime} ({form.timezone}).</p>
      <div className="profile-actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save schedule"}
        </button>
      </div>
    </form>
  );
}
