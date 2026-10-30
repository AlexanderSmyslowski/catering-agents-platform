import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductionApp, ProductionStore } from "@catering/production-service";
import { createEventRequestFromText, normalizeEventRequestToSpec } from "@catering/shared-core";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";

describe("dietary review in prepared production drafts", () => {
  it("keeps questions pending until the matching card and case event, and rejects ambiguous fits", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "dietary-review-"));
    const store = new ProductionStore({ rootDir });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const secret = "synthetic-dietary-route";
    const headers = { "x-catering-actor-name": "Produktions-Mitarbeiter", "x-catering-trusted-secret": secret };
    const app = buildProductionApp({ dataRoot: rootDir, store, intakeRecords, trustedActorSecret: secret, env: { CATERING_DEV_AUTH: "1" } });
    try {
      const base = normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "dietary-route", channel: "text", rawText: "Buffet am 2026-11-13 für 40 Personen." }));
      const labels = ["Gericht A", "Gericht B", "Gericht C", "Gericht D", "Doppelt"];
      const spec = { ...base, menuPlan: [...labels.map((label, index) => ({ componentId: `c${index}`, label, menuCategory: "vegan" as const, servings: 40, serviceStyle: "buffet" as const })), { componentId: "duplicate", label: "Doppelt", menuCategory: "vegan" as const, servings: 40, serviceStyle: "buffet" as const }], uncertainties: labels.map(label => ({ field: "menuPlan", severity: "medium" as const, message: `Ernährungsangabe für ${label}: vegan. Kennzeichnung vor Freigabe anhand des Rezepts prüfen.`, suggestedQuestion: `Welche Ernährungskennzeichnung gilt nach Rezeptprüfung für ${label}?` })) };
      await intakeRecords.insertSpec({ businessId: "local" }, spec);
      const createdCase = await app.inject({ method: "POST", url: "/v1/production/cases", headers, payload: { customerName: "Test", eventTypeLabel: "Buffet", eventDate: "2026-11-13", attendeeCount: 40 } });
      expect(createdCase.statusCode, createdCase.body).toBe(201);
      const caseId = createdCase.json().case.caseId;
      const created = await app.inject({ method: "POST", url: "/v1/production/drafts", headers, payload: { caseId, specId: spec.specId } });
      expect(created.statusCode, created.body).toBe(201);
      const preparedResponse = await app.inject({ method: "POST", url: `/v1/production/drafts/${created.json().draft.draftId}/prepare`, headers, payload: {} });
      expect(preparedResponse.statusCode, preparedResponse.body).toBe(201);
      const prepared = preparedResponse.json().draft;
      const cards = prepared.reviewCards.filter((card: { cardId: string }) => card.cardId.startsWith("dietary-question-"));
      expect(cards).toHaveLength(5);
      expect(prepared.draftArtifacts.eventSpec.uncertainties).toEqual(spec.uncertainties);
      const list = async () => (await app.inject({ method: "GET", url: `/v1/production/drafts?caseId=${caseId}`, headers })).json().items.find((draft: { draftId: string }) => draft.draftId === prepared.draftId);
      expect((await list()).dietaryQuestionReviews.map((item: { status: string }) => item.status)).toEqual(Array(5).fill("pending"));
      const decision = async (cardId: string) => app.inject({ method: "PATCH", url: `/v1/production/drafts/${prepared.draftId}/review-cards/${cardId}`, headers, payload: { decision: "fits" } });
      expect((await decision(cards[4].cardId)).statusCode).toBe(422);
      expect((await decision(cards[0].cardId)).statusCode).toBe(200);
      expect((await list()).dietaryQuestionReviews.map((item: { status: string }) => item.status)).toEqual(["confirmed", "pending", "pending", "pending", "pending"]);
      const approval = await app.inject({ method: "POST", url: `/v1/production/drafts/${prepared.draftId}/decision`, headers, payload: { decision: "approved" } });
      expect(approval.statusCode).toBe(422);
    } finally { await app.close(); }
  });
});
