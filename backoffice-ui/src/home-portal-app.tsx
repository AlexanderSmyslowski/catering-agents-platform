import type { ReactNode } from "react";
import { DashboardShell, type DashboardShellProps } from "../components/dashboard-shell.js";

export type HomePortalAppProps = {
  shell: Omit<DashboardShellProps, "children">;
  children?: ReactNode;
};

/** The portal owns navigation only; operational records are loaded by a product route. */
export function HomePortalApp({ shell, children }: HomePortalAppProps) {
  return (
    <DashboardShell {...shell}>
      <nav className="portal-actions" aria-label="Startauswahl">
        <a className="button-link" href="/angebot">Neuen Auftrag beginnen</a>
        <a className="ghost-link" href="/angebot#history">Frühere Aufträge</a>
      </nav>
      {children}
    </DashboardShell>
  );
}
