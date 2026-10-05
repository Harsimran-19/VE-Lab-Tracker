import Link from "next/link";
export default function NotFound() {
  return (
    <main className="service-error">
      <div>
        <p className="eyebrow">VE LAB</p>
        <h1>Project not found.</h1>
        <p>
          The link may be outdated. Browse the lab’s projects to find your
          workspace.
        </p>
        <Link className="button primary" href="/projects">
          Browse projects
        </Link>
      </div>
    </main>
  );
}
