import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProductionApp, ProductionStore, type ProductionFeedbackDraft } from "@catering/production-service";
import { AuditLogStore } from "@catering/shared-core";

const TRUSTED_SECRET = "production-feedback-knowledge-secret";
const localBusiness = { businessId: "local" } as const;
const trustedProductionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-production-feedback-"));
}

function feedbackPayload(summary = "Mengen passten in der Produktion.") {
  return {
    target: {
      specId: "spec-feedback-1",
      planId: "plan-feedback-1",
      componentId: "component-feedback-1"
    },
    feedback: {
      summary,
      observations: ["Ausgabe lief ruhig."],
      changeRequests: ["Beim nächsten Lauf mehr Reserve einplanen."]
    }
  };
}

async function createFeedbackDraft(
  app: ReturnType<typeof buildProductionApp>,
  payload = feedbackPayload()
): Promise<ProductionFeedbackDraft> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/production/feedback-drafts",
    headers: trustedProductionHeaders,
    payload
  });

  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ draft: ProductionFeedbackDraft }>().draft;
}

async function listReviewedKnowledge(
  app: ReturnType<typeof buildProductionApp>
): Promise<ProductionFeedbackDraft[]> {
  const response = await app.inject({
    method: "GET",
    url: "/v1/production/knowledge/production-feedback",
    headers: trustedProductionHeaders
  });

  expect(response.statusCode, response.body).toBe(200);
  return response.json<{ items: ProductionFeedbackDraft[] }>().items;
}

describe("production feedback knowledge", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("keeps pending and rejected production feedback out of the reviewed knowledge view", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const auditLog = new AuditLogStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });

    try {
      const pendingDraft = await createFeedbackDraft(app);
      expect(pendingDraft).toMatchObject({
        status: "pending_review",
        createdBy: {
          name: "Produktions-Mitarbeiter"
        },
        guardrails: {
          draftOnly: true,
          humanApprovalRequired: true,
          rawProviderPayloadStored: false,
          knowledgeWritePolicy: "reviewed_only"
        }
      });
      expect(await listReviewedKnowledge(app)).toEqual([]);

      const rejected = await app.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${pendingDraft.feedbackId}/decision`,
        headers: trustedProductionHeaders,
        payload: { approve: false }
      });
      expect(rejected.statusCode, rejected.body).toBe(200);
      expect(rejected.json<{ draft: ProductionFeedbackDraft }>().draft.status).toBe("rejected");
      expect(await listReviewedKnowledge(app)).toEqual([]);

      const approvedDraft = await createFeedbackDraft(app, feedbackPayload("Gästefluss passte nach Umbau."));
      const approved = await app.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${approvedDraft.feedbackId}/decision`,
        headers: trustedProductionHeaders,
        payload: { approve: true }
      });
      expect(approved.statusCode, approved.body).toBe(200);
      expect(approved.json<{ draft: ProductionFeedbackDraft }>().draft).toMatchObject({
        status: "approved",
        approvedBy: {
          name: "Produktions-Mitarbeiter"
        }
      });

      const knowledge = await listReviewedKnowledge(app);
      const auditJson = JSON.stringify(await auditLog.listRecentFor({ businessId: "local" }, 20));
      expect(knowledge).toHaveLength(1);
      expect(knowledge[0]).toMatchObject({
        feedbackId: approvedDraft.feedbackId,
        status: "approved",
        feedback: {
          summary: "Gästefluss passte nach Umbau."
        }
      });
      expect(await store.listProductionFeedbackDrafts(localBusiness)).toHaveLength(2);
      expect(await store.listReviewedProductionFeedbackKnowledge(localBusiness)).toHaveLength(1);
      expect(auditJson).not.toContain("Mengen passten in der Produktion.");
      expect(auditJson).not.toContain("Gästefluss passte nach Umbau.");
    } finally {
      await app.close();
    }
  });

  it("requires operator approval context and ignores client supplied decision provenance", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });

    try {
      const draft = await createFeedbackDraft(app);
      const forbidden = await app.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${draft.feedbackId}/decision`,
        payload: { approve: true }
      });
      expect(forbidden.statusCode).toBe(403);
      expect((await store.getProductionFeedbackDraft(localBusiness, draft.feedbackId))?.status).toBe("pending_review");
      expect(await store.listReviewedProductionFeedbackKnowledge(localBusiness)).toEqual([]);

      const approved = await app.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${draft.feedbackId}/decision`,
        headers: trustedProductionHeaders,
        payload: {
          approve: true,
          approvedBy: {
            name: "Client Spoof",
            source: "untrusted"
          },
          approvedAt: "1999-01-01T00:00:00.000Z"
        }
      });
      const approvedDraft = approved.json<{ draft: ProductionFeedbackDraft }>().draft;

      expect(approved.statusCode, approved.body).toBe(200);
      expect(approvedDraft.approvedBy).toMatchObject({
        name: "Produktions-Mitarbeiter"
      });
      expect(approvedDraft.approvedAt).toMatch(/^20/);
      expect(approvedDraft.approvedAt).not.toBe("1999-01-01T00:00:00.000Z");
    } finally {
      await app.close();
    }
  });

  it("rejects forbidden raw payload keys and oversized feedback without persisting drafts", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });

    try {
      const forbidden = await app.inject({
        method: "POST",
        url: "/v1/production/feedback-drafts",
        headers: trustedProductionHeaders,
        payload: {
          ...feedbackPayload(),
          feedback: {
            ...feedbackPayload().feedback,
            prompt: "SECRET_RAW_PROMPT"
          }
        }
      });
      expect(forbidden.statusCode).toBe(422);
      expect(forbidden.body).toContain("nicht erlaubt");
      expect(forbidden.body).not.toContain("SECRET_RAW_PROMPT");

      const oversized = await app.inject({
        method: "POST",
        url: "/v1/production/feedback-drafts",
        headers: trustedProductionHeaders,
        payload: feedbackPayload("x".repeat(1001))
      });
      expect(oversized.statusCode).toBe(422);
      expect(oversized.body).toContain("maximal 1000 Zeichen");

      expect(await store.listProductionFeedbackDrafts(localBusiness)).toEqual([]);
      expect(await store.listReviewedProductionFeedbackKnowledge(localBusiness)).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
