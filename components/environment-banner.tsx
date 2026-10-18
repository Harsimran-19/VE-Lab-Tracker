import type { AppEnvironment } from "@/lib/types";

// Marks every page of a non-production deployment so nobody mistakes it for the live tracker.
export function EnvironmentBanner({ environment }: { environment: AppEnvironment }) {
  if (environment === "production") return null;
  return <div className={`environment-banner is-${environment}`} role="note">
    <strong>{environment === "test" ? "Test version" : "Dev version"}</strong>
    <span>Try changes here before they go live.</span>
  </div>;
}
