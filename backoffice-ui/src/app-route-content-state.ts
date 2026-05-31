import type { AppRouteContentProps } from "./app-route-content.js";

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
