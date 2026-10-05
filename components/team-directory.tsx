import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import type { Person, Workspace } from "@/lib/types";
import { initials } from "@/lib/format";

export function memberProjects(data: Workspace, personId: string) {
  const joined = new Set(
    data.memberships
      .filter((m) => m.personId === personId)
      .map((m) => m.projectId),
  );
  return data.projects
    .filter((p) => joined.has(p.id))
    .sort(
      (a, b) =>
        Number(a.state === "completed") - Number(b.state === "completed") ||
        a.name.localeCompare(b.name),
    );
}

export function TeamDirectory({ data }: { data: Workspace }) {
  const people = [...data.people].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section aria-label="Team members">
      <p className="team-count">
        {people.length} {people.length === 1 ? "person" : "people"} in the lab
      </p>
      <ul className="team-list">
        {people.map((person) => {
          const projects = memberProjects(data, person.id);
          return (
            <li key={person.id}>
              <Link
                className="team-card"
                href={`/team/${encodeURIComponent(person.id)}`}
                prefetch={false}
              >
                <span className="avatar" aria-hidden="true">
                  {initials(person.name)}
                </span>
                <div className="team-card-copy">
                  <h2>
                    {person.name}
                    {person.id === data.identity.personId && (
                      <span className="joined-label">You</span>
                    )}
                  </h2>
                  <p className="team-email">{person.email}</p>
                  {(person.academicRole || person.affiliation) && (
                    <p className="team-role">
                      {[person.academicRole, person.affiliation]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="team-projects">
                    {projects.length
                      ? projects
                          .map(
                            (p) =>
                              `${p.name}${p.state === "completed" ? " (completed)" : ""}`,
                          )
                          .join(" · ")
                      : "No projects joined"}
                  </p>
                </div>
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      {people.length === 1 && (
        <p className="team-guidance">
          Other members appear here when they sign in with Google. Share the
          website to invite them.
        </p>
      )}
    </section>
  );
}

export function MemberContact({
  person,
  own,
}: {
  person: Person;
  own: boolean;
}) {
  return (
    <section className="panel dashboard-panel member-contact">
      <h2>Contact</h2>
      {(person.academicRole || person.affiliation) && (
        <p className="member-affiliation">
          {[person.academicRole, person.affiliation]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <a className="member-email" href={`mailto:${person.email}`}>
        <Mail size={18} aria-hidden="true" />
        {person.email}
      </a>
      {own && (
        <Link className="button secondary" href="/account">
          Edit my account
        </Link>
      )}
    </section>
  );
}
