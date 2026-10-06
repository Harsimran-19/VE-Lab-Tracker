import { CircleNotchIcon } from "@phosphor-icons/react/ssr";
import { workspaceFontClasses } from "./workspace-fonts";

export function WorkspaceLoading() {
  return (
    <main className={`workspace-loading ${workspaceFontClasses}`} aria-busy="true">
      <header className="workspace-loading-header">Venture Engineering Lab Tracker</header>
      <div className="workspace-loading-content" role="status" aria-live="polite">
        <CircleNotchIcon className="workspace-loading-spinner" size={44} weight="regular" aria-hidden="true" />
        <h1>Opening your workspace</h1>
        <p>Loading your projects and updates…</p>
      </div>
    </main>
  );
}
