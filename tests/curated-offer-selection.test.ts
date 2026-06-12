import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type AcceptedEventSpec } from "@catering/shared-core";
import { buildOfferApp } from "@catering/offer-service";
import {
  loadCuratedOfferPackages,
  selectCuratedPackage
} from "../shared-core/src/rules/curated-offer-selection.js";

function specFor(
  eventType: string,
  serviceForm: string,
  attendeeCount: number | undefined = 90
): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: `spec-${eventType}-${serviceForm}`,
    lifecycle: {
      commercialState: "quoted"
    },
    readiness: {
      status: "complete",
      reasons: []
    },
    sourceLineage: [
      {
        sourceType: "offer_service",
        reference: "test"
      }
    ],
    event: {
      type: eventType,
      serviceForm
    },
    attendees: {
      expected: attendeeCount
    },
    servicePlan: {
      eventType,
      serviceForm,
      modules: []
    },
    menuPlan: []
  };
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "curated-offer-selection-"));
}

describe("curated offer package selection", () => {
  it("loads exactly 13 fixture packages with valid price bands", () => {
    const packages = loadCuratedOfferPackages();

    expect(packages).toHaveLength(13);
    expect(packages.map((item) => item.id)).toEqual([...packages.map((item) => item.id)].sort());
    for (const packagePreset of packages) {
      const [from, to] = packagePreset.price_band_pp;
      expect(from).toBeLessThan(to);
      expect(packagePreset.food_modules?.length).toBeGreaterThan(0);
      expect(packagePreset.service_modules?.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ["lunch", "buffet", "business_lunch_basic"],
    ["meeting", "buffet", "business_lunch_basic"],
    ["conference", "buffet", "conference_day_catering"],
    ["reception", "standing_reception", "reception_fingerfood_basic"],
    ["reception", "buffet", "flying_buffet_premium"],
    ["dinner", "buffet", "private_buffet_classic"]
  ])("maps %s/%s to %s", (eventType, serviceForm, packageId) => {
    expect(selectCuratedPackage(specFor(eventType, serviceForm))?.id).toBe(packageId);
  });

  it("returns undefined for min pax misses and unknown event types", () => {
    expect(selectCuratedPackage(specFor("reception", "buffet", 39))).toBeUndefined();
    expect(selectCuratedPackage(specFor("trade_fair", "grab_and_go", 90))).toBeUndefined();
    expect(selectCuratedPackage({ ...specFor("conference", "buffet"), attendees: {} })).toBeUndefined();
  });

  it("creates a curated from-text conference draft with portfolio prices inside the package band", async () => {
    const dataRoot = createDataRoot();
    const app = buildOfferApp({ rootDir: dataRoot });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/offers/from-text",
        payload: {
          requestId: "request-curated-conference",
          text: "Konferenz, 90 Teilnehmer, Lunchbuffet"
        }
      });

      expect(response.statusCode).toBe(201);
      const draft = response.json();
      expect(draft.portfolioMapping?.packageId).toBe("conference_day_catering");
      expect(draft.portfolioMapping?.workingBandPerPerson).toMatchObject({
        from: 24,
        to: 42,
        currency: "EUR"
      });
      for (const variant of draft.variantSet) {
        const perPerson = variant.estimatedPrice.amount / 90;
        expect(perPerson).toBeGreaterThanOrEqual(24);
        expect(perPerson).toBeLessThanOrEqual(42);
      }
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("keeps meeting coffee break requests on the default offer path", async () => {
    const dataRoot = createDataRoot();
    const app = buildOfferApp({ rootDir: dataRoot });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/offers/from-text",
        payload: {
          requestId: "request-default-coffee-break",
          text: "Besprechung, 35 Teilnehmer, Kaffeepause"
        }
      });

      expect(response.statusCode).toBe(201);
      const draft = response.json();
      expect(draft.portfolioMapping).toBeUndefined();
      expect(draft.assumptions.map((entry: { code: string }) => entry.code)).not.toContain(
        "curated_app_transfer_offer_package"
      );
      expect(draft.eventSummary).toContain("Besprechung für 35 Teilnehmer als Kaffeepause");
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
