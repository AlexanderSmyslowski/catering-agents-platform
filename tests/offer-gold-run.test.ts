import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCuratedOfferDraft,
  createEventRequestFromManualForm,
  validateOfferDraft,
  type CuratedOfferPackagePreset
} from "@catering/shared-core";

const appTransferDir =
  "/Users/alexandersmyslowski/Documents/Alexander-Wiki/catering/app-transfer/angebote_portfolio_2026-06-01";

const curatedBusinessLunchFallback: CuratedOfferPackagePreset = {
  id: "business_lunch_basic",
  name: "Business Lunch Basic",
  price_band_pp: [16, 24],
  min_pax: 15,
  food_modules: [
    "Lunch-Buffet kompakt",
    "Salate",
    "vegetarische/vegane Komponente",
    "Brot/Baguette",
    "kleines Dessert optional"
  ],
  service_modules: [
    "Lieferung",
    "Aufbau Buffet",
    "Abbau/Abholung",
    "Table Top optional",
    "Getraenke optional"
  ],
  source_evidence: {
    records_cluster_total: 482,
    records_cluster_2025_2026: 268
  }
};

function loadCuratedBusinessLunchPackage(): CuratedOfferPackagePreset {
  const catalogPath = path.join(appTransferDir, "angebotskatalog_1_0_app_transfer.json");
  if (!existsSync(catalogPath)) {
    return curatedBusinessLunchFallback;
  }

  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
    portfolio_items?: CuratedOfferPackagePreset[];
  };
  const businessLunch = catalog.portfolio_items?.find((item) => item.id === "business_lunch_basic");

  if (!businessLunch) {
    throw new Error(`business_lunch_basic fehlt im kuratierten App-Transfer-Katalog: ${catalogPath}`);
  }

  return businessLunch;
}

describe("offer gold run", () => {
  it("maps a curated business lunch request into review-gated customer offer and production handoff", () => {
    const packagePreset = loadCuratedBusinessLunchPackage();
    const request = createEventRequestFromManualForm({
      requestId: "goldrun-offer-business-lunch-1",
      customerName: "CommCats GmbH",
      eventType: "Business Lunch",
      eventDate: "2026-09-18",
      attendeeCount: 35,
      serviceForm: "Buffet",
      menuItems: ["Lunch-Buffet kompakt", "Salate", "vegetarische Komponente", "Brot/Baguette"],
      notes: "Lieferung und Aufbau gewuenscht; Preis bitte als Angebotsentwurf."
    });

    const draft = validateOfferDraft(createCuratedOfferDraft(request, packagePreset));

    expect(draft.portfolioMapping).toMatchObject({
      packageId: "business_lunch_basic",
      packageName: "Business Lunch Basic",
      source: "curated_app_transfer",
      minPax: 15,
      workingBandPerPerson: {
        from: 16,
        to: 24,
        currency: "EUR"
      }
    });
    expect(draft.portfolioMapping?.evidenceSummary).toContain("kuratierte Cluster-Datensaetze");
    expect(draft.pricingSummary).toMatchObject({
      subtotal: {
        amount: 700,
        currency: "EUR"
      },
      perPerson: {
        amount: 20,
        currency: "EUR"
      }
    });
    expect(draft.pricingSummary.notes?.join(" ")).toContain("prüfpflichtig");

    expect(draft.reviewStatus).toEqual({
      priceReviewStatus: "review_required",
      taxReviewStatus: "review_required",
      allergenReviewStatus: "review_required",
      hygieneTemperatureReviewStatus: "review_required",
      sourceSecured: true,
      publishApproved: false
    });

    expect(draft.serviceModules.map((module) => module.label)).toEqual(
      expect.arrayContaining(["Lunch-Buffet kompakt", "Lieferung", "Aufbau Buffet"])
    );
    expect(draft.proposedEventSpec.menuPlan.map((component) => component.label)).toEqual(
      expect.arrayContaining(["Lunch-Buffet kompakt", "Salate", "vegetarische/vegane Komponente"])
    );
    expect(draft.proposedEventSpec.productionConstraints?.join(" ")).toContain(
      "vor Produktion prüfen"
    );

    expect(draft.customerFacingText).toContain("Business Lunch Basic");
    expect(draft.customerFacingText).toContain("Arbeitsband: 16.00-24.00 EUR p.P.");
    expect(draft.customerFacingText).not.toContain("Portfolio-Paket");
    expect(draft.customerFacingText).not.toContain("Prüfstatus");
    expect(draft.customerFacingText).not.toContain("Publish-Freigabe");
    expect(draft.internalWorkingText).toContain("Portfolio-Paket: business_lunch_basic");
    expect(draft.internalWorkingText).toContain("Prüfstatus Preis: review_required");
    expect(draft.internalWorkingText).toContain("Publish-Freigabe: false");

    expect(draft.productionHandoff).toMatchObject({
      handoffId: "handoff-draft-goldrun-offer-business-lunch-1",
      draftId: "draft-goldrun-offer-business-lunch-1",
      specId: draft.proposedEventSpec.specId,
      status: "review_required",
      sourcePackageId: "business_lunch_basic",
      customerOfferVisible: true,
      internalCalculationVisible: false
    });
    expect(draft.productionHandoff?.reviewStatus.publishApproved).toBe(false);
    expect(draft.assumptions.map((assumption) => assumption.code)).toContain(
      "curated_app_transfer_offer_package"
    );
    expect(draft.openQuestions.join(" ")).toContain("Allergene");
  });
});
