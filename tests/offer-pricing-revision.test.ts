import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { calculateOfferPricing } from "../shared-core/src/offer-calculation.js";
import { renderOfferHtml } from "../print-export/src/index.js";

const secret = "synthetic-pricing-test-secret";
const headers = { "x-catering-trusted-secret": secret, "x-catering-actor-name": "Angebots-Mitarbeiter", "x-catering-business-id": "alpha" };
const lines = (taxRateBps: number | undefined = 1900) => [
  { id: "food", label: "Speisenpaket für das vollständige Menü", category: "food", quantity: "100", unit: "guest", unitNetCents: 5800, taxRateBps, sourceKind: "app_transfer", sourceReference: "Angebotsrechner 0.6 – Arbeitswert" },
  { id: "staff", label: "Servicepersonal – Personenstunden gesamt", category: "staff", quantity: "24", unit: "hour", unitNetCents: 4555, taxRateBps, sourceKind: "app_transfer", sourceReference: "Angebotsbaukasten 0.6 – prüfpflichtig" }
];
async function harness() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-pricing-revision-"));
  const store = new OfferStore({ rootDir });
  const app = buildOfferApp({ rootDir, store, trustedActorSecret: secret,
    env: { CATERING_DEV_AUTH: "1", CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret } });
  const c = await app.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
  expect(c.statusCode, c.body).toBe(201);
  const caseId = c.json().case.caseId;
  const d = await app.inject({ method: "POST", url: "/v1/offers/from-text", headers,
    payload: { caseId, text: "SYNTHETISCH: Abendbuffet für 100 Gäste: 55 Portionen Hähnchenragout, 25 Portionen Gemüsebratlinge, 20 Portionen veganes Linsenragout." } });
  expect(d.statusCode, d.body).toBe(201);
  return { app, store, rootDir, caseId, draft: d.json() };
}
describe("persisted offer price calculation", () => {
  it("creates an immutable replayable case continuation and preserves prices through approval and handoff", async () => {
    const { app, store, rootDir, draft, caseId } = await harness();
    try {
      const url = "/v1/offers/drafts/" + draft.draftId + "/pricing";
      const payload = { revision: draft.revision, variantId: draft.variantSet[1].variantId, calculation: { lines: lines() } };
      const r = await app.inject({ method: "POST", url, headers, payload });
      expect(r.statusCode, r.body).toBe(201);
      const revised = r.json();
      expect(revised.draftId).not.toBe(draft.draftId);
      expect(revised.proposedEventSpec.menuPlan.map((x: any) => x.servings)).toEqual([55, 25, 20]);
      expect(revised.variantSet).toHaveLength(1);
      expect(revised.pricingSummary.calculation).toMatchObject({ netCents: 689320, taxCents: 130971, grossCents: 820291 });
      expect(revised.variantSet[0].proposedEventSpec.budgetContext.pricingSummary).toEqual(revised.pricingSummary);
      const html = renderOfferHtml(revised);
      expect(html).toContain("Weitere Leistungsplanung · Umfang prüfen");
      expect(html).toContain("Diese Planung ist kein Nachweis enthaltener Leistungen");
      expect(html).toContain("Netto gesamt:");
      expect(html).not.toContain("<p>Gesamt:");
      expect(revised.reviewStatus.publishApproved).toBe(false);
      expect(revised.reviewStatus.priceReviewStatus).toBe("review_required");
      expect(await store.getDraft({ businessId: "alpha" }, draft.draftId)).toEqual(draft);
      const retry = await app.inject({ method: "POST", url, headers, payload });
      expect(retry.statusCode, retry.body).toBe(201);
      expect(retry.json()).toEqual(revised);
      expect(await new OfferStore({ rootDir }).getDraft({ businessId: "alpha" }, revised.draftId)).toEqual(revised);
      expect(await store.findCaseIdForDraft({ businessId: "alpha" }, revised.draftId, 1)).toBe(caseId);
      const stale = await app.inject({ method: "POST", url, headers, payload: {
        ...payload, calculation: { lines: lines().map(x => ({ ...x, unitNetCents: x.unitNetCents + 1 })) }
      } });
      expect(stale.statusCode).toBe(409);
      const decision = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + revised.draftId + "/decision", headers,
        payload: { revision: 1, decision: "approved", variantId: revised.variantSet[0].variantId } });
      expect(decision.statusCode, decision.body).toBe(201);
      const offer = decision.json().approvedOffer;
      expect(offer.pricingSummary).toEqual(revised.pricingSummary);
      const handoff = await app.inject({ method: "POST", url: "/v1/offers/approved/" + offer.approvedOfferId + "/handoffs", headers, payload: {} });
      expect(handoff.statusCode, handoff.body).toBe(201);
      expect(handoff.json().handoff.pricingSnapshot).toEqual(revised.pricingSummary);
    } finally { await app.close(); }
  });
  it("persists partial estimated costs through approval and handoff without overwriting the source", async () => {
    const { app, store, rootDir, draft } = await harness();
    try {
      const cost = { totalNetCents: 185000, basis: "estimated", estimateDate: "2026-10-25", sourceReference: "SYNTHETISCH: ältere Einkaufspreise", priceDate: "2026-09-12" };
      const input = lines().map((line, at) => at === 0 ? { ...line, directCost: cost } : line);
      const r = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + draft.draftId + "/pricing", headers,
        payload: { revision: 1, variantId: draft.variantSet[0].variantId, calculation: { lines: input } } });
      expect(r.statusCode, r.body).toBe(201);
      const revised = r.json();
      expect(revised.pricingSummary.calculation.lines[0].directCost).toEqual(cost);
      expect(revised.pricingSummary.calculation.lines[1]).not.toHaveProperty("directCost");
      expect((await new OfferStore({ rootDir }).getDraft({ businessId: "alpha" }, revised.draftId))?.pricingSummary).toEqual(revised.pricingSummary);
      expect(await store.getDraft({ businessId: "alpha" }, draft.draftId)).toEqual(draft);
      const decision = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + revised.draftId + "/decision", headers,
        payload: { revision: 1, decision: "approved", variantId: revised.variantSet[0].variantId } });
      expect(decision.statusCode, decision.body).toBe(201);
      const offer = decision.json().approvedOffer;
      const handoff = await app.inject({ method: "POST", url: "/v1/offers/approved/" + offer.approvedOfferId + "/handoffs", headers, payload: {} });
      expect(handoff.statusCode, handoff.body).toBe(201);
      expect(handoff.json().handoff.pricingSnapshot.calculation.lines[0].directCost).toEqual(cost);
      const customerHtml = renderOfferHtml({ ...revised, reviewStatus: { ...revised.reviewStatus, publishApproved: true } });
      expect(customerHtml).not.toContain("ältere Einkaufspreise");
      expect(customerHtml).not.toContain("Deckungsbeitrag");
    } finally { await app.close(); }
  });
  it("retains the cost-bearing source when an unchanged menu deliberately creates an unpriced successor", async () => {
    const { app, store, rootDir, draft } = await harness();
    try {
      const base = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + draft.draftId + "/pricing", headers,
        payload: { revision: 1, variantId: draft.variantSet[0].variantId, calculation: { lines: lines() } } });
      expect(base.statusCode, base.body).toBe(201);
      const future = base.json();
      const costs = calculateOfferPricing({ lines: lines().map((line, at) => at ? line : { ...line,
        directCost: { totalNetCents: 185000, basis: "estimated", estimateDate: "2026-10-25", sourceReference: "SYNTHETISCHER ZUKUNFTSDATENSATZ" } }) }, 100);
      future.pricingSummary = costs;
      future.proposedEventSpec.budgetContext.pricingSummary = structuredClone(costs);
      future.variantSet[0].proposedEventSpec.budgetContext.pricingSummary = structuredClone(costs);
      // Simulate a record retained from the later cost-enabled binary.
      const file = path.join(rootDir, "businesses/alpha/offers/drafts", future.draftId + ".json");
      writeFileSync(file, JSON.stringify(future), { mode: 0o600 });
      const before = readFileSync(file);
      const menu = future.proposedEventSpec.menuPlan.map(({ componentId, label, servings, menuCategory, dietaryTags }: any) => ({ componentId, label, servings, menuCategory, dietaryTags }));
      const changed = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + future.draftId + "/menu", headers,
        payload: { revision: 1, menuPlan: menu } });
      expect(changed.statusCode, changed.body).toBe(201);
      const successor = changed.json();
      expect(successor.draftId).not.toBe(future.draftId);
      expect(successor.pricingSummary.calculation).toBeUndefined();
      expect(successor.pricingSummary.calculationRequired).toBe(true);
      expect(successor.reviewStatus.publishApproved).toBe(false);
      const premature = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + successor.draftId + "/decision", headers,
        payload: { revision: 1, decision: "approved", variantId: successor.variantSet[0].variantId } });
      expect(premature.statusCode, premature.body).toBe(422);
      expect(readFileSync(file)).toEqual(before);
      expect(await store.getDraft({ businessId: "alpha" }, future.draftId)).toEqual(future);
    } finally { await app.close(); }
  });
  it("invalidates a saved price calculation on a later menu revision and rejects forged stored totals", async () => {
    const { app, store, caseId, draft } = await harness();
    try {
      const r = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + draft.draftId + "/pricing", headers,
        payload: { revision: 1, variantId: draft.variantSet[0].variantId, calculation: { lines: lines() } } });
      expect(r.statusCode, r.body).toBe(201);
      const revised = r.json();
      const bad = structuredClone(revised);
      bad.pricingSummary.calculation.grossCents++;
      await expect(store.saveDraftForCase({ businessId: "alpha" }, caseId, bad)).rejects.toThrow();
      const changed = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + revised.draftId + "/menu", headers,
        payload: { revision: 1, menuPlan: [{ label: "Geändertes Gericht", servings: 100 }] } });
      expect(changed.statusCode, changed.body).toBe(201);
      expect(changed.json().pricingSummary.calculation).toBeUndefined();
      expect(changed.json().pricingSummary.calculationRequired).toBe(true);
      const afterMenu = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + changed.json().draftId + "/decision", headers,
        payload: { revision: 1, decision: "approved", variantId: changed.json().variantSet[0].variantId } });
      expect(afterMenu.statusCode, afterMenu.body).toBe(422);
      expect(changed.json().variantSet[0].proposedEventSpec.budgetContext.pricingSummary.calculation).toBeUndefined();
      expect((await store.getDraft({ businessId: "alpha" }, revised.draftId))?.pricingSummary.calculation).toEqual(revised.pricingSummary.calculation);
      const repriced = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + changed.json().draftId + "/pricing", headers,
        payload: { revision: 1, variantId: changed.json().variantSet[0].variantId, calculation: { lines: lines() } } });
      expect(repriced.statusCode, repriced.body).toBe(201);
      expect(repriced.json().pricingSummary.calculationRequired).toBeUndefined();
      const recovered = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + repriced.json().draftId + "/decision", headers,
        payload: { revision: 1, decision: "approved", variantId: repriced.json().variantSet[0].variantId } });
      expect(recovered.statusCode, recovered.body).toBe(201);

    } finally { await app.close(); }
  });
  it("saves missing tax explicitly but refuses internal approval until it is completed", async () => {
    const { app, draft } = await harness();
    try {
      const r = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + draft.draftId + "/pricing", headers,
        payload: { revision: 1, variantId: draft.variantSet[0].variantId, calculation: { lines: lines().map(({ taxRateBps, ...line }) => line) } } });
      expect(r.statusCode, r.body).toBe(201);
      const revised = r.json();
      expect(revised.pricingSummary.calculation.grossCents).toBeUndefined();
      const a = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + revised.draftId + "/decision", headers,
        payload: { revision: 1, decision: "approved", variantId: revised.variantSet[0].variantId } });
      expect(a.statusCode, a.body).toBe(422);
      const menu = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + revised.draftId + "/menu", headers,
        payload: { revision: 1, menuPlan: [{ label: "Menüänderung ohne Steuer", servings: 100 }] } });
      expect(menu.statusCode, menu.body).toBe(201);
      const bypass = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + menu.json().draftId + "/decision", headers,
        payload: { revision: 1, decision: "approved", variantId: menu.json().variantSet[0].variantId } });
      expect(bypass.statusCode, bypass.body).toBe(422);
    } finally { await app.close(); }
  });
  it("rejects unknown fields, wrong guests, unauthorized and foreign requests without overwriting the source", async () => {
    const { app, store, draft } = await harness();
    try {
      const url = "/v1/offers/drafts/" + draft.draftId + "/pricing";
      const payload = { revision: 1, variantId: draft.variantSet[0].variantId, calculation: { lines: lines() } };
      for (const changed of [
        { ...payload, revision: 2 },
        { ...payload, calculation: { lines: [{ ...lines()[0], sourceKind: ["synthetic"] }] } },
        { ...payload, calculation: { lines: [{ ...lines()[0], quantity: "99" }] } },
        { ...payload, calculation: { lines: lines(), grossCents: 1 } }
      ]) {
        const r = await app.inject({ method: "POST", url, headers, payload: changed });
        expect(r.statusCode, r.body).toBe(422);
      }
      expect((await app.inject({ method: "POST", url, payload })).statusCode).toBe(403);
      expect((await app.inject({ method: "POST", url, headers: { ...headers, "x-catering-business-id": "beta" }, payload })).statusCode).toBe(403);
      expect(await store.getDraft({ businessId: "alpha" }, draft.draftId)).toEqual(draft);
    } finally { await app.close(); }
  });
  it("does not export unpriced automatic package services or a catalogue total as an offer", async () => {
    const { app, draft } = await harness();
    try {
      draft.serviceModules = [{ moduleId: "invented", label: "Aperitif und Schaumwein", category: "beverage" }];
      draft.customerFacingText = "Flying Bites Auswahl; Gesamt: 940.00 EUR";
      draft.pricingSummary = { subtotal: { amount: 940, currency: "EUR" } };
      const html = renderOfferHtml(draft);
      expect(html).toContain("Kalkulation offen");
      expect(html).toContain("Keine bestätigten Leistungen oder Angebotspreise");
      expect(html).not.toContain("940");
      expect(html).not.toContain("Schaumwein");
      expect(html).not.toContain("Flying Bites");
    } finally { await app.close(); }
  });

});
