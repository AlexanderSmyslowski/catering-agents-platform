import type { AppRoute } from "./app-shell-state.js";

export interface AppFeedbackShellProps {
  error?: string;
  notice?: string;
  loading: boolean;
  route: AppRoute;
}

function loadedContextLabel(route: AppRoute): string {
  return route === "home" ? "Bestands- und Demo-Kontext ist geladen." : "";
}

export function AppFeedbackShell({ error, notice, loading, route }: AppFeedbackShellProps) {
  return (
    <>
      {error || notice ? (
        <div className="toast-stack" aria-live="polite">
          {error ? <p className="error-banner">{error}</p> : null}
          {notice ? <p className="notice-banner">{notice}</p> : null}
        </div>
      ) : null}

      {loading || route === "home" ? (
        <footer className="footer-note">
          {loading ? "Aktuelle Plattformdaten werden geladen..." : loadedContextLabel(route)}
        </footer>
      ) : null}
    </>
  );
}
