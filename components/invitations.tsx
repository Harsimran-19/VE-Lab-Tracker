"use client";
import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Workspace } from "@/lib/types";
import { mutate } from "./forms";
import { Modal } from "./modal";
import { reportDate } from "@/lib/format";

export function InviteMember({ data, projectId = "", saved }: { data: Workspace; projectId?: string; saved: () => Promise<void> }) {
  const [open, setOpen] = useState(false), [email, setEmail] = useState(""), [url, setUrl] = useState("");
  const [id, setId] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [copied, setCopied] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const result = await mutate("/api/invitations", { id, email, projectId }); setUrl(result.url); await saved(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <><button className="button secondary small-button" onClick={() => { setOpen(true); setId(crypto.randomUUID()); setUrl(""); setEmail(""); setError(""); setCopied(false); }}>{projectId ? "Invite new member" : "Add lab member"}</button>
    {open && <Modal title={projectId ? "Invite a project member" : "Add lab member"} close={() => setOpen(false)}><form className="modal-body" onSubmit={submit}>
      <p className="section-copy">Create an invitation and share its link. The recipient signs in with this Google account and fills in their own profile.{projectId && " Accepting also adds them to this project."} Invitations expire after 14 days.</p>
      <label>Member’s Google email<input type="email" required maxLength={300} value={email} disabled={busy || Boolean(url)} onChange={e => setEmail(e.target.value)} /></label>
      {url && <div className="entry-fields"><label>Invitation link<input readOnly value={url} onFocus={e => e.target.select()} /></label><button type="button" className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setError("Select and copy the invitation link above."); } }}>{copied ? "Link copied" : "Copy invitation link"}</button><p role="status">Invitation created. Share the link with {email}.</p></div>}
      {error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Close</button>{!url && <button className="button primary" disabled={busy}>{busy ? "Creating…" : "Create invitation"}</button>}</div>
    </form></Modal>}
  </>;
}

export function InvitationList({ data, projectId = "", saved }: { data: Workspace; projectId?: string; saved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const invites = data.invitations.filter(i => i.projectId === projectId && !i.acceptedAt && !i.revokedAt);
  if (!invites.length) return null;
  return <section className="collaboration-section"><h3>Invitations</h3><ul className="request-list">{invites.map(i => <li key={i.id}><div><strong>{i.email}</strong><p className="field-help">{i.expiresAt <= new Date().toISOString() ? "Expired" : `Expires ${reportDate(i.expiresAt, data.settings.timezone)}`}</p></div><div className="inline-actions"><Link href={`/invite/${i.id}`} prefetch={false}>Invitation link</Link><button className="text-action" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await mutate("/api/invitations", { id: i.id, action: "revoke" }, "PATCH"); await saved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Revoke</button></div></li>)}</ul>{error && <p className="error" role="alert">{error}</p>}</section>;
}

export function InvitationAccept({ id, email, available, projectName }: { id: string; email: string; available: boolean; projectName?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <main className="welcome-page"><section className="welcome-card"><h1>{available ? "You’re invited to the lab" : "This invitation is unavailable"}</h1><p>{available ? projectName ? `Join ${projectName} and introduce yourself to the team.` : "Introduce yourself to the team by completing your profile." : "Check that you are using the invited Google account, or ask the sender for a new invitation."}</p><p>Signed in as <strong>{email}</strong></p>{available && <button className="button primary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await mutate("/api/invitations", { id, action: "accept" }, "PATCH"); window.location.assign("/account"); } catch (e) { setError((e as Error).message); setBusy(false); } }}>{busy ? "Joining…" : "Accept and complete my profile"}</button>}<div className="inline-actions"><Link href="/">Open workspace</Link><button className="text-action" onClick={() => signOut({ callbackUrl: `/invite/${encodeURIComponent(id)}` })}>Use another Google account</button></div>{error && <p className="error" role="alert">{error}</p>}</section></main>;
}
