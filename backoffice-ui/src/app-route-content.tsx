import type { AppRoute } from "./app-shell-state.js";
import { HomeRoute, type HomeRouteProps } from "./home-route.js";
import { OfferConversationalWorkbench, type OfferWorkbenchProps } from "./offer-workbench.js";
import { ProductionRouteFilterPanel, type ProductionRouteFilterPanelProps } from "./production-route-filter-panel.js";
import { ProductionRouteMainLayout, type ProductionRouteMainLayoutProps } from "./production-route-main-layout.js";

export type AppRouteContentProps = {
  route: AppRoute;
  home: HomeRouteProps;
  offerWorkbench: OfferWorkbenchProps;
  productionFilter: ProductionRouteFilterPanelProps;
  productionMain: ProductionRouteMainLayoutProps;
};

export function AppRouteContent({
  route,
  home,
  offerWorkbench,
  productionFilter,
  productionMain
}: AppRouteContentProps) {
  return (
    <>
      {route === "home" ? <HomeRoute {...home} /> : null}

      {route === "offer" ? <OfferConversationalWorkbench {...offerWorkbench} /> : null}
      {route === "production" ? <ProductionRouteMainLayout {...productionMain} /> : null}
      {route === "production" ? <ProductionRouteFilterPanel {...productionFilter} /> : null}
    </>
  );
}
