import { describe, expect, it } from "vitest";
import { buildAppRouteContentState } from "../backoffice-ui/src/app-route-content-state.js";
import type { AppRouteContentProps } from "../backoffice-ui/src/app-route-content.js";

describe("app route content state", () => {
  it("keeps route content props grouped without cloning route payloads", () => {
    const home = { dashboard: "home" } as unknown as AppRouteContentProps["home"];
    const offerWorkbench = { draft: "offer" } as unknown as AppRouteContentProps["offerWorkbench"];
    const productionFilter = { search: "production" } as unknown as AppRouteContentProps["productionFilter"];
    const productionMain = { plan: "production" } as unknown as AppRouteContentProps["productionMain"];

    const state = buildAppRouteContentState({
      route: "production",
      home,
      offerWorkbench,
      productionFilter,
      productionMain
    });

    expect(state.route).toBe("production");
    expect(state.home).toBe(home);
    expect(state.offerWorkbench).toBe(offerWorkbench);
    expect(state.productionFilter).toBe(productionFilter);
    expect(state.productionMain).toBe(productionMain);
  });
});
