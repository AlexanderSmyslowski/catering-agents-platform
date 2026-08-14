import type { AppRouteContentProps } from "./app-route-content.js";
import type { DashboardState, ProductRouteDashboard } from "./api.js";
import {
  toLegacyDashboardProjection,
  toLegacyRecord,
  toLegacyRecordMap,
  toLegacyRecords
} from "./app-route-legacy-adapter.js";

export type AppRouteContentStateInput = AppRouteContentProps;
export type AppRouteContentState = AppRouteContentProps;

export function buildAppRouteContentState(
  input: AppRouteContentStateInput
): AppRouteContentState {
  return {
    route: input.route,
    home: input.home,
    offerWorkbench: input.offerWorkbench,
    productionFilter: input.productionFilter,
    productionMain: input.productionMain
  };
}

/**
 * Translate the domain-typed workspace once at the view boundary. The
 * compatibility cards below this boundary remain isolated; route controllers
 * and loaders never consume these projections or perform selection from them.
 */
export function buildDashboardViewProjection(dashboard: ProductRouteDashboard): DashboardState {
  return toLegacyDashboardProjection(dashboard);
}

export function buildRecordViewProjection<T extends object>(values: T[]) {
  return toLegacyRecords(values);
}

export function buildRecordView<T extends object>(value: T) {
  return toLegacyRecord(value);
}

export function buildRecordViewMap<T extends object>(values: Map<string, T>) {
  return toLegacyRecordMap(values);
}
