"use client";
import { useId, useState } from "react";
import type { Workspace } from "@/lib/types";
import { POSITIONS } from "@/lib/types";
import { mutate } from "./forms";

export function ProfileForm({
  data,
  saved,
}: {
  data: Workspace;
  saved: () => Promise<void>;
}) {
  const expertiseHelp = useId();
  const person = data.people.find((p) => p.id === data.identity.personId);
  const profile = data.profiles?.find((p) => p.id === data.identity.personId);
  const [form, setForm] = useState({
    name: person?.name ?? data.identity.name,
    affiliation: person?.affiliation ?? "",
    position: profile?.position ?? "",
    expertise: profile?.expertise ?? "",
    bio: profile?.bio ?? "",
    reminders: profile?.reminders !== "false",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await mutate("/api/profile", form, "PATCH");
      await saved();
      setNotice("Profile saved. Your expertise is visible in People.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel profile-form" onSubmit={submit}>
      <fieldset
        disabled={busy || Boolean(data.preview)}
        className="entry-fields"
      >
        <h2>About you</h2>
        <p className="section-copy">
          Help the team understand your work and find you for collaboration.
        </p>
        <div className="form-grid">
          <label>
            Name
            <input
              required
              maxLength={150}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Position
            <select
              aria-label="Position"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            >
              <option value="">Choose your position</option>
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Affiliation
          <input
            maxLength={300}
            value={form.affiliation}
            onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
          />
        </label>
        <label>
          Expertise
          <input
            aria-label="Expertise"
            aria-describedby={expertiseHelp}
            maxLength={1000}
            placeholder="For example: LLMs, qualitative interviews, statistics"
            value={form.expertise}
            onChange={(e) => setForm({ ...form, expertise: e.target.value })}
          />
          <span className="field-help" id={expertiseHelp}>
            Separate skills with commas so people can find you.
          </span>
        </label>
        <label>
          Research interests
          <textarea
            rows={3}
            maxLength={2000}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>
        <div className="profile-section">
          <h2>Deadline emails</h2>
          <p className="section-copy">
            For projects you join: one reminder within three days before a
            deadline, on the due date, and after it passes. Completed
            responsibilities stop sending reminders.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.reminders}
              onChange={(e) =>
                setForm({ ...form, reminders: e.target.checked })
              }
            />
            Send me deadline reminders
          </label>
          <p className="field-help">
            Delivered to your Google account email.{" "}
            {data.demo
              ? "Email sending is off in this sample workspace."
              : !data.emailReady
                ? "The lab administrator still needs to activate email delivery."
                : "The lab checks deadlines daily."}
          </p>
        </div>
      </fieldset>
      <div className="profile-account">
        <span>Google account</span>
        <strong>
          {person?.email ||
            data.identity.email ||
            "Imported account — email not connected"}
        </strong>
        <small>
          Your email and access role are managed separately from your profile.
        </small>
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
        <button
          className="button primary"
          disabled={busy || Boolean(data.preview)}
        >
          {data.preview
            ? "Read-only preview"
            : busy
              ? "Saving…"
              : "Save profile"}
        </button>
      </div>
    </form>
  );
}
