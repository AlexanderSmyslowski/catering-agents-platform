import type { ComponentProps } from "react";
import type { AppRoute } from "./app-shell-state.js";
import { HomeRoute } from "./home-route.js";
import { OfferConversationalWorkbench } from "./offer-workbench.js";
import { ProductionRouteFilterPanel } from "./production-route-filter-panel.js";
import { ProductionRouteMainLayout } from "./production-route-main-layout.js";

export type AppRouteContentProps = {
  route: AppRoute;
  home: ComponentProps<typeof HomeRoute>;
  offerWorkbench: ComponentProps<typeof OfferConversationalWorkbench>;
  productionFilter: ComponentProps<typeof ProductionRouteFilterPanel>;
  productionMain: ComponentProps<typeof ProductionRouteMainLayout>;
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
