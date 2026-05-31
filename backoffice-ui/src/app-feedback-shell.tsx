export interface AppFeedbackShellProps {
  error?: string;
  notice?: string;
  loading: boolean;
}

export function AppFeedbackShell({ error, notice, loading }: AppFeedbackShellProps) {
  return (
    <>
      {error || notice ? (
        <div className="toast-stack" aria-live="polite">
          {error ? <p className="error-banner">{error}</p> : null}
          {notice ? <p className="notice-banner">{notice}</p> : null}
        </div>
      ) : null}

      <footer className="footer-note">
        {loading
          ? "Aktuelle Plattformdaten werden geladen..."
          : "Aktuelle Daten aus Erfassung, Angebot und Produktion wurden geladen."}
      </footer>
    </>
  );
}
