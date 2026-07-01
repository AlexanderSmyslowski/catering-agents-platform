import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AppRoute } from "../backoffice-ui/src/app-shell-state.js";
import { AppRouteContent } from "../backoffice-ui/src/app-route-content.js";

vi.mock("../backoffice-ui/src/home-route.js", () => ({
  HomeRoute: () => createElement("section", { "data-route-content": "home" }, "home-route")
}));

vi.mock("../backoffice-ui/src/offer-workbench.js", () => ({
  OfferConversationalWorkbench: () =>
    createElement("section", { "data-route-content": "offer" }, "offer-route")
}));

vi.mock("../backoffice-ui/src/production-route-filter-panel.js", () => ({
  ProductionRouteFilterPanel: () =>
    createElement("section", { "data-route-content": "production-filter" }, "production-filter")
}));

vi.mock("../backoffice-ui/src/production-route-main-layout.js", () => ({
  ProductionRouteMainLayout: () =>
    createElement("section", { "data-route-content": "production-main" }, "production-main")
}));

function renderRoute(route: AppRoute): string {
  return renderToStaticMarkup(
    createElement(AppRouteContent, {
      route,
      home: {} as never,
      offerWorkbench: {} as never,
      productionFilter: {} as never,
      productionMain: {} as never
    })
  );
}

describe("app route content", () => {
  it("renders only the home route content for the home route", () => {
    const markup = renderRoute("home");

    expect(markup).toContain('data-route-content="home"');
    expect(markup).not.toContain("offer-route");
    expect(markup).not.toContain("production-filter");
    expect(markup).not.toContain("production-main");
  });

  it("renders only the offer workbench for the offer route", () => {
    const markup = renderRoute("offer");

    expect(markup).toContain('data-route-content="offer"');
    expect(markup).not.toContain("home-route");
    expect(markup).not.toContain("production-filter");
    expect(markup).not.toContain("production-main");
  });

  it("renders the active production main layout before inventory search", () => {
    const markup = renderRoute("production");

    expect(markup).toContain('data-route-content="production-filter"');
    expect(markup).toContain('data-route-content="production-main"');
    expect(markup.indexOf("production-main")).toBeLessThan(markup.indexOf("production-filter"));
    expect(markup).not.toContain("home-route");
    expect(markup).not.toContain("offer-route");
  });
});
