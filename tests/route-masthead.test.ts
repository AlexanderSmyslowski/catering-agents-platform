import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppRoute } from "../backoffice-ui/src/app-shell-state.js";
import { RouteMasthead } from "../backoffice-ui/src/route-masthead.js";

const noop = () => undefined;
const noopAsync = async () => undefined;

function renderMasthead(route: AppRoute): string {
  return renderToStaticMarkup(
    createElement(RouteMasthead, {
      route,
      baseUrl: "https://catering.local",
      operatorName: "Kueche",
      loading: false,
      submitting: false,
      onOperatorNameChange: noop,
      onSeedDemoData: noopAsync,
      onRefreshDashboard: noopAsync
    })
  );
}

describe("route masthead", () => {
  it("keeps the home entry points and beta boundaries visible", () => {
    const markup = renderMasthead("home");

    expect(markup).toContain("Start");
    expect(markup).toContain("Angebotsagent öffnen");
    expect(markup).toContain("Produktionsagent öffnen");
    expect(markup).toContain("Internes Beta-Kontrollzentrum");
    expect(markup).toContain("Beta-Weg:");
    expect(markup).toContain("Start → Angebot → Produktion → Rückfragen → Exporte/Audit.");
    expect(markup).toContain("https://catering.local/angebot");
    expect(markup).toContain("https://catering.local/produktion");
    expect(markup).toContain("Demo-Daten laden");
    expect(markup).toContain("Aktualisieren");
  });

  it("keeps production route chrome focused on the production hero", () => {
    const markup = renderMasthead("production");

    expect(markup).toContain("Produktionsvorbereitung: Rezepte, Küchenplanung und Einkauf.");
    expect(markup).toContain("https://catering.local/produktion");
    expect(markup).toContain("Gemeinsamer Regelkern");
    expect(markup).not.toContain("Demo-Daten laden");
    expect(markup).not.toContain("Internes Beta-Kontrollzentrum");
  });
});
