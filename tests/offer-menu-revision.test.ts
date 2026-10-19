import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { createEventRequestFromText, normalizeEventRequestToSpec } from "@catering/shared-core";

const text = "SYNTHETISCH: Empfang und Abendbuffet für 100 Gäste am 12.11.2026. 55 Portionen Hähnchenragout, 25 Portionen vegetarische Gemüsebratlinge, 20 Portionen veganes Linsenragout; jeweils 150 g gegarte Hauptkomponente. Empfang 18 Uhr. Personal: 4 Servicekräfte für 6 Stunden.";
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

  it("ignores customer and document dates and refuses ambiguous or invalid event dates", () => {
    const specFor = (rawText: string) => normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "dates", channel: "text", rawText }));
    expect(specFor("Kunde: SYNTHETISCH Nachprüfung 19.10.2026\nAnfragedatum: 18.10.2026\n" + text).event.date).toBe("2026-11-12");
    expect(specFor("100 Gäste am 31.02.2026").event.date).toBeUndefined();
    const ambiguous = specFor("100 Gäste, Termin 12.11.2026 oder 13.11.2026.");
    expect(ambiguous.event.date).toBeUndefined();
    expect(ambiguous.uncertainties?.some(item => item.field === "event.date")).toBe(true);
  });

  it("revises event data in every variant, preserves portions and historical snapshots, and exports the corrected header", async () => {
    const { app, store, draft } = await harness();
    try {
      const { renderOfferHtml } = await import("../print-export/src/index.js");
      const original = structuredClone(draft);
      const eventDetails = { eventDate: "2026-11-13", attendeeCount: 100, eventType: "Wissenschaftlicher Abend", serviceForm: "buffet",
        eventSchedule: [{ label: "Abendcatering", start: "18:00", end: "22:00" }] };
      const payload = { revision: draft.revision, menuPlan: draft.proposedEventSpec.menuPlan, eventDetails };
      // Only the established menu input fields are sent by the browser.
      payload.menuPlan = payload.menuPlan.map(({componentId,label,servings,menuCategory,dietaryTags}: any) => ({componentId,label,servings,menuCategory,dietaryTags}));
      const url = "/v1/offers/drafts/" + draft.draftId + "/menu";
      const r = await app.inject({ method: "POST", url, headers, payload });
      expect(r.statusCode, r.body).toBe(201);
      const revised = r.json();
      for (const spec of [revised.proposedEventSpec, ...revised.variantSet.map((v: any) => v.proposedEventSpec)]) {
        expect(spec.event.date).toBe(eventDetails.eventDate);
        expect(spec.event.schedule).toEqual(eventDetails.eventSchedule);
        expect(spec.menuPlan.map((x: any) => x.servings)).toEqual(expected);
      }
      expect(revised.reviewStatus.publishApproved).toBe(false);
      expect(revised.eventSummary).toContain("Wissenschaftlicher Abend");
      expect(revised.openQuestions).not.toContain("Wie lautet das verbindliche Zeitfenster?");
      expect(await store.getDraft({businessId:"alpha"}, draft.draftId)).toEqual(original);
      const html = renderOfferHtml(revised);
      expect(html).toContain("2026-11-13");
      expect(html).toContain("Abendcatering");
      expect(html).toContain("18:00");
      expect(html).not.toContain("<h1>Angebot</h1>");
      const unsafeHeader = {...revised,proposedEventSpec:{...revised.proposedEventSpec,customer:{name:"<img src=x onerror=alert(1)>"},
        venue:{name:"<script>Ort</script>"},event:{...revised.proposedEventSpec.event,title:"<script>Abend</script>"}}};
      for(const publishApproved of [false,true]) {
        const headerHtml=renderOfferHtml({...unsafeHeader,reviewStatus:{...unsafeHeader.reviewStatus,publishApproved}});
        expect(headerHtml).not.toContain("<script>");
        expect(headerHtml).not.toContain("<img ");
        expect(headerHtml).toContain("&lt;img");
        expect(headerHtml).toContain("2026-11-13");
        expect(headerHtml).toContain("18:00");
      }
      const stale = await app.inject({ method:"POST", url, headers, payload: {...payload, eventDetails:{...eventDetails,eventDate:"2026-11-14"}} });
      expect(stale.statusCode).toBe(409);
      const invalid = await app.inject({ method:"POST", url, headers, payload: {...payload, eventDetails:{...eventDetails,eventDate:"2026-02-31"}} });
      expect(invalid.statusCode).toBe(422);
    } finally { await app.close(); }
  });

  it("retains independently authored date and guest risks and does not answer unchanged source values", async () => {
    const { amendOfferEvent } = await import("../offer-service/src/offer-event-revision.js");
    const source = normalizeEventRequestToSpec(createEventRequestFromText({requestId:"independent-event",channel:"text",rawText:text}));
    const independent = [
      {field:"event.date",severity:"high" as const,message:"Venue not confirmed",suggestedQuestion:"Vertrag prüfen"},
      {field:"attendees.expected",severity:"high" as const,message:"Safety capacity open",suggestedQuestion:"Kapazität prüfen"}
    ];
    const extracted = {field:"event.date",severity:"medium" as const,message:"Mehrere oder ungültige Datumsangaben; Veranstaltungstermin nicht eindeutig.",suggestedQuestion:"Welches gültige Veranstaltungsdatum gilt verbindlich?"};
    source.uncertainties = [...independent, extracted];
    expect(amendOfferEvent(source,{eventDate:source.event.date,attendeeCount:100,eventSchedule:[{label:"Service",start:"18:00",end:"22:00"}]}).uncertainties).toEqual(source.uncertainties);
    const changed = amendOfferEvent(source,{eventDate:"2026-11-13",attendeeCount:101});
    expect(changed.uncertainties).toEqual(independent);
    expect(changed.menuPlan.map(x=>x.servings)).toEqual([55,25,20]);
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
