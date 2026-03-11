import type { PropsWithChildren } from "react";

export function DashboardShell({
  title,
  subtitle,
  children
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <main className="app-shell">
      <div className="app-shell__veil" />
      <div className="app-shell__inner">
        <header className="app-shell__header">
          <p className="app-shell__kicker">Catering-Betriebssystem</p>
          <h1>{title}</h1>
          {subtitle ? <p className="app-shell__subtitle">{subtitle}</p> : null}
        </header>
        <section className="app-shell__content">{children}</section>
      </div>
    </main>
  );
}
