import type { AppRoute } from "./app-shell-state.js";

export interface AppFeedbackShellProps {
  error?: string;
  notice?: string;
  loading: boolean;
  route: AppRoute;
}

function loadedContextLabel(route: AppRoute): string {
  if (route === "offer") {
    return "Bestands- und Demo-Kontext ist geladen. Eine neue Anfrage startest du im Eingabefeld.";
  }
  if (route === "production") {
    return "Bestands- und Demo-Kontext ist geladen. Einen neuen Produktionsauftrag startest du im Eingabebereich.";
  }
  return "Bestands- und Demo-Kontext ist geladen.";
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

      <footer className="footer-note">
        {loading ? "Aktuelle Plattformdaten werden geladen..." : loadedContextLabel(route)}
      </footer>
    </>
  );
}
