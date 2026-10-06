"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, EnvelopeIcon, MagnifyingGlassIcon, UserIcon } from "@phosphor-icons/react";
import type { Person, Workspace } from "@/lib/types";

export function memberProjects(data: Workspace, personId: string) {
  const joined = new Set(data.memberships.filter((m) => m.personId === personId).map((m) => m.projectId));
  return data.projects.filter((p) => joined.has(p.id)).sort((a,b) => Number(a.state === "completed") - Number(b.state === "completed") || a.name.localeCompare(b.name));
}

export function TeamDirectory({ data }: { data: Workspace }) {
  const [search, setSearch] = useState("");
  const people = [...data.people].sort((a,b) => a.name.localeCompare(b.name)).filter((p) => `${p.name} ${p.academicRole || ""} ${p.affiliation || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section aria-label="Team members">
    <div className="search-field team-search"><MagnifyingGlassIcon size={20} aria-hidden="true" /><input aria-label="Search people" placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    <div className="directory-table-wrap"><table className="directory-table team-table"><thead><tr><th>Person</th><th>Role</th><th>Affiliation</th><th>Projects</th><th><span className="sr-only">View member</span></th></tr></thead><tbody>
      {people.map((p) => <tr key={p.id}><td data-label="Person"><Link className="team-person directory-name" href={`/team/${p.id}`} prefetch={false}><UserIcon size={28} aria-hidden="true" /><span>{p.name}{p.id === data.identity.personId && <small>You</small>}</span></Link></td><td data-label="Role">{p.academicRole || <span className="muted">Not specified</span>}</td><td data-label="Affiliation">{p.affiliation || <span className="muted">Not specified</span>}</td><td data-label="Projects">{memberProjects(data,p.id).map((project,i) => <span key={project.id}>{i > 0 ? " · " : ""}<Link href={`/projects/${project.id}`} prefetch={false}>{project.name}</Link></span>)}{!memberProjects(data,p.id).length && <span className="muted">No projects joined</span>}</td><td><Link className="home-row-link" href={`/team/${p.id}`} prefetch={false} aria-label={`View ${p.name}`}><ArrowRightIcon size={20} aria-hidden="true" /></Link></td></tr>)}
    </tbody></table></div>
    {!people.length && <p className="quiet-empty">No people match this search.</p>}
    <p className="team-guidance">Team members appear here after signing in.</p>
  </section>;
}

export function MemberContact({ person, own }: { person: Person; own: boolean }) {
  return <div className="member-contact-line"><a href={`mailto:${person.email}`}><EnvelopeIcon size={18} aria-hidden="true" />{person.email}</a>{own && <Link className="text-action" href="/account" prefetch={false}>Edit my account</Link>}</div>;
}
