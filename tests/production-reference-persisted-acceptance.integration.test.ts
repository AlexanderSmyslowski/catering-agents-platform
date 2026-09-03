import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AuditLogStore } from "../shared-core/src/index.js";
import {
  resolveProductionReferenceValidatedEvidence,
  evaluateProductionReferenceAcceptance
} from "../shared-core/src/production-reference-acceptance.js";
import { createOfferProductionReferencePersistenceCapability } from "../offer-service/src/production-reference-acceptance-boundary.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";

const trustedSecret = "reference-acceptance-integration-secret";
const headers = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "local"
};
const sourceSha256 = "sha256:" + "b".repeat(64);

async function persistApprovedHandoff(
  app: ReturnType<typeof buildOfferApp>,
  store: OfferStore,
  options: { reviewed?: boolean } = {}
) {
  const caseResponse = await app.inject({
    method: "POST",
    url: "/v1/offers/cases",
    headers,
    payload: { eventTypeLabel: "Synthetischer Referenzfall", attendeeCount: 12 }
  });
  const caseId = caseResponse.json<{ case: { caseId: string } }>().case.caseId;
  const draftResponse = await app.inject({
    method: "POST",
    url: "/v1/offers/from-text",
    headers,
    payload: { caseId, text: "Synthetische Probe für zwölf Personen." }
  });
  const draft = draftResponse.json<{ draftId: string; variantSet: Array<{ variantId: string }> }>();
  const persistedDraft = await store.getDraft({ businessId: "local" }, draft.draftId);
  if (!persistedDraft) throw new Error("OfferDraft wurde nicht persistiert.");
  const reviewedDraft = options.reviewed === false
    ? persistedDraft
    : {
      // Do not rewrite the case's original draft revision. A continuation is
      // a new draft identity with its own canonical draft_created event.
      ...persistedDraft,
      draftId: `${persistedDraft.draftId}-reviewed`,
      revision: 1,
      reviewStatus: {
        priceReviewStatus: "verified" as const,
        taxReviewStatus: "verified" as const,
        allergenReviewStatus: "verified" as const,
        hygieneTemperatureReviewStatus: "verified" as const,
        sourceSecured: true,
        publishApproved: true
      }
    };
  if (reviewedDraft !== persistedDraft) {
    expect(await store.saveDraftForCase({ businessId: "local" }, caseId, reviewedDraft)).toBe("saved");
    expect(await store.getDraft({ businessId: "local" }, reviewedDraft.draftId)).toEqual(reviewedDraft);
  }
  const decisionResponse = await app.inject({
    method: "POST",
    url: `/v1/offers/drafts/${reviewedDraft.draftId}/decision`,
    headers,
    payload: { decision: "approved", revision: reviewedDraft.revision, variantId: reviewedDraft.variantSet[0]!.variantId }
  });
  expect(decisionResponse.statusCode, decisionResponse.body).toBe(201);
  const approvedOfferId = decisionResponse.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
  const handoffResponse = await app.inject({
    method: "POST",
    url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
    headers,
    payload: {}
  });
  expect(handoffResponse.statusCode, handoffResponse.body).toBe(201);
  return {
    caseId,
    approvedOfferId,
    handoff: handoffResponse.json<{ handoff: { handoffId: string; approvalRequestId: string; approvedOfferId: string } }>().handoff
  };
}

async function buildBoundaryInput(
  store: OfferStore,
  auditLog: AuditLogStore,
  persisted: Awaited<ReturnType<typeof persistApprovedHandoff>>,
  options: { sourceCaseId?: string; pricingBasis?: "module_catalog_estimate" | "full_cost_model" } = {}
) {
  const context = { businessId: "local" };
  const approval = await store.getApproval(context, persisted.handoff.approvalRequestId);
  const approvedOffer = await store.getApprovedOffer(context, persisted.approvedOfferId);
  const handoff = await store.getHandoff(context, persisted.handoff.handoffId);
  if (!approval || !approvedOffer || !handoff) throw new Error("Persistierte Angebotskette fehlt.");
  const sourceCaseId = options.sourceCaseId ?? persisted.caseId;
  const sourceAudit = await auditLog.logFor(context, {
    action: "reference.source_verified",
    entityType: "OfferCase",
    entityId: sourceCaseId,
    actor: { name: "Boundary-Test", source: "synthetic" },
    summary: "Synthetische Quelle geprüft.",
    details: { sourceCaseId, sourceSha256 }
  });
  const kitchenAudit = await auditLog.logFor(context, {
    action: "production.kitchen_acceptance",
    entityType: "ProductionHandoff",
    entityId: handoff.handoffId,
    actor: { name: "Boundary-Küche", source: "synthetic" },
    summary: "Synthetische Küchenabnahme ohne Rettungschat.",
    details: { rescueChatUsed: false }
  });
  const audits = await auditLog.listRecentFor(context, 5000);
  const approvalAudit = audits.find((entry) => entry.action === "offer.approved" && entry.entityId === approvedOffer.approvedOfferId);
  const handoffAudit = audits.find((entry) => entry.action === "offer.production_handoff_created" && entry.entityId === handoff.handoffId);
  if (!approvalAudit || !handoffAudit) throw new Error("Persistierte Approval-/Handoff-Audits fehlen.");
  return {
    input: {
      sourceCaseId,
      sourceSha256,
      sourceLineageId: `audit:${sourceAudit.auditId}`,
      eventSpecId: handoff.eventSpecSnapshot.specId,
      offerId: approvedOffer.approvedOfferId,
      approvalRequestId: approval.approvalRequestId,
      handoffId: handoff.handoffId,
      approvalAuditId: approvalAudit.auditId,
      handoffAuditId: handoffAudit.auditId,
      kitchenAcceptanceAuditId: kitchenAudit.auditId,
      pricingSummary: approvedOffer.pricingSummary,
      pricingBasis: options.pricingBasis ?? "module_catalog_estimate",
      rescueChatUsed: false as const
    },
    approval,
    approvedOffer,
    handoff,
    sourceAudit,
    kitchenAudit
  };
}

describe("persisted production reference acceptance boundary", () => {
  it("rejects caller-supplied store-shaped adapters at the server boundary", () => {
    expect(() => createOfferProductionReferencePersistenceCapability({
      store: {} as OfferStore,
      auditLog: {} as AuditLogStore,
      context: { businessId: "local" }
    })).toThrow("reguläre Offer- und Audit-Stores");
  });

  it("issues validated evidence only after approval, handoff and audit records exist", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-reference-persisted-"));
    const store = new OfferStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });
    try {
      const persisted = await persistApprovedHandoff(app, store);
      const approval = await store.getApproval({ businessId: "local" }, persisted.handoff.approvalRequestId);
      const approvedOffer = await store.getApprovedOffer({ businessId: "local" }, persisted.approvedOfferId);
      const handoff = await store.getHandoff({ businessId: "local" }, persisted.handoff.handoffId);
      const sourceAudit = await auditLog.logFor({ businessId: "local" }, {
        action: "reference.source_verified",
        entityType: "OfferCase",
        entityId: persisted.caseId,
        actor: { name: "Test-Resolver", source: "synthetic" },
        summary: "Synthetische Quelle geprüft.",
        details: { sourceCaseId: persisted.caseId, sourceSha256 }
      });
      const kitchenAudit = await auditLog.logFor({ businessId: "local" }, {
        action: "production.kitchen_acceptance",
        entityType: "ProductionHandoff",
        entityId: persisted.handoff.handoffId,
        actor: { name: "Test-Küche", source: "synthetic" },
        summary: "Synthetische Küchenabnahme ohne Rettungschat.",
        details: { rescueChatUsed: false }
      });
      const audits = await auditLog.listRecentFor({ businessId: "local" }, 50);
      const approvalAudit = audits.find((entry) => entry.action === "offer.approved" && entry.entityId === persisted.approvedOfferId);
      const handoffAudit = audits.find((entry) => entry.action === "offer.production_handoff_created" && entry.entityId === persisted.handoff.handoffId);

      expect(approval?.decision).toBe("approved");
      expect(approvedOffer?.approvalRequestId).toBe(approval?.approvalRequestId);
      expect(handoff?.approvedOfferId).toBe(approvedOffer?.approvedOfferId);
      expect(handoff?.approvalRequestId).toBe(approval?.approvalRequestId);
      expect(approvalAudit).toBeDefined();
      expect(handoffAudit).toBeDefined();

      const evidence = approval && approvedOffer && handoff && approvalAudit && handoffAudit
        && sourceAudit.details?.sourceCaseId === persisted.caseId
        && sourceAudit.details.sourceSha256 === sourceSha256
        && kitchenAudit.details?.rescueChatUsed === false
        ? await resolveProductionReferenceValidatedEvidence({
            sourceCaseId: persisted.caseId,
            sourceSha256,
            sourceLineageId: `audit:${sourceAudit.auditId}`,
            eventSpecId: handoff.eventSpecSnapshot.specId,
            offerId: approvedOffer.approvedOfferId,
            approvalRequestId: approval.approvalRequestId,
            handoffId: handoff.handoffId,
            approvalAuditId: approvalAudit.auditId,
            handoffAuditId: handoffAudit.auditId,
            kitchenAcceptanceAuditId: kitchenAudit.auditId,
            pricingSummary: approvedOffer.pricingSummary,
            pricingBasis: "module_catalog_estimate",
            rescueChatUsed: false
          }, createOfferProductionReferencePersistenceCapability({
            store,
            auditLog,
            context: { businessId: "local" }
          }))
        : undefined;

      const result = evaluateProductionReferenceAcceptance({
        caseId: persisted.caseId,
        source: {
          expectedCaseId: persisted.caseId,
          expectedSha256: sourceSha256,
          observedSha256: sourceSha256,
          lineageReferences: [`audit:${sourceAudit.auditId}`]
        },
        offer: {
          offerId: approvedOffer?.approvedOfferId ?? "missing",
          pricingSummary: approvedOffer?.pricingSummary,
          pricingBasis: "module_catalog_estimate",
          approved: approval?.decision === "approved",
          reviewStatus: {
            priceReviewStatus: "verified",
            taxReviewStatus: "verified",
            allergenReviewStatus: "verified",
            hygieneTemperatureReviewStatus: "verified",
            sourceSecured: true,
            publishApproved: true
          }
        },
        production: {
          plan: {
            schemaVersion: "1.0.0",
            planId: "not-persisted-in-this-offer-slice",
            eventSpecId: handoff?.eventSpecSnapshot.specId ?? "missing",
            readiness: { status: "insufficient", reasons: ["Integration test isolates persisted offer evidence."] },
            productionBatches: [],
            timeline: [],
            kitchenSheets: [],
            recipeSelections: [],
            unresolvedItems: ["Production artifacts are intentionally outside this offer integration slice." ]
          },
          purchaseList: {
            schemaVersion: "1.0.0",
            purchaseListId: "not-persisted",
            eventSpecId: handoff?.eventSpecSnapshot.specId ?? "missing",
            items: [],
            groupingMode: "group",
            totals: { itemCount: 0, groups: [] }
          },
          recipes: []
        },
        operatorAcceptance: {
          accepted: true,
          acceptedBy: "Test-Küche",
          acceptedAt: kitchenAudit.at,
          rescueChatUsed: false
        },
        validatedEvidence: evidence
      });

      expect(result.blockers.map((blocker) => blocker.code)).not.toContain("persisted_evidence_unverified");
      expect(result.status).toBe("blocked");
      expect(result.blockers.map((blocker) => blocker.code)).toContain("production_basis_incomplete");
    } finally {
      await app.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects a cross-case splice even when every individual record is persisted", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-reference-cross-case-"));
    const store = new OfferStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });
    try {
      const first = await persistApprovedHandoff(app, store);
      const second = await persistApprovedHandoff(app, store);
      const source = await buildBoundaryInput(store, auditLog, first);
      const spliced = await buildBoundaryInput(store, auditLog, second, { sourceCaseId: first.caseId });
      const evidence = await resolveProductionReferenceValidatedEvidence(
        spliced.input,
        createOfferProductionReferencePersistenceCapability({ store, auditLog, context: { businessId: "local" } })
      );

      expect(source.input.sourceCaseId).toBe(first.caseId);
      expect(spliced.input.sourceCaseId).toBe(first.caseId);
      expect(spliced.input.offerId).toBe(second.approvedOfferId);
      expect(evidence).toBeUndefined();
    } finally {
      await app.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("binds operator sign-off to the persisted kitchen-acceptance audit", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-reference-kitchen-signoff-"));
    const store = new OfferStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });
    try {
      const persisted = await persistApprovedHandoff(app, store);
      const boundary = await buildBoundaryInput(store, auditLog, persisted);
      const capability = createOfferProductionReferencePersistenceCapability({
        store,
        auditLog,
        context: { businessId: "local" }
      });
      const issued = await resolveProductionReferenceValidatedEvidence(boundary.input, capability);
      expect(issued).toBeDefined();
      expect(issued?.acceptedBy).toBe(boundary.kitchenAudit.actor.name);
      expect(issued?.acceptedAt).toBe(boundary.kitchenAudit.at);
      expect(await resolveProductionReferenceValidatedEvidence({
        ...boundary.input,
        acceptedBy: "Caller-Fake",
        acceptedAt: "2099-10-15T12:00:00.000Z"
      } as never, capability)).toBeUndefined();

      const malformedKitchenAudit = await auditLog.logFor({ businessId: "local" }, {
        action: "production.kitchen_acceptance",
        entityType: "ProductionHandoff",
        entityId: persisted.handoff.handoffId,
        actor: { name: "", source: "synthetic" },
        summary: "Ungültiger synthetischer Abnahmebeleg.",
        at: "not-a-timestamp",
        details: { rescueChatUsed: false }
      });
      expect(await resolveProductionReferenceValidatedEvidence({
        ...boundary.input,
        kitchenAcceptanceAuditId: malformedKitchenAudit.auditId
      }, capability)).toBeUndefined();

      const evaluateWith = (operatorAcceptance: { accepted: true; acceptedBy: string; acceptedAt: string; rescueChatUsed: false }) =>
        evaluateProductionReferenceAcceptance({
          caseId: persisted.caseId,
          source: {
            expectedCaseId: persisted.caseId,
            expectedSha256: sourceSha256,
            observedSha256: sourceSha256,
            lineageReferences: [boundary.input.sourceLineageId]
          },
          offer: {
            offerId: boundary.approvedOffer.approvedOfferId,
            pricingSummary: boundary.approvedOffer.pricingSummary,
            pricingBasis: "module_catalog_estimate",
            approved: true,
            reviewStatus: {
              priceReviewStatus: "verified",
              taxReviewStatus: "verified",
              allergenReviewStatus: "verified",
              hygieneTemperatureReviewStatus: "verified",
              sourceSecured: true,
              publishApproved: true
            }
          },
          production: {
            plan: {
              schemaVersion: "1.0.0",
              planId: "operator-signoff-test-plan",
              eventSpecId: boundary.handoff.eventSpecSnapshot.specId,
              readiness: { status: "insufficient", reasons: ["Sign-off binding is isolated here."] },
              productionBatches: [],
              timeline: [],
              kitchenSheets: [],
              recipeSelections: [],
              unresolvedItems: ["Sign-off binding is isolated here."]
            },
            purchaseList: {
              schemaVersion: "1.0.0",
              purchaseListId: "operator-signoff-test-purchase",
              eventSpecId: boundary.handoff.eventSpecSnapshot.specId,
              items: [],
              groupingMode: "group",
              totals: { itemCount: 0, groups: [] }
            },
            recipes: []
          },
          operatorAcceptance,
          validatedEvidence: issued
        });

      expect(evaluateWith({
        accepted: true,
        acceptedBy: "Unbelegter Fremdoperator",
        acceptedAt: boundary.kitchenAudit.at,
        rescueChatUsed: false
      }).blockers.map((blocker) => blocker.code)).toContain("persisted_operator_acceptance_mismatch");
      expect(evaluateWith({
        accepted: true,
        acceptedBy: boundary.kitchenAudit.actor.name,
        acceptedAt: "2099-10-15T12:00:00.000Z",
        rescueChatUsed: false
      }).blockers.map((blocker) => blocker.code)).toContain("persisted_operator_acceptance_mismatch");
    } finally {
      await app.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("requires the persisted draft review and pricing snapshot before issuing evidence", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-reference-pricing-binding-"));
    const store = new OfferStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });
    try {
      const persisted = await persistApprovedHandoff(app, store, { reviewed: false });
      const boundary = await buildBoundaryInput(store, auditLog, persisted, { pricingBasis: "full_cost_model" });
      const draft = await store.getDraft({ businessId: "local" }, boundary.approvedOffer.sourceDraft.draftId);
      expect(draft?.revision).toBe(boundary.approvedOffer.sourceDraft.revision);
      expect(draft?.reviewStatus?.publishApproved).not.toBe(true);
      const evidence = await resolveProductionReferenceValidatedEvidence(
        boundary.input,
        createOfferProductionReferencePersistenceCapability({ store, auditLog, context: { businessId: "local" } })
      );

      expect(evidence).toBeUndefined();
    } finally {
      await app.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects an evaluated pricing summary that differs from the persisted offer", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-reference-pricing-summary-binding-"));
    const store = new OfferStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });
    try {
      const persisted = await persistApprovedHandoff(app, store);
      const boundary = await buildBoundaryInput(store, auditLog, persisted);
      const tampered = {
        ...boundary.input,
        pricingSummary: {
          ...boundary.approvedOffer.pricingSummary,
          subtotal: {
            ...boundary.approvedOffer.pricingSummary.subtotal,
            amount: boundary.approvedOffer.pricingSummary.subtotal.amount + 1
          }
        }
      };
      const evidence = await resolveProductionReferenceValidatedEvidence(
        tampered,
        createOfferProductionReferencePersistenceCapability({ store, auditLog, context: { businessId: "local" } })
      );

      expect(evidence).toBeUndefined();
    } finally {
      await app.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("resolves required audit IDs directly instead of a recent-event window", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-reference-audit-window-"));
    const store = new OfferStore({ rootDir });
    const auditLog = new AuditLogStore({ rootDir });
    const app = buildOfferApp({ rootDir, store, auditLog, trustedActorSecret: trustedSecret });
    try {
      const persisted = await persistApprovedHandoff(app, store);
      const boundary = await buildBoundaryInput(store, auditLog, persisted);
      for (let index = 0; index < 501; index += 1) {
        await auditLog.logFor({ businessId: "local" }, {
          action: "reference.noise",
          entityType: "OfferCase",
          entityId: persisted.caseId,
          actor: { name: "Audit-Noise", source: "synthetic" },
          summary: `Neuere Auditspur ${index}`,
          at: `2100-01-01T00:00:${String(index % 60).padStart(2, "0")}.${String(index).padStart(3, "0")}Z`,
          idempotencyKey: `audit-noise-${index}`,
          details: { index }
        });
      }
      const evidence = await resolveProductionReferenceValidatedEvidence(
        boundary.input,
        createOfferProductionReferencePersistenceCapability({ store, auditLog, context: { businessId: "local" } })
      );

      expect(evidence).toBeDefined();
    } finally {
      await app.close();
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
