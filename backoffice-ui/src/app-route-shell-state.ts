import type { DashboardShellProps } from "../components/dashboard-shell.js";
import type { AppRoute } from "./app-shell-state.js";
import { getRouteSubtitle, getRouteTitle } from "./app-shell-state.js";
import type { RouteMastheadProps } from "./route-masthead.js";

export type AppRouteShellStateInput = RouteMastheadProps;

export type AppRouteShellState = {
  shell: DashboardShellProps;
  masthead: RouteMastheadProps;
};

export function buildAppRouteShellState({
  route,
  baseUrl,
  operatorName,
  loading,
  submitting,
  onOperatorNameChange,
  onSeedDemoData,
  onRefreshDashboard
}: AppRouteShellStateInput): AppRouteShellState {
  return {
    shell: {
      title: getRouteTitle(route),
      subtitle: getRouteSubtitle(route),
      hideKicker: route !== "home",
      className: getRouteShellClassName(route)
    },
    masthead: {
      route,
      baseUrl,
      operatorName,
      loading,
      submitting,
      onOperatorNameChange,
      onSeedDemoData,
      onRefreshDashboard
    }
  };
}

function getRouteShellClassName(route: AppRoute): string | undefined {
  if (route === "production") {
    return "app-shell--production-route";
  }
  if (route === "offer") {
    return "app-shell--offer-route";
  }
  return undefined;
}
