import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emptyDashboardState, emptyServiceHealthState } from "../backoffice-ui/src/app-shell-state.js";
import { HomeRoute } from "../backoffice-ui/src/home-route.js";

function renderHomeRoute(props?: Partial<Parameters<typeof HomeRoute>[0]>): string {
  return renderToStaticMarkup(
    createElement(HomeRoute, {
      isInitialHomeLoading: false,
      dashboard: emptyDashboardState,
      serviceHealth: emptyServiceHealthState,
      offerHandoffCounts: { complete: 0, partial: 0 },
      recipeReviewCounts: { approved: 0, reviewRequired: 0 },
      latestIntakeRequestSummary: "letzte Erfassung: keine",
      filteredAuditEvents: [],
      ...props
    })
  );
}

describe("home route", () => {
  it("keeps the loading copy honest before dashboard data is evaluated", () => {
    const text = renderHomeRoute({ isInitialHomeLoading: true });

    expect(text).toContain("Plattformdaten werden geladen; noch kein Datenbestand bewertet.");
    expect(text).toContain("Übergabe wird geladen; noch keine Übergabe-Bewertung.");
    expect(text).toContain("Healthcheck läuft · Zähler werden geladen · letzte Erfassung wird geladen");
    expect(text).toContain("Änderungen werden geladen; noch kein Audit-/Handoff-Befund.");
    expect(text).not.toContain("0 operative Datensätze stehen dienstübergreifend bereit.");
  });

  it("renders existing operational counts, service health and audit anchors", () => {
    const text = renderHomeRoute({
      dashboard: {
        ...emptyDashboardState,
        acceptedSpecs: [{ specId: "spec-1" }, { specId: "spec-2" }],
        offerDrafts: [{ draftId: "draft-1" }],
        productionPlans: [{ planId: "plan-1" }],
        purchaseLists: [{ purchaseListId: "purchase-1" }],
        recipes: [{ recipeId: "recipe-1" }, { recipeId: "recipe-2" }]
      },
      serviceHealth: {
        ...emptyServiceHealthState,
        intake: { service: "intake-service", status: "ok", timestamp: "", counts: { requests: 2 } },
        offers: { service: "offer-service", status: "ok", timestamp: "", counts: { offerDrafts: 1 } },
        production: {
          service: "production-service",
          status: "ok",
          timestamp: "",
          counts: { productionPlans: 1, purchaseLists: 1 }
        },
        exports: { service: "print-export", status: "ok", timestamp: "", counts: {} }
      },
      offerHandoffCounts: { complete: 1, partial: 1 },
      recipeReviewCounts: { approved: 1, reviewRequired: 1 },
      latestIntakeRequestSummary: "letzte Erfassung: manuelle Eingabe",
      filteredAuditEvents: [
        {
          auditId: "audit-1",
          at: "2026-05-26T08:00:00.000Z",
          action: "production.plan.created",
          summary: "Produktionsplan erstellt",
          actor: { name: "Küche" }
        }
      ]
    });

    expect(text).toContain("2 operative Datensätze stehen dienstübergreifend bereit.");
    expect(text).toContain("1 vollständig · 1 teilweise vollständig");
    expect(text).toContain("1 kaufmännische Entwürfe können direkt übernommen werden.");
    expect(text).toContain("1 Küchenpläne · 1 Einkaufslisten mit Rezept- und Einkaufsbezug sind verfügbar.");
    expect(text).toContain("2 Rezepte · 1 intern freigegeben · 1 Prüfung nötig");
    expect(text).toContain("bereit · Anfragen: 2 · letzte Erfassung: manuelle Eingabe");
    expect(text).toContain("1 Änderungen geladen · neueste: Produktionsplan erstellt");
    expect(text).toContain("Audit-/Handoff-Hinweis: interne Arbeitsbelege");
  });
});
