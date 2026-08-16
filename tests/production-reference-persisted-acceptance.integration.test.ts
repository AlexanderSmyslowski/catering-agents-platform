import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  AuditLogStore
} from "@catering/shared-core";
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

async function persistApprovedHandoff(app: ReturnType<typeof buildOfferApp>) {
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
  const decisionResponse = await app.inject({
    method: "POST",
    url: `/v1/offers/drafts/${draft.draftId}/decision`,
    headers,
    payload: { decision: "approved", revision: 1, variantId: draft.variantSet[0]!.variantId }
  });
  const approvedOfferId = decisionResponse.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;
  const handoffResponse = await app.inject({
    method: "POST",
    url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
    headers,
    payload: {}
  });
  return {
    caseId,
    approvedOfferId,
    handoff: handoffResponse.json<{ handoff: { handoffId: string; approvalRequestId: string; approvedOfferId: string } }>().handoff
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
      const persisted = await persistApprovedHandoff(app);
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
});
