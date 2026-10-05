import { Login } from "./login";
import { LabApp } from "./lab-app";
import { authorizedContext, loginIdentity } from "@/lib/auth";
import { adminEmails, isDemo, missingConfig } from "@/lib/config";
import { workspaceFor, memberPreview, AppError } from "@/lib/access";
import { notFound } from "next/navigation";
export type Screen =
  | "dashboard"
  | "projects"
  | "project"
  | "people"
  | "profile";
function ConnectionError({ error }: { error: unknown }) {
  return (
    <main className="service-error">
      <div>
        <p className="eyebrow">VE LAB</p>
        <h1>Let’s reconnect your workspace.</h1>
        <p>
          {error instanceof AppError
            ? error.message
            : "The Google connection could not be completed. Check the service-account credentials and spreadsheet sharing settings."}
        </p>
        <a className="button primary" href="/">
          Try again
        </a>
        <p className="muted">
          Your existing research records remain in Google Sheets.
        </p>
      </div>
    </main>
  );
}
export async function WorkspacePage({
  screen,
  projectId,
  error,
  preview,
}: {
  screen: Screen;
  projectId?: string;
  error?: string;
  preview?: string;
}) {
  const missing = isDemo() ? [] : missingConfig();
  const callbackUrl =
    screen === "dashboard"
      ? "/"
      : projectId
        ? `/projects/${encodeURIComponent(projectId)}`
        : `/${screen}`;
  if (missing.length || !(await loginIdentity()))
    return <Login missing={missing} error={error} callbackUrl={callbackUrl} />;
  let context: Awaited<ReturnType<typeof authorizedContext>>;
  try {
    context = await authorizedContext();
  } catch (error) {
    return <ConnectionError error={error} />;
  }
  if (projectId && !context.store.projects.some((p) => p.id === projectId))
    notFound();
  try {
    const { identity, store } = context;
    const initial = preview
      ? memberPreview(store, identity, preview, isDemo(), adminEmails())
      : workspaceFor(store, identity, isDemo(), adminEmails());
    return (
      <LabApp
        key={`${screen}-${projectId ?? ""}-${initial.identity.personId}`}
        initial={initial}
        screen={screen}
        projectId={projectId}
      />
    );
  } catch (error) {
    return <ConnectionError error={error} />;
  }
}
