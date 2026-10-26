"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, EnvelopeIcon, MagnifyingGlassIcon, UserIcon } from "@phosphor-icons/react";
import type { Person, Workspace } from "@/lib/types";
import { LinkList } from "./link-list";
import { formatHours, hoursOf } from "./weekly-report";
import { InviteMember, InvitationList } from "./invitations";

export function memberProjects(data: Workspace, personId: string) {
  const joined = new Set(data.memberships.filter((m) => m.personId === personId).map((m) => m.projectId));
  return data.projects.filter((p) => joined.has(p.id)).sort((a,b) => Number(a.state === "completed") - Number(b.state === "completed") || a.name.localeCompare(b.name));
}

export function TeamDirectory({ data, saved }: { data: Workspace; saved: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const people = [...data.people].sort((a,b) => a.name.localeCompare(b.name)).filter((p) => `${p.name} ${p.academicRole || ""} ${p.affiliation || ""} ${p.interests || ""} ${p.skills || ""} ${p.bio || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section aria-label="Team members">
    {data.identity.role === "admin" && <div className="section-heading"><h2>Lab members</h2><InviteMember data={data} saved={saved} /></div>}
    <div className="search-field team-search"><MagnifyingGlassIcon size={20} aria-hidden="true" /><input aria-label="Search people" placeholder="Search by name, interest or skill" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    <div className="directory-table-wrap"><table className="directory-table team-table"><thead><tr><th>Person</th><th>Role</th><th>Affiliation</th><th>Interests</th><th>Projects</th><th><span className="sr-only">View member</span></th></tr></thead><tbody>
      {people.map((p) => <tr key={p.id}><td data-label="Person"><Link className="team-person directory-name" href={`/team/${p.id}`} prefetch={false}><UserIcon size={28} aria-hidden="true" /><span>{p.name}{p.id === data.identity.personId && <small>You</small>}</span></Link></td><td data-label="Role">{p.academicRole || <span className="muted">Not specified</span>}</td><td data-label="Affiliation">{p.affiliation || <span className="muted">Not specified</span>}</td><td data-label="Interests">{p.interests || <span className="muted">Not specified</span>}</td><td data-label="Projects">{memberProjects(data,p.id).map((project,i) => <span key={project.id}>{i > 0 ? " · " : ""}<Link href={`/projects/${project.id}`} prefetch={false}>{project.name}</Link></span>)}{!memberProjects(data,p.id).length && <span className="muted">No projects joined</span>}</td><td><Link className="home-row-link" href={`/team/${p.id}`} prefetch={false} aria-label={`View ${p.name}`}><ArrowRightIcon size={20} aria-hidden="true" /></Link></td></tr>)}
    </tbody></table></div>
    {!people.length && <p className="quiet-empty">No people match this search.</p>}
    <p className="team-guidance">Team members appear here after signing in.</p>
    {data.identity.role === "admin" && <InvitationList data={data} saved={saved} />}
  </section>;
}

export function MemberContact({ person, own }: { person: Person; own: boolean }) {
  return <div className="member-contact-line"><a href={`mailto:${person.email}`}><EnvelopeIcon size={18} aria-hidden="true" />{person.email}</a>{own && <Link className="text-action" href="/account" prefetch={false}>Edit my account</Link>}</div>;
}

export function MemberProfile({ person, data }: { person: Person; data: Workspace }) {
  const reports = data.updates.filter(u => u.personId === person.id && u.hours);
  const week = reports.filter(u => u.weekStart === data.weekStart).reduce((s, u) => s + hoursOf(u), 0);
  const total = reports.reduce((s, u) => s + hoursOf(u), 0);
  if (!person.bio && !person.interests && !person.skills && !person.profileLinks?.length && !reports.length) return null;
  return <section className="member-section member-profile"><h2>Profile</h2>
    {person.bio && <p className="member-bio">{person.bio}</p>}
    <dl className="research-details">
      {person.interests && <div><dt>Research interests</dt><dd>{person.interests}</dd></div>}
      {person.skills && <div><dt>Skills</dt><dd>{person.skills}</dd></div>}
      {!!person.profileLinks?.length && <div><dt>Links</dt><dd><LinkList links={person.profileLinks} /></dd></div>}
      {reports.length > 0 && <div><dt>Hours reported</dt><dd>{formatHours(week)} this week · {formatHours(total)} in total</dd></div>}
    </dl>
  </section>;
}
