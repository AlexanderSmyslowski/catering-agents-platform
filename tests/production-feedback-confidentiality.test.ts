import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProductionApp } from "../production-service/src/app.js";
import {
  ProductionStore,
  type ProductionFeedbackDraft
} from "../production-service/src/repositories/production-store.js";

const TRUSTED_SECRET = "production-feedback-confidentiality-secret";
const localBusiness = { businessId: "local" } as const;
const commercialSentinel = "production-feedback-commercial-sentinel-964874f0";
const productionHeaders = {
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-trusted-secret": TRUSTED_SECRET
};
const adminHeaders = {
  "x-catering-actor-name": "Administrator",
  "x-catering-trusted-secret": TRUSTED_SECRET
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-production-feedback-confidentiality-"));
}

function commercialFeedbackPayload() {
  return {
    target: { specId: "spec-feedback-commercial-boundary" },
    feedback: {
      summary: `Kommerzielle Rückmeldung ${commercialSentinel}`,
      observations: [`Beobachtung ${commercialSentinel}`],
      changeRequests: [`Änderungswunsch ${commercialSentinel}`]
    }
  };
}

function operationalFeedbackPayload() {
  return {
    target: { specId: "spec-feedback-operational-boundary" },
    feedback: {
      summary: "Produktionsablauf für das Mittagsbuffet war stabil.",
      observations: ["Die Ausgabe startete pünktlich."],
      changeRequests: ["Für die nächste Ausgabe mehr Warmhaltebehälter bereitlegen."]
    }
  };
}

function unknownApprovedFeedbackDraft(): ProductionFeedbackDraft {
  return {
    feedbackId: "production-feedback-unknown-creator-boundary",
    status: "approved",
    createdAt: "2026-08-27T10:00:00.000Z",
    updatedAt: "2026-08-27T10:01:00.000Z",
    createdBy: {
      name: "Unbekannter Produktionskontakt",
      source: "trusted-proxy:x-catering-actor-name"
    },
    target: { specId: "spec-feedback-unknown-creator" },
    feedback: commercialFeedbackPayload().feedback,
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    approvedBy: {
      name: "Administrator",
      source: "trusted-proxy:x-catering-actor-name"
    },
    approvedAt: "2026-08-27T10:01:00.000Z"
  };
}

async function createFeedbackDraft(
  app: ReturnType<typeof buildProductionApp>,
  headers: Record<string, string>,
  payload: ReturnType<typeof commercialFeedbackPayload> | ReturnType<typeof operationalFeedbackPayload>
): Promise<{ response: Awaited<ReturnType<typeof app.inject>>; draft: ProductionFeedbackDraft }> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/production/feedback-drafts",
    headers,
    payload
  });

  expect(response.statusCode, response.body).toBe(201);
  return {
    response,
    draft: response.json<{ draft: ProductionFeedbackDraft }>().draft
  };
}

describe("ProductionFeedback-Vertraulichkeit", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [dataRoot], { stdio: "ignore" });
      } catch {
        // Ein fehlender Löschzugriff darf weder den Testfehler verbergen noch einen Repo-Pfad betreffen.
      }
    }
  });

  it("blendet kommerzielles freigegebenes Feedback für nichtkommerzielle Produktionsrollen aus", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local" }
    });

    try {
      const commercialPayload = commercialFeedbackPayload();
      const commercialCreated = await createFeedbackDraft(app, adminHeaders, commercialPayload);
      expect(commercialCreated.response.body).toContain(commercialSentinel);
      expect(commercialCreated.draft.createdBy).toMatchObject({ name: "Administrator" });

      const commercialApproved = await app.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${commercialCreated.draft.feedbackId}/decision`,
        headers: adminHeaders,
        payload: { approve: true }
      });
      expect(commercialApproved.statusCode, commercialApproved.body).toBe(200);
      expect(commercialApproved.body).toContain(commercialSentinel);
      expect(await store.getProductionFeedbackDraft(localBusiness, commercialCreated.draft.feedbackId))
        .toMatchObject({
          status: "approved",
          feedback: commercialPayload.feedback,
          approvedBy: { name: "Administrator" }
        });

      const productionKnowledgeBeforeOwnFeedback = await app.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: productionHeaders
      });
      expect(productionKnowledgeBeforeOwnFeedback.statusCode, productionKnowledgeBeforeOwnFeedback.body).toBe(200);
      expect(productionKnowledgeBeforeOwnFeedback.body).not.toContain(commercialSentinel);
      expect(productionKnowledgeBeforeOwnFeedback.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual([]);

      const adminKnowledge = await app.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: adminHeaders
      });
      expect(adminKnowledge.statusCode, adminKnowledge.body).toBe(200);
      expect(adminKnowledge.body).toContain(commercialSentinel);
      expect(adminKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          feedbackId: commercialCreated.draft.feedbackId,
          feedback: commercialPayload.feedback
        })
      ]));
    } finally {
      await app.close();
    }
  });

  it("verweigert Entscheidungen über kommerzielles Fremdfeedback und lässt eigenes Betriebsfeedback zu", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local" }
    });

    try {
      const commercialPending = await createFeedbackDraft(app, adminHeaders, commercialFeedbackPayload());
      const persistedPending = await store.getProductionFeedbackDraft(
        localBusiness,
        commercialPending.draft.feedbackId
      );
      const forbiddenDecision = await app.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${commercialPending.draft.feedbackId}/decision`,
        headers: productionHeaders,
        payload: { approve: false }
      });
      expect(forbiddenDecision.statusCode, forbiddenDecision.body).toBe(403);
      expect(forbiddenDecision.body).not.toContain(commercialSentinel);
      expect(await store.getProductionFeedbackDraft(localBusiness, commercialPending.draft.feedbackId))
        .toEqual(persistedPending);

      const operationalPayload = operationalFeedbackPayload();
      const operationalCreated = await createFeedbackDraft(app, productionHeaders, operationalPayload);
      expect(operationalCreated.response.json<{ draft: ProductionFeedbackDraft }>().draft.feedback)
        .toEqual(operationalPayload.feedback);

      const operationalApproved = await app.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${operationalCreated.draft.feedbackId}/decision`,
        headers: productionHeaders,
        payload: { approve: true }
      });
      expect(operationalApproved.statusCode, operationalApproved.body).toBe(200);
      expect(operationalApproved.json<{ draft: ProductionFeedbackDraft }>().draft).toMatchObject({
        status: "approved",
        feedback: operationalPayload.feedback,
        approvedBy: { name: "Produktions-Mitarbeiter" }
      });

      const productionKnowledge = await app.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: productionHeaders
      });
      expect(productionKnowledge.statusCode, productionKnowledge.body).toBe(200);
      const productionItems = productionKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items;
      expect(productionItems).toHaveLength(1);
      expect(productionItems[0]).toMatchObject({
        feedbackId: operationalCreated.draft.feedbackId,
        feedback: operationalPayload.feedback
      });
      expect(productionKnowledge.body).not.toContain(commercialSentinel);
    } finally {
      await app.close();
    }
  });

  it("schließt unbekannte Ersteller-Provenienz für nichtkommerzielle Leser fail-closed aus", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const app = buildProductionApp({
      dataRoot,
      store,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local" }
    });
    const unknownDraft = unknownApprovedFeedbackDraft();
    await store.saveProductionFeedbackDraft(localBusiness, unknownDraft);

    try {
      const productionKnowledge = await app.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: productionHeaders
      });
      expect(productionKnowledge.statusCode, productionKnowledge.body).toBe(200);
      expect(productionKnowledge.body).not.toContain(commercialSentinel);
      expect(productionKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual([]);

      const adminKnowledge = await app.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: adminHeaders
      });
      expect(adminKnowledge.statusCode, adminKnowledge.body).toBe(200);
      expect(adminKnowledge.body).toContain(commercialSentinel);
    } finally {
      await app.close();
    }
  });
});
