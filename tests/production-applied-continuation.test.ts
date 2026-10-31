import { describe, expect, it, vi } from "vitest";
import { newDb } from "pg-mem";
import { resolveLastAppliedSnapshot } from "@catering/production-service";
import { approvedDescendant, context, headers } from "./support/approved-production-descendant.js";

function postgresPool() {
  const { Pool } = newDb().adapters.createPg();
  const base = new Pool();
  return { query: base.query.bind(base), async connect() {
    const client = await base.connect();
    return { async query(sql: string, params?: unknown[]) {
      if (sql.startsWith("SELECT pg_catalog.pg_advisory_xact_lock") || sql.startsWith("SELECT pg_catalog.set_config")) return { rows: [] };
      return client.query(sql, params);
    }, release: () => client.release() };
  }, end: () => base.end() };
}

describe("a new review after an applied production plan", () => {
  it.each(["file", "postgres"] as const)("preserves the published %s snapshot, creates one bound child and handles an exact retry", async backend => {
    const pool = backend === "postgres" ? postgresPool() : undefined;
    const fixture = await approvedDescendant(pool);
    try {
      expect((await fixture.apply()).statusCode).toBe(200);
      const before = await resolveLastAppliedSnapshot(fixture.store, context, fixture.caseId);
      const parent = await fixture.store.getProductionDraft(context, fixture.prepared.draftId);
      const command = { kind: "clarification_followup", caseId: fixture.caseId, expectedRevision: fixture.prepared.revision };
      const post = (payload = command) => fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${fixture.prepared.draftId}/revise`, headers, payload });
      const response = await post();
      expect(response.statusCode, response.body).toBe(201);
      const child = response.json().draft;
      expect(child.status).toBe("pending_review");
      expect(child.revision).toBe(fixture.prepared.revision + 1);
      expect(child.supersedesDraftId).toBe(fixture.prepared.draftId);
      expect((await fixture.store.getProductionDraft(context, child.draftId))!.draftArtifacts.eventSpec).toEqual(parent!.draftArtifacts.eventSpec);
      expect(child.draftArtifacts.eventSpec.budgetContext).toBeUndefined();
      expect(child.draftArtifacts.productionPlan).toBeUndefined();
      expect(child.reviewCards.every((card: {decision: string}) => card.decision === "pending")).toBe(true);
      expect(await fixture.store.getProductionDraft(context, fixture.prepared.draftId)).toEqual(parent);
      const current = (await fixture.store.getCase(context, fixture.caseId))!;
      expect(current.status).toBe("open");
      expect(current.currentPlanId).toBeUndefined();
      expect(current.currentPurchaseListId).toBeUndefined();
      expect(current.approvedProductionSpecId).toBeUndefined();
      const after = await resolveLastAppliedSnapshot(fixture.store, context, fixture.caseId);
      expect(after!.approvedSpec).toEqual(before!.approvedSpec);
      expect(after!.manifest).toEqual(before!.manifest);
      const caseRead = await fixture.app.inject({ method: "GET", url: `/v1/production/cases/${fixture.caseId}`, headers });
      expect(caseRead.statusCode, caseRead.body).toBe(200);
      expect(caseRead.json().lastApplied).toMatchObject({ draftId: fixture.prepared.draftId, draftRevision: fixture.prepared.revision, productionPlan: { planId: before!.manifest.planId }, purchaseList: { purchaseListId: before!.manifest.purchaseListId } });
      const retry = await post();
      expect(retry.statusCode, retry.body).toBe(201);
      expect(retry.json().draft).toEqual(child);
      expect((await fixture.store.listEvents(context, fixture.caseId)).filter(event => event.artifactId === child.draftId)).toHaveLength(1);
      expect((await post({ ...command, expectedRevision: command.expectedRevision! + 1 })).statusCode).toBe(409);
      expect((await post({ ...command, caseId: "unknown-case" })).statusCode).toBe(409);
      const premature = await fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${child.draftId}/decision`, headers, payload: { decision: "approved" } });
      expect(premature.statusCode).toBeGreaterThanOrEqual(400);
    } finally { await fixture.app.close(); await pool?.end(); }
  });
  it.each(["before-event", "after-event"] as const)("recovers the exact file prefix %s without touching the applied parent", async failure => {
    const fixture = await approvedDescendant();
    let spy: ReturnType<typeof vi.spyOn> | undefined;
    try {
      expect((await fixture.apply()).statusCode).toBe(200);
      const parent = await fixture.store.getProductionDraft(context, fixture.prepared.draftId);
      const original = fixture.store.withCaseApplyCriticalSection.bind(fixture.store);
      let faultPending = true;
      const wrapped: typeof fixture.store.withCaseApplyCriticalSection = (actor, caseId, operation, target, publications, namespaces) => original(actor, caseId, async (current, scope, transaction) => {
        const append = scope.appendCaseEvent;
        scope.appendCaseEvent = async (...args) => {
          if (args[1].kind !== "revision_created" || !faultPending) return append(...args);
          faultPending = false;
          if (failure === "after-event") await append(...args);
          throw new Error("synthetic file-prefix failure");
        };
        return operation(current, scope, transaction);
      }, target, publications, namespaces);
      spy = vi.spyOn(fixture.store, "withCaseApplyCriticalSection").mockImplementation(wrapped);
      const post = () => fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${fixture.prepared.draftId}/revise`, headers, payload: {
        kind: "clarification_followup", caseId: fixture.caseId, expectedRevision: fixture.prepared.revision
      } });
      expect((await post()).statusCode).toBe(500);
      const recovered = await post();
      expect(recovered.statusCode, recovered.body).toBe(201);
      const childId = recovered.json().draft.draftId;
      expect((await fixture.store.listEvents(context, fixture.caseId)).filter(event => event.artifactId === childId)).toHaveLength(1);
      expect(await fixture.store.getProductionDraft(context, fixture.prepared.draftId)).toEqual(parent);
      expect((await fixture.store.getCase(context, fixture.caseId))!.currentPlanId).toBeUndefined();
    } finally { spy?.mockRestore(); await fixture.app.close(); }
  });

  it("requires fresh planning and review before the continuation can be applied", async () => {
    const fixture = await approvedDescendant(undefined, undefined, { dietaryQuestions: true, extraDraftNotes: true });
    try {
      expect((await fixture.apply()).statusCode).toBe(200);
      const before = await resolveLastAppliedSnapshot(fixture.store, context, fixture.caseId);
      const followup = await fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${fixture.prepared.draftId}/revise`, headers, payload: { kind: "clarification_followup", caseId: fixture.caseId, expectedRevision: fixture.prepared.revision } });
      expect(followup.statusCode, followup.body).toBe(201);
      const child = followup.json().draft;
      const previousEvidence = await fixture.store.listProductionPlanningEvidence(context, fixture.revision.draftId, fixture.revision.revision);
      for (const evidence of previousEvidence) {
        const recorded = await fixture.app.inject({ method: "POST", url: `/v1/production/cases/${fixture.caseId}/planning-evidence`, headers,
          payload: { draftId: child.draftId, draftRevision: child.revision, componentId: evidence.componentId, recipeId: evidence.recipeId,
            quantityDecision: evidence.quantityDecision, recipeEventUseReview: evidence.recipeEventUseReview } });
        expect(recorded.statusCode, recorded.body).toBe(201);
      }
      const preparation = await fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${child.draftId}/prepare`, headers, payload: {} });
      expect(preparation.statusCode, preparation.body).toBe(201);
      const prepared = preparation.json().draft;
      for (const card of prepared.reviewCards) {
        const review = await fixture.app.inject({ method: "PATCH", url: `/v1/production/drafts/${prepared.draftId}/review-cards/${card.cardId}`, headers, payload: { decision: "fits" } });
        expect(review.statusCode, review.body).toBe(200);
      }
      const decision = await fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${prepared.draftId}/decision`, headers, payload: { decision: "approved" } });
      expect(decision.statusCode, decision.body).toBe(201);
      const result = await fixture.app.inject({ method: "POST", url: `/v1/production/approved-specs/${decision.json().approvedProductionSpec.approvedProductionSpecId}/apply`, headers });
      expect(result.statusCode, result.body).toBe(200);
      expect((await fixture.store.getApprovedProductionSpec(context, fixture.approvedId))!).toEqual(before!.approvedSpec);
      const latest = await resolveLastAppliedSnapshot(fixture.store, context, fixture.caseId);
      expect(latest!.approvedSpec.sourceDraft.draftId).toBe(prepared.draftId);
      expect(latest!.manifest.planId).not.toBe(before!.manifest.planId);
      const previousCards = prepared.reviewCards.filter((card: {cardId: string}) => card.cardId.startsWith("dietary-question-"));
      expect(previousCards).toHaveLength(4);
      const secondFollowup = await fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${prepared.draftId}/revise`, headers,
        payload: { kind: "clarification_followup", caseId: fixture.caseId, expectedRevision: prepared.revision } });
      expect(secondFollowup.statusCode, secondFollowup.body).toBe(201);
      const secondChild = secondFollowup.json().draft;
      expect(secondChild.reviewCards.some((card: {cardId: string}) => card.cardId.startsWith("dietary-question-"))).toBe(false);
      for (const evidence of previousEvidence) {
        const recorded = await fixture.app.inject({ method: "POST", url: `/v1/production/cases/${fixture.caseId}/planning-evidence`, headers,
          payload: { draftId: secondChild.draftId, draftRevision: secondChild.revision, componentId: evidence.componentId, recipeId: evidence.recipeId,
            quantityDecision: evidence.quantityDecision, recipeEventUseReview: evidence.recipeEventUseReview } });
        expect(recorded.statusCode, recorded.body).toBe(201);
      }
      const secondPreparation = await fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${secondChild.draftId}/prepare`, headers, payload: {} });
      expect(secondPreparation.statusCode, secondPreparation.body).toBe(201);
      const secondCards = secondPreparation.json().draft.reviewCards.filter((card: {cardId: string}) => card.cardId.startsWith("dietary-question-"));
      expect(secondCards).toHaveLength(4);
      expect(secondCards.every((card: {cardId: string;decision:string}) => card.decision === "pending" && !previousCards.some((old: {cardId:string}) => old.cardId === card.cardId))).toBe(true);
      const stale = await fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${fixture.prepared.draftId}/revise`, headers,
        payload: { kind: "clarification_followup", caseId: fixture.caseId, expectedRevision: fixture.prepared.revision } });
      expect(stale.statusCode).toBe(409);
    } finally { await fixture.app.close(); }
  });

  it("serializes parallel commands and blocks an unprojected competing sibling", async () => {
    const fixture = await approvedDescendant();
    try {
      expect((await fixture.apply()).statusCode).toBe(200);
      const post = () => fixture.app.inject({ method: "POST", url: `/v1/production/drafts/${fixture.prepared.draftId}/revise`, headers,
        payload: { kind: "clarification_followup", caseId: fixture.caseId, expectedRevision: fixture.prepared.revision } });
      const results = await Promise.all([post(), post()]);
      expect(results.some(result => result.statusCode === 201)).toBe(true);
      expect(results.every(result => [201,409].includes(result.statusCode))).toBe(true);
      const children = (await fixture.store.listProductionDrafts(context)).filter(draft => draft.supersedesDraftId === fixture.prepared.draftId);
      expect(children).toHaveLength(1);
      expect((await fixture.store.listEvents(context, fixture.caseId)).filter(event => event.artifactId === children[0]!.draftId)).toHaveLength(1);
      await fixture.store.insertProductionDraft(context, { ...children[0]!, draftId: "synthetic-competing-orphan" });
      expect((await post()).statusCode).toBe(409);
    } finally { await fixture.app.close(); }
  });

  it("rejects the same command data under another tenant before publishing a child", async () => {
    const fixture = await approvedDescendant();
    try {
      expect((await fixture.apply()).statusCode).toBe(200);
      const snapshot = (await resolveLastAppliedSnapshot(fixture.store, context, fixture.caseId))!;
      const parent = (await fixture.store.getProductionDraft(context, fixture.prepared.draftId))!;
      const before = await fixture.store.listProductionDrafts(context);
      const { approvalRequestId: _approval, approvedBy: _by, approvedAt: _at, ...pendingBase } = parent;
      const child = { ...pendingBase, draftId: "synthetic-foreign-command", revision: parent.revision + 1, supersedesDraftId: parent.draftId,
        status: "pending_review" as const, draftArtifacts: { eventSpec: parent.draftArtifacts.eventSpec }, reviewCards: [{ cardId: "synthetic-pending-check", kind: "event_data" as const, title: "Angaben prüfen", summary: "Synthetischer Prüfpunkt", targetPath: "$.draftArtifacts.eventSpec", decision: "pending" as const, requiredApproval: true }] };
      expect(await fixture.store.commitAppliedDraftContinuation({ businessId: "other-tenant" }, { caseId: fixture.caseId, expectedCase: snapshot.productionCase, parent,
        child, approvedSpec: snapshot.approvedSpec, manifest: snapshot.manifest })).toBeUndefined();
      expect(await fixture.store.listProductionDrafts(context)).toEqual(before);
      expect(await fixture.store.getCase({ businessId: "other-tenant" }, fixture.caseId)).toBeUndefined();
    } finally { await fixture.app.close(); }
  });

});
