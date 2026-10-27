import type { ReactNode } from "react";
import { DashboardShell, type DashboardShellProps } from "../components/dashboard-shell.js";
import { RouteMasthead, type RouteMastheadProps } from "./route-masthead.js";
import { useOfferWorkspaceData } from "./use-offer-workspace-data.js";
import { useCateringSession } from "./session-boundary.js";

export type OfferProductShellData = ReturnType<typeof useOfferWorkspaceData>;

export type OfferProductAppProps = {
  shell: Omit<DashboardShellProps, "children">;
  masthead: RouteMastheadProps;
  activeCaseId?: string;
  children?: (data: OfferProductShellData) => ReactNode;
};

/** The offer shell owns the offer workspace and never delegates loading to a global dashboard. */
export function OfferProductApp({ shell, masthead, activeCaseId, children }: OfferProductAppProps) {
  const userId = useCateringSession()?.session.user.userId;
  const product = useOfferWorkspaceData(activeCaseId, userId);
  return (
    <DashboardShell {...shell}>
      <RouteMasthead {...masthead} loading={product.loading} onRefreshDashboard={product.refresh} />
      <span className="visually-hidden">Angebotsassistent</span>
      {children ? children(product) : null}
    </DashboardShell>
  );
}
