import Link from "next/link";
export default function NotFound() {
  return (
    <main className="service-error">
      <div>
        <p className="service-brand">Venture Engineering Lab Tracker</p>
        <h1>Member not found.</h1>
        <p>This link is outdated. Open Team to find the person you need.</p>
        <Link className="button primary" href="/team">Back to Team</Link>
      </div>
    </main>
  );
}
