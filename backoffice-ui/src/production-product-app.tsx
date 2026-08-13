import type { ReactNode } from "react";
import { DashboardShell, type DashboardShellProps } from "../components/dashboard-shell.js";
import { RouteMasthead, type RouteMastheadProps } from "./route-masthead.js";
import { useProductionWorkspaceData } from "./use-production-workspace-data.js";

export type ProductionProductShellData = ReturnType<typeof useProductionWorkspaceData>;

export type ProductionProductAppProps = {
  shell: Omit<DashboardShellProps, "children">;
  masthead: RouteMastheadProps;
  activeCaseId?: string;
  activeSpecId?: string;
  children?: (data: ProductionProductShellData) => ReactNode;
};

/** The production shell owns the production workspace and its product-only health check. */
export function ProductionProductApp({ shell, masthead, activeCaseId, activeSpecId, children }: ProductionProductAppProps) {
  const product = useProductionWorkspaceData(activeCaseId, activeSpecId);
  return (
    <DashboardShell {...shell}>
      <RouteMasthead {...masthead} loading={product.loading} onRefreshDashboard={product.refresh} />
      <span className="visually-hidden">Produktionsassistent</span>
      {children ? children(product) : null}
    </DashboardShell>
  );
}
