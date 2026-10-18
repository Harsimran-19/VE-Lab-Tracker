"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, PlusIcon } from "@phosphor-icons/react";
import { OUTPUT_KINDS, type OutputVersion, type Project, type Workspace } from "@/lib/types";
import { canEditProject } from "@/lib/access";
import { dayDifference } from "@/lib/calendar";
import { reportDate } from "@/lib/format";
import { versionHistory } from "@/lib/versions";
import { mutate } from "./forms";
import { Modal } from "./modal";

type Kind = (typeof OUTPUT_KINDS)[number];
const KIND_HELP: Record<Kind, string> = {
  Data: "Datasets, survey exports and analysis files. Add a new version whenever the data changes, ideally weekly.",
  Paper: "Drafts and submitted versions of the project paper.",
  Code: "Repositories, notebooks and scripts. Link a commit or release for each version.",
};

export function latestDataUpdate(data: Pick<Workspace, "versions">, projectId: string) {
  return data.versions.filter(v => v.projectId === projectId && v.kind === "Data").map(v => v.createdAt).sort().at(-1);
}

export function ProjectOutputs({ project, data, saved }: { project: Project; data: Workspace; saved: () => Promise<void> }) {
  const [adding, setAdding] = useState<{ kind: Kind; outputId?: string; name?: string } | null>(null);
  const editor = canEditProject(data, data.identity, project) && project.approval !== "rejected";
  const versions = data.versions.filter(v => v.projectId === project.id);
  const lastData = latestDataUpdate(data, project.id);
  const staleDays = lastData ? dayDifference(data.today, lastData.slice(0, 10)) : undefined;
  return <div className="project-outputs">
    <p className="section-copy">Every version is kept. Saving a new version never replaces an earlier one.</p>
    {project.state === "active" && staleDays !== undefined && staleDays > 7 && <p className="info-note">The data was last updated {staleDays} days ago. Add this week’s version when it changes.</p>}
    {OUTPUT_KINDS.map(kind => {
      const items = [...new Set(versions.filter(v => v.kind === kind).map(v => v.outputId))].map(id => versionHistory(versions, id));
      return <section key={kind} className="panel output-panel" aria-label={kind === "Data" ? "Data" : kind === "Paper" ? "Paper" : "Code"}>
        <div className="section-heading">
          <div><h2>{kind === "Data" ? "Data" : kind === "Paper" ? "Paper" : "Code"}</h2><p className="section-copy">{KIND_HELP[kind]}</p></div>
          {editor && <button className="button secondary small-button" onClick={() => setAdding({ kind })}><PlusIcon size={15} aria-hidden="true" />Add {kind === "Data" ? "dataset" : kind.toLowerCase()}</button>}
        </div>
        {!items.length && <p className="quiet-empty">No {kind === "Data" ? "data" : kind.toLowerCase()} versions yet.</p>}
        {items.map(history => <OutputItem key={history[0].outputId} history={history} data={data} add={editor ? () => setAdding({ kind, outputId: history[0].outputId, name: history[0].name }) : undefined} />)}
      </section>;
    })}
    {adding && <VersionDialog project={project} {...adding} close={() => setAdding(null)} saved={saved} />}
  </div>;
}

function OutputItem({ history, data, add }: { history: (OutputVersion & { number: number })[]; data: Workspace; add?: () => void }) {
  const latest = history.at(-1)!;
  const person = (id: string) => data.people.find(p => p.id === id);
  return <article className="output-item">
    <div className="output-head">
      <div><h3>{latest.name} <span className="version-tag">v{latest.number}</span></h3>
        <p className="muted"><a href={latest.url} target="_blank" rel="noopener noreferrer">Open latest version<ArrowUpRightIcon size={14} aria-hidden="true" /></a> · {person(latest.personId)?.name || "Former member"} · {reportDate(latest.createdAt, data.settings.timezone)}</p>
        <p className="responsibility-notes">{latest.notes}</p>
      </div>
      {add && <button className="text-action" onClick={add}>Add new version</button>}
    </div>
    {history.length > 1 && <details className="version-history"><summary>Version history ({history.length})</summary><ol reversed>
      {[...history].reverse().map(v => <li key={v.id}><span className="version-tag">v{v.number}</span><a href={v.url} target="_blank" rel="noopener noreferrer">Open</a><span>{v.notes}</span><span className="muted">{person(v.personId) ? <Link href={`/team/${v.personId}`} prefetch={false}>{person(v.personId)!.name}</Link> : "Former member"} · {reportDate(v.createdAt, data.settings.timezone)}</span></li>)}
    </ol></details>}
  </article>;
}

function VersionDialog({ project, kind, outputId, name: fixedName, close, saved }: { project: Project; kind: Kind; outputId?: string; name?: string; close: () => void; saved: () => Promise<void> }) {
  const [ids] = useState({ id: crypto.randomUUID(), outputId: outputId ?? crypto.randomUUID() });
  const [name, setName] = useState(fixedName ?? ""), [url, setUrl] = useState(""), [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [confirmed, setConfirmed] = useState(false);
  const noun = kind === "Data" ? "dataset" : kind.toLowerCase();
  return <Modal title={outputId ? `New version of ${fixedName}` : `Add ${noun}`} close={close}>
    <form className="modal-body" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { if (!confirmed) { await mutate("/api/versions", { ...ids, projectId: project.id, kind, name, url, notes }); setConfirmed(true); } await saved(); close(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <fieldset className="entry-fields" disabled={busy || confirmed}>
        {!outputId && <label>Name<input required maxLength={150} placeholder={kind === "Data" ? "e.g. Interview transcripts" : kind === "Paper" ? "e.g. Main manuscript" : "e.g. Analysis scripts"} value={name} onChange={e => setName(e.target.value)} /></label>}
        <label>Link to this version<input aria-label="Link to this version" required type="url" maxLength={2000} placeholder={kind === "Code" ? "https://github.com/… (commit or release)" : "https://drive.google.com/…"} value={url} onChange={e => setUrl(e.target.value)} /><span className="field-help">Use a link that points to this exact version, such as a dated file copy, a Drive version, a commit or a release.</span></label>
        <label>What changed?<textarea required rows={3} maxLength={2000} placeholder={outputId ? "e.g. Added 12 new interviews and cleaned column names" : "e.g. First export of the pilot survey"} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      </fieldset>
      {error && <p className="error" role="alert">{confirmed ? "Saved. " : ""}{error}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : confirmed ? "Refresh workspace" : "Save version"}</button></div>
    </form>
  </Modal>;
}
