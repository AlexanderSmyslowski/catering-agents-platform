import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ProductionStore, productionDecisionRepositoryFor, buildDietaryQuestionReviewCards, resolveLastAppliedSnapshot } from "@catering/production-service";
import { buildPrintExportApp } from "@catering/print-export";
import { approvedDescendant, context, headers, secret } from "./support/approved-production-descendant.js";

describe("frozen dietary question status in production folders", () => {
  it("rejects a changed reviewed source even with a matching forged card and event", async () => {
    const fixture = await approvedDescendant(undefined, undefined, { dietaryQuestions: true, extraDraftNotes: true });
    const exports = buildPrintExportApp({ rootDir: fixture.rootDir, trustedActorSecret: secret, env: { CATERING_DEV_AUTH: "1" } });
    let aggregateSpy: ReturnType<typeof vi.spyOn> | undefined;
    let eventSpy: ReturnType<typeof vi.spyOn> | undefined;
    try {
      expect((await fixture.apply()).statusCode).toBe(200);
      const approved = (await fixture.store.getApprovedProductionSpec(context, fixture.approvedId))!;
      const repository = productionDecisionRepositoryFor(fixture.store);
      const actual = (await repository.getDecisionAggregate(context, approved.approvalRequestId))!;
      const forged = structuredClone(actual);
      const spec = forged.sourceDraft.draftArtifacts.eventSpec!;
      spec.menuPlan[0]!.menuCategory = "vegan";
      const card = buildDietaryQuestionReviewCards({ businessId: context.businessId, caseId: fixture.caseId, draftId: forged.sourceDraft.draftId, revision: forged.sourceDraft.revision!, spec })[0]!;
      const decidedAt = "2026-10-30T10:00:00.000Z";
      forged.sourceDraft.reviewCards = [...forged.sourceDraft.reviewCards.filter(item => item.targetPath !== card.targetPath), { ...card, decision: "fits", decidedAt }];
      const identity = `review:${forged.sourceDraft.draftId}:${card.cardId}:${decidedAt}`;
      const eventId = `production-case-event-${createHash("sha256").update(`${context.businessId}\0${fixture.caseId}\0review_decision\0${identity}`).digest("hex")}`;
      const proto = Object.getPrototypeOf(repository);
      const getAggregate = proto.getDecisionAggregate;
      aggregateSpy = vi.spyOn(proto, "getDecisionAggregate").mockImplementation(async function (...args: unknown[]) { const value = await getAggregate.apply(this, args); return value?.approval.approvalRequestId === approved.approvalRequestId ? forged : value; });
      const listEvents = ProductionStore.prototype.listEvents;
      eventSpy = vi.spyOn(ProductionStore.prototype, "listEvents").mockImplementation(async function (this: ProductionStore, actor, caseId) {
        const events = await listEvents.call(this, actor, caseId);
        const prior = events.find(event => event.kind === "review_decision" && event.artifactId === forged.sourceDraft.draftId)!;
        return [...events, { ...prior, eventId, at: decidedAt, text: "Prüfpunkt als „Passt“ bewertet." }];
      });
      await expect(resolveLastAppliedSnapshot(fixture.store, context, fixture.caseId)).rejects.toMatchObject({ statusCode: 409 });
      const base = `/v1/exports/production-folders/${approved.artifacts.productionPlan.planId}/html`;
      expect((await exports.inject({ method: "GET", url: base, headers })).statusCode).toBe(409);
      expect((await exports.inject({ method: "GET", url: `${base}?snapshotCaseId=${fixture.caseId}`, headers })).statusCode).toBe(409);
    } finally { aggregateSpy?.mockRestore(); eventSpy?.mockRestore(); await exports.close(); await fixture.app.close(); }
  });

  it("uses only the confirmed review events of the selected applied revision", async () => {
    const first = await approvedDescendant(undefined, undefined, { dietaryQuestions: true, extraDraftNotes: true });
    const exports = buildPrintExportApp({ rootDir: first.rootDir, trustedActorSecret: secret, env: { CATERING_DEV_AUTH: "1" } });
    let spy: ReturnType<typeof vi.spyOn> | undefined;
    try {
      expect((await first.apply()).statusCode).toBe(200);
      const approved = (await first.store.getApprovedProductionSpec(context, first.approvedId))!;
      const path = `/v1/exports/production-folders/${approved.artifacts.productionPlan.planId}/html?snapshotCaseId=${first.caseId}`;
      const read = () => exports.inject({ method: "GET", url: path, headers });
      const original = await read();
      expect(original.statusCode, original.body).toBe(200);
      expect(original.body.match(/Beantwortet: Welche Ernährungskennzeichnung/g)).toHaveLength(4);
      expect(original.body).toContain("Kategorie: Vegetarisch. Keine Allergen- oder Küchenfreigabe.");
      const aggregate = (await productionDecisionRepositoryFor(first.store).getDecisionAggregate(context, approved.approvalRequestId))!;
      const card = aggregate.sourceDraft.reviewCards.find(item => item.cardId.startsWith("dietary-question-"))!;
      const identity = `review:${aggregate.sourceDraft.draftId}:${card.cardId}:${card.decidedAt}`;
      const eventId = `production-case-event-${createHash("sha256").update(`${context.businessId}\0${first.caseId}\0review_decision\0${identity}`).digest("hex")}`;
      const listEvents = ProductionStore.prototype.listEvents;
      spy = vi.spyOn(ProductionStore.prototype, "listEvents").mockImplementation(async function (this: ProductionStore, actor, caseId) {
        const events = await listEvents.call(this, actor, caseId);
        const index = events.findIndex(event => event.eventId === eventId);
        return index < 0 ? events : events.filter((_event, i) => i !== index);
      });
      const missing = await read();
      expect(missing.statusCode, missing.body).toBe(200);
      expect(missing.body.match(/Beantwortet: Welche Ernährungskennzeichnung/g)).toHaveLength(3);
      expect(missing.body.match(/Offen: Welche Ernährungskennzeichnung/g)).toHaveLength(1);
      spy.mockRestore(); spy = undefined;
      const followup = await first.app.inject({ method: "POST", url: `/v1/production/drafts/${first.prepared.draftId}/revise`, headers,
        payload: { kind: "clarification_followup", caseId: first.caseId, expectedRevision: first.prepared.revision } });
      expect(followup.statusCode, followup.body).toBe(201);
      const child = followup.json().draft;
      expect(child.reviewCards.some((item: { cardId: string }) => item.cardId.startsWith("dietary-question-"))).toBe(false);
      const historic = await read();
      expect(historic.statusCode, historic.body).toBe(200);
      expect(historic.body.match(/Beantwortet: Welche Ernährungskennzeichnung/g)).toHaveLength(4);
    } finally { spy?.mockRestore(); await exports.close(); await first.app.close(); }
  });
});
