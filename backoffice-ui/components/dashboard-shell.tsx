import type { PropsWithChildren } from "react";

export function DashboardShell({
  title,
  subtitle,
  hideKicker = false,
  className,
  children
}: PropsWithChildren<{ title: string; subtitle?: string; hideKicker?: boolean; className?: string }>) {
  return (
    <main className={className ? `app-shell ${className}` : "app-shell"}>
      <div className="app-shell__veil" />
      <div className="app-shell__inner">
        <header className="app-shell__header">
          {hideKicker ? null : <p className="app-shell__kicker">Catering-Betriebssystem</p>}
          <h1>{title}</h1>
          {subtitle ? <p className="app-shell__subtitle">{subtitle}</p> : null}
        </header>
        <section className="app-shell__content">{children}</section>
      </div>
    </main>
  );
}
