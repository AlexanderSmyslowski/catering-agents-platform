import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { createEventRequestFromText, normalizeEventRequestToSpec } from "@catering/shared-core";

const text = "SYNTHETISCH: Empfang und Abendbuffet für 100 Gäste am 12.11.2026. 55 Portionen Hähnchenragout, 25 Portionen vegetarische Gemüsebratlinge, 20 Portionen veganes Linsenragout; jeweils 150 g gegarte Hauptkomponente. Personal: 4 Servicekräfte für 6 Stunden.";
const expected = [55, 25, 20];
const secret = "synthetic-menu-test-secret";
const headers = { "x-catering-trusted-secret": secret, "x-catering-actor-name": "Angebots-Mitarbeiter", "x-catering-business-id": "alpha" };

async function harness() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-menu-revision-"));
  const store = new OfferStore({ rootDir });
  const app = buildOfferApp({ rootDir, store, trustedActorSecret: secret, env: { CATERING_DEV_AUTH: "1", CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret } });
  const c = await app.inject({ method: "POST", url: "/v1/offers/cases", headers, payload: {} });
  const caseId = c.json().case.caseId;
  const response = await app.inject({ method: "POST", url: "/v1/offers/from-text", headers, payload: { caseId, text } });
  expect(response.statusCode, response.body).toBe(201);
  return { app, store, caseId, draft: response.json() };
}

describe("explicit offer menu and persisted continuation", () => {
  it("extracts dish portions without treating staff, grams or dietary subgroups as extra meals", () => {
    const spec = normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "synthetic-100", channel: "text", rawText: text }));
    expect(spec.menuPlan.map(x => x.servings)).toEqual(expected);
    expect(spec.menuPlan.map(x => x.label)).toEqual(["Hähnchenragout", "vegetarische Gemüsebratlinge", "veganes Linsenragout"]);
    expect(spec.menuPlan[2]?.dietaryTags).toContain("vegan");
  });

  it("keeps explicit dishes and portions in the curated offer, every variant and customer text", async () => {
    const { app, draft } = await harness();
    try {
      expect(draft.proposedEventSpec.menuPlan.map((x: any) => x.servings)).toEqual(expected);
      for (const v of draft.variantSet) expect(v.proposedEventSpec.menuPlan).toEqual(draft.proposedEventSpec.menuPlan);
      expect(draft.customerFacingText).toContain("55");
      expect(draft.customerFacingText).toContain("Hähnchenragout");
      expect(draft.reviewStatus.publishApproved).toBe(false);
    } finally { await app.close(); }
  });

  it("clears stale recipe and procurement choices on replacement but preserves them for portion-only corrections", async () => {
    const { app, store, caseId, draft } = await harness();
    try {
      const source = structuredClone(draft);
      source.draftId = "recipe-bound-synthetic";
      source.proposedEventSpec.menuPlan[0].recipeOverrideId = "original-chicken";
      source.proposedEventSpec.menuPlan[0].productionDecision = { mode: "scratch", purchasedElements: [] };
      await store.saveDraftForCase({ businessId: "alpha" }, caseId, source);
      const item = source.proposedEventSpec.menuPlan[0];
      const payload = { revision: 1, menuPlan: [{ componentId: item.componentId, label: item.label, servings: 54 }] };
      const same = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + source.draftId + "/menu", headers, payload });
      expect(same.statusCode, same.body).toBe(201);
      expect(same.json().proposedEventSpec.menuPlan[0].recipeOverrideId).toBe("original-chicken");
      const changed = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + same.json().draftId + "/menu", headers,
        payload: { revision: 1, menuPlan: [{ componentId: item.componentId, label: "Anderes Gericht", servings: 54 }] } });
      expect(changed.statusCode, changed.body).toBe(201);
      expect(changed.json().proposedEventSpec.menuPlan[0].recipeOverrideId).toBeUndefined();
      expect(changed.json().proposedEventSpec.menuPlan[0].productionDecision).toBeUndefined();
    } finally { await app.close(); }
  });

  it("has one winner for concurrent menu continuations from the same case head", async () => {
    const { app, draft } = await harness();
    try {
      const url = "/v1/offers/drafts/" + encodeURIComponent(draft.draftId) + "/menu";
      const results = await Promise.all([30, 40].map(servings => app.inject({ method: "POST", url, headers, payload: { revision: 1, menuPlan: [{ label: "Konkurrierende Menüfassung", servings }] } })));
      expect(results.map(x => x.statusCode).sort()).toEqual([201, 409]);
    } finally { await app.close(); }
  });

  it("saves a new immutable case-bound menu, replays exactly, rejects stale updates, and passes portions to approval/handoff", async () => {
    const { app, store, draft, caseId } = await harness();
    try {
      const menuPlan = [
        { label: "Hähnchenragout", servings: 55, menuCategory: "classic" },
        { label: "Gemüsebratlinge", servings: 25, menuCategory: "vegetarian" },
        { label: "Linsenragout", servings: 20, menuCategory: "vegan" }
      ];
      const url = "/v1/offers/drafts/" + encodeURIComponent(draft.draftId) + "/menu";
      const payload = { revision: 1, menuPlan };
      const r = await app.inject({ method: "POST", url, headers, payload });
      expect(r.statusCode, r.body).toBe(201);
      const revised = r.json();
      expect(revised.draftId).not.toBe(draft.draftId);
      expect(revised.proposedEventSpec.menuPlan.map((x: any) => x.servings)).toEqual(expected);
      expect(await store.getDraft({ businessId: "alpha" }, draft.draftId)).toEqual(draft);
      expect(await store.findCaseIdForDraft({ businessId: "alpha" }, revised.draftId, revised.revision)).toBe(caseId);
      const retry = await app.inject({ method: "POST", url, headers, payload });
      expect(retry.statusCode, retry.body).toBe(201);
      expect(retry.json()).toEqual(revised);
      const stale = await app.inject({ method: "POST", url, headers, payload: { ...payload, menuPlan: [{ label: "Andere Speise", servings: 100 }] } });
      expect(stale.statusCode).toBe(409);
      const bad = await app.inject({ method: "POST", url, headers, payload: { revision: 1, menuPlan: [{ label: "Fehler", servings: -1 }] } });
      expect(bad.statusCode).toBe(422);
      const foreign = await app.inject({ method: "POST", url, headers: { ...headers, "x-catering-business-id": "beta" }, payload });
      expect(foreign.statusCode).toBe(403);
      const forbidden = await app.inject({ method: "POST", url, payload });
      expect(forbidden.statusCode).toBe(403);
      const approval = await app.inject({ method: "POST", url: "/v1/offers/drafts/" + encodeURIComponent(revised.draftId) + "/decision", headers, payload: { decision: "approved", revision: revised.revision, variantId: revised.variantSet[1].variantId } });
      expect(approval.statusCode, approval.body).toBe(201);
      expect(approval.json().approvedOffer.selectedVariant.proposedEventSpec.menuPlan.map((x: any) => x.servings)).toEqual(expected);
      const handoff = await app.inject({ method: "POST", url: "/v1/offers/approved/" + approval.json().approvedOffer.approvedOfferId + "/handoffs", headers, payload: {} });
      expect(handoff.statusCode, handoff.body).toBe(201);
    } finally { await app.close(); }
  });
});
