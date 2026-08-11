import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProductionApp, ProductionStore } from "@catering/production-service";
import {
  AuditLogStore,
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type ProductionDraft,
  type ProductionDraftReviewCard
} from "@catering/shared-core";

const TRUSTED_SECRET = "production-draft-review-secret";
const localBusiness = { businessId: "local" };
const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-production-draft-review-"));
}

function reviewCard(
  cardId: string,
  kind: ProductionDraftReviewCard["kind"],
  riskLevel?: ProductionDraftReviewCard["riskLevel"]
): ProductionDraftReviewCard {
  return {
    cardId,
    kind,
    title: `SECRET_TITLE_${cardId}`,
    summary: `SECRET_SUMMARY_${cardId}`,
    decision: "pending",
    targetPath: "$.draftArtifacts.eventSpec",
    targetId: `target-${cardId}`,
    riskLevel,
    requiredApproval: true
  };
}

function productionDraft(
  draftId = "production-draft-review-1",
  reviewCards: ProductionDraftReviewCard[] = [
    reviewCard("card-event", "event_data"),
    reviewCard("card-risk", "risk", "medium")
  ]
): ProductionDraft {
  const eventSpec = normalizeEventRequestToSpec(
    createEventRequestFromText({
      requestId: `${draftId}-request`,
      channel: "text",
      rawText: "Buffet am 2026-09-18 fuer 45 Personen mit Vitello tonnato."
    })
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    businessId: "local",
    draftId,
    revision: 1,
    status: "pending_review",
    createdAt: "2026-07-01T12:00:00.000Z",
    source: {
      kind: "agent_cli",
      receivedAt: "2026-07-01T12:00:00.000Z",
      sourceRef: "upload:angebot-koepff.pdf",
      providerId: "local-codex-cli",
      modelId: "operator-selected-model",
      inputHash: "sha256:input-redacted",
      outputHash: "sha256:output-structured",
      runId: `run-${draftId}`
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [
      ...reviewCards,
      {
        ...reviewCard("card-plan-coverage", "timeline"),
        targetPath: "$.draftArtifacts.productionPlan",
        targetId: `${draftId}-plan`,
        requiredApproval: false
      },
      {
        ...reviewCard("card-purchase-coverage", "purchase_item"),
        targetPath: "$.draftArtifacts.purchaseList",
        targetId: `${draftId}-purchase-list`,
        requiredApproval: false
      }
    ],
    draftArtifacts: {
      eventSpec,
      productionPlan: {
        schemaVersion: SCHEMA_VERSION,
        planId: `${draftId}-plan`,
        eventSpecId: eventSpec.specId,
        readiness: { status: "complete", reasons: [] },
        productionBatches: [],
        timeline: [],
        kitchenSheets: [],
        recipeSelections: [],
        unresolvedItems: []
      },
      purchaseList: {
        schemaVersion: SCHEMA_VERSION,
        purchaseListId: `${draftId}-purchase-list`,
        eventSpecId: eventSpec.specId,
        items: [],
        groupingMode: "group",
        totals: { itemCount: 0, groups: [] }
      },
      recipes: [],
      openQuestions: [
        {
          field: "recipe.temperature",
          message: "Kerntemperatur offen.",
          severity: "medium",
          suggestedQuestion: "Welche Kerntemperatur soll fachlich freigegeben werden?"
        }
      ],
      notes: ["SECRET_DRAFT_NOTE bleibt nur im gespeicherten Draft."]
    }
  };
}

async function importDraft(
  app: ReturnType<typeof buildProductionApp>,
  draft: ProductionDraft
): Promise<ProductionDraft> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/production/drafts",
    headers: trustedProductionHeaders,
    payload: draft
  });

  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ draft: ProductionDraft }>().draft;
}

async function decideCard(
  app: ReturnType<typeof buildProductionApp>,
  draftId: string,
  cardId: string,
  decision = "fits"
): Promise<ProductionDraft> {
  const response = await app.inject({
    method: "PATCH",
    url: `/v1/production/drafts/${draftId}/review-cards/${cardId}`,
    headers: trustedProductionHeaders,
    payload: {
      decision,
      operatorComment: "SECRET_OPERATOR_COMMENT"
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json<{ draft: ProductionDraft }>().draft;
}

describe("ProductionDraft review state", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("decides individual review cards without leaking review text into audit details", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      await importDraft(app, productionDraft());
      const response = await app.inject({
        method: "PATCH",
        url: "/v1/production/drafts/production-draft-review-1/review-cards/card-event",
        headers: trustedProductionHeaders,
        payload: {
          decision: "change_requested",
          operatorComment: "SECRET_OPERATOR_COMMENT"
        }
      });
      const draft = response.json<{ draft: ProductionDraft }>().draft;
      const card = draft.reviewCards.find((item) => item.cardId === "card-event");
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 5));

      expect(response.statusCode).toBe(200);
      expect(card).toMatchObject({
        decision: "change_requested",
        decidedBy: "Produktions-Mitarbeiter",
        operatorComment: "SECRET_OPERATOR_COMMENT"
      });
      expect(card?.decidedAt).toMatch(/^20/);
      expect(auditJson).toContain("production.production_draft_review_card_decided");
      expect(auditJson).toContain("card-event");
      expect(auditJson).not.toContain("SECRET_TITLE_card-event");
      expect(auditJson).not.toContain("SECRET_SUMMARY_card-event");
      expect(auditJson).not.toContain("SECRET_OPERATOR_COMMENT");
      expect(auditJson).not.toContain("SECRET_DRAFT_NOTE");
    } finally {
      await app.close();
    }
  });

  it("uses server actor provenance instead of client-supplied review metadata", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      await importDraft(app, productionDraft());
      const response = await app.inject({
        method: "PATCH",
        url: "/v1/production/drafts/production-draft-review-1/review-cards/card-event",
        headers: trustedProductionHeaders,
        payload: {
          decision: "unclear",
          decidedBy: "Client Spoof",
          decidedAt: "1999-01-01T00:00:00.000Z"
        }
      });
      const card = response.json<{ reviewCard: ProductionDraftReviewCard }>().reviewCard;
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 5));

      expect(response.statusCode).toBe(200);
      expect(card.decision).toBe("unclear");
      expect(card.decidedBy).toBe("Produktions-Mitarbeiter");
      expect(card.decidedAt).toMatch(/^20/);
      expect(card.decidedAt).not.toBe("1999-01-01T00:00:00.000Z");
      expect(auditJson).not.toContain("Client Spoof");
    } finally {
      await app.close();
    }
  });

  it("approves a draft only after all cards fit and does not write production objects", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      await importDraft(app, productionDraft());
      await decideCard(app, "production-draft-review-1", "card-event");
      await decideCard(app, "production-draft-review-1", "card-risk");
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/production-draft-review-1/decision",
        headers: trustedProductionHeaders,
        payload: { decision: "approved" }
      });
      const body = response.json<{
        approval: { approvalRequestId: string; decision: string };
        approvedProductionSpec: { approvedProductionSpecId: string };
      }>();
      const draft = await store.getProductionDraft(localBusiness, "production-draft-review-1");
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 10));

      expect(response.statusCode).toBe(201);
      expect(body.approval.decision).toBe("approved");
      expect(body.approvedProductionSpec.approvedProductionSpecId).toMatch(/^approved-production-spec-/);
      expect(draft).toMatchObject({
        status: "approved",
        approvedBy: "Produktions-Mitarbeiter",
        approvalRequestId: body.approval.approvalRequestId
      });
      expect(draft?.approvedAt).toMatch(/^20/);
      expect(await store.listPlans(localBusiness)).toHaveLength(0);
      expect(await store.listPurchaseLists(localBusiness)).toHaveLength(0);
      expect(auditJson).toContain("production.production_spec_approved");
      expect(auditJson).toContain('"writesProductObject":false');
      expect(auditJson).not.toContain("SECRET_TITLE_card-event");
      expect(auditJson).not.toContain("SECRET_DRAFT_NOTE");
    } finally {
      await app.close();
    }
  });

  it("blocks approval while a blocking review card is open and permits it once the card fits", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const blockingDraft = productionDraft("production-draft-blocking", [
      reviewCard("card-blocking", "risk", "blocking")
    ]);
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      await importDraft(app, blockingDraft);
      const openResponse = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/production-draft-blocking/decision",
        headers: trustedProductionHeaders,
        payload: { decision: "approved" }
      });

      expect(openResponse.statusCode).toBe(422);
      expect(openResponse.body).toContain("reviewCard card-blocking is pending");

      await decideCard(app, "production-draft-blocking", "card-blocking");
      const blockingResponse = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/production-draft-blocking/decision",
        headers: trustedProductionHeaders,
        payload: { decision: "approved" }
      });

      expect(blockingResponse.statusCode).toBe(201);
      expect((await store.getProductionDraft(localBusiness, "production-draft-blocking"))?.status).toBe("approved");
    } finally {
      await app.close();
    }
  });

  it("rejects a pending draft without requiring all review cards to fit and locks later edits", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const app = buildProductionApp({
      dataRoot,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      await importDraft(app, productionDraft());
      const decisionResponse = await app.inject({
        method: "POST",
        url: "/v1/production/drafts/production-draft-review-1/decision",
        headers: trustedProductionHeaders,
        payload: { decision: "rejected" }
      });
      const editResponse = await app.inject({
        method: "PATCH",
        url: "/v1/production/drafts/production-draft-review-1/review-cards/card-event",
        headers: trustedProductionHeaders,
        payload: { decision: "fits" }
      });

      expect(decisionResponse.statusCode).toBe(201);
      expect(decisionResponse.json<{ approval: { decision: string } }>().approval.decision).toBe("rejected");
      expect((await new ProductionStore({ rootDir: dataRoot }).getProductionDraft(
        localBusiness,
        "production-draft-review-1"
      ))?.status).toBe("rejected");
      expect(editResponse.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });
});
