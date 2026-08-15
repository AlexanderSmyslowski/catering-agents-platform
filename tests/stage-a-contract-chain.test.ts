import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AuditLogStore,
  createEventRequestFromText,
  createOfferDraft,
  internalRecipes,
  type ProductionHandoff,
  validateOfferDraft
} from "@catering/shared-core";
import { buildOfferApp } from "@catering/offer-service";
import { OfferStore } from "../offer-service/src/store.js";
import { buildProductionApp } from "@catering/production-service";
import { InMemoryRecipeRepository } from "@catering/production-service";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import { buildPrintExportApp } from "@catering/print-export";
import { buildIntakeApp, IntakeStore } from "@catering/intake-service";

const secret = "stage-a-contract-chain-secret";
const headers = {
  "x-catering-trusted-secret": secret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "alpha"
};
const productionHeaders = {
  ...headers,
  "x-catering-actor-name": "Produktions-Mitarbeiter"
};
const roots: string[] = [];

function root(): string {
  const value = mkdtempSync(path.join(tmpdir(), "catering-stage-a-chain-"));
  roots.push(value);
  return value;
}

function ok<T>(response: { statusCode: number; body: string; json: () => unknown }): T {
  expect(response.statusCode, response.body).toBeGreaterThanOrEqual(200);
  expect(response.statusCode, response.body).toBeLessThan(300);
  return response.json() as T;
}

function offerServiceFetch(
  offerApp: { inject: (request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    payload?: string;
  }) => Promise<{ statusCode: number; body: string }> },
  calls: string[]
) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const response = await offerApp.inject({
      method: init?.method ?? "GET",
      url: `${url.pathname}${url.search}`,
      headers,
      payload: typeof init?.body === "string" ? init.body : undefined
    });
    return new Response(response.body, {
      status: response.statusCode,
      headers: { "content-type": "application/json" }
    });
  };
}

describe("Stage A trusted offer-to-production chain", () => {
  afterEach(() => {
    for (const dataRoot of roots.splice(0)) rmSync(dataRoot, { recursive: true, force: true });
  });

  it("keeps the approved offer immutable while producing plan, recipes, purchasing and folder output", async () => {
    const dataRoot = root();
    const offerStore = new OfferStore({ rootDir: dataRoot });
    const offerApp = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      auditLog: new AuditLogStore({ rootDir: dataRoot }),
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });

    const createdCase = ok<{ case: { caseId: string } }>(await offerApp.inject({
      method: "POST",
      url: "/v1/offers/cases",
      headers,
      payload: {
        customerName: "Stage A Fixture",
        eventTypeLabel: "Besprechung",
        eventDate: "2026-06-14",
        attendeeCount: 45
      }
    })).case;
    const eventRequest = createEventRequestFromText({
      requestId: "stage-a-chain-request",
      channel: "text",
      rawText: "menu: Caesar Salad Buffet. Fuer 45 Personen am 2026-06-14."
    });
    const baseDraft = createOfferDraft(eventRequest);
    const draft = validateOfferDraft({
      ...baseDraft,
      businessId: "alpha",
      variantSet: baseDraft.variantSet.map((variant) => ({
        ...variant,
        proposedEventSpec: {
          ...variant.proposedEventSpec,
          menuPlan: variant.proposedEventSpec.menuPlan.map((component) => ({
            ...component,
            menuCategory: "classic",
            recipeOverrideId: internalRecipes[1]!.recipeId,
            productionDecision: { mode: "scratch", notes: "Freigegebene Küchenherstellung." }
          }))
        }
      })),
      reviewStatus: {
        priceReviewStatus: "verified",
        taxReviewStatus: "verified",
        allergenReviewStatus: "verified",
        hygieneTemperatureReviewStatus: "verified",
        sourceSecured: true,
        publishApproved: true
      }
    });
    await offerStore.saveDraftForCase({ businessId: "alpha" }, createdCase.caseId, draft);
    const approved = ok<{ approvedOffer: { approvedOfferId: string } }>(await offerApp.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers,
      payload: { decision: "approved", revision: draft.revision, variantId: draft.variantSet[0]!.variantId }
    }));
    const handoff = ok<{ handoff: ProductionHandoff }>(await offerApp.inject({
      method: "POST",
      url: `/v1/offers/approved/${approved.approvedOffer.approvedOfferId}/handoffs`,
      headers,
      payload: {}
    })).handoff;
    const handoffReaderCalls: string[] = [];
    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    await repository.seed({ businessId: "alpha" }, internalRecipes);
    const handoffReader = new HttpProductionHandoffReader({
      offerServiceUrl: "http://offer-service.test",
      trustedServiceSecret: secret,
      fetch: offerServiceFetch(offerApp, handoffReaderCalls)
    });
    const productionApp = buildProductionApp({
      dataRoot,
      repository,
      store: new ProductionStore({ rootDir: dataRoot }),
      intakeRecords: new InMemoryIntakeRecordsPort(),
      handoffReader,
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const intakeApp = buildIntakeApp({
      rootDir: dataRoot,
      store: new IntakeStore({ rootDir: dataRoot }),
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const exportApp = buildPrintExportApp({
      rootDir: dataRoot,
      trustedActorSecret: secret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "alpha", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });

    try {
      const productionCase = ok<{ case: { caseId: string; productionHandoffId: string } }>(await productionApp.inject({
        method: "POST",
        url: `/v1/production/cases/from-handoff/${handoff.handoffId}`,
        headers: productionHeaders,
        payload: {}
      })).case;
      expect(handoffReaderCalls).toContain(`GET /v1/offers/handoffs/${handoff.handoffId}`);
      expect((await new AuditLogStore({ rootDir: dataRoot }).listRecentFor({ businessId: "alpha" }))
        .some((entry) => entry.action === "offer.production_handoff_created" && entry.entityId === handoff.handoffId)).toBe(true);
      expect(productionCase.productionHandoffId).toBe(handoff.handoffId);
      const imported = ok<{ draft: { draftId: string } }>(await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
        headers: productionHeaders,
        payload: { caseId: productionCase.caseId }
      }));
      expect(handoffReaderCalls.filter((call) => call === `GET /v1/offers/handoffs/${handoff.handoffId}`)).toHaveLength(2);
      expect((await new AuditLogStore({ rootDir: dataRoot }).listRecentFor({ businessId: "alpha" }))
        .some((entry) => entry.action === "production.draft_created_from_handoff" && entry.entityId === imported.draft.draftId)).toBe(true);
      const prepared = ok<{ draft: { draftId: string; reviewCards: Array<{ cardId: string }> } }>(await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${imported.draft.draftId}/prepare`,
        headers: productionHeaders,
        payload: {}
      }));
      for (const card of prepared.draft.reviewCards) {
        expect((await productionApp.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${prepared.draft.draftId}/review-cards/${card.cardId}`,
          headers: productionHeaders,
          payload: { decision: "fits" }
        })).statusCode).toBe(200);
      }
      const decision = ok<{ approvedProductionSpec: { approvedProductionSpecId: string } }>(await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${prepared.draft.draftId}/decision`,
        headers: productionHeaders,
        payload: { decision: "approved" }
      }));
      const applied = ok<{ plan: { planId: string }; purchaseList: { purchaseListId: string }; recipes: unknown[] }>(await productionApp.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${decision.approvedProductionSpec.approvedProductionSpecId}/apply`,
        headers: productionHeaders,
        payload: {}
      }));
      expect(applied.plan.planId).toBeTruthy();
      expect(applied.purchaseList.purchaseListId).toBeTruthy();
      expect(applied.recipes.length).toBeGreaterThan(0);

      await new IntakeStore({ rootDir: dataRoot }).saveSpec(
        { businessId: "alpha" },
        handoff.eventSpecSnapshot
      );
      const exportResponse = await exportApp.inject({
        method: "GET",
        url: `/v1/exports/production-folders/${applied.plan.planId}/html`,
        headers: productionHeaders
      });
      expect(exportResponse.statusCode, exportResponse.body).toBe(200);
      expect(exportResponse.body).toContain("Produktionsmappe");
      expect(exportResponse.body).toContain("Caesar Salad");
      const persistedSpec = await intakeApp.inject({
        method: "GET",
        url: "/v1/intake/specs",
        headers: { ...headers, "x-catering-actor-name": "Intake-Mitarbeiter" }
      });
      expect(persistedSpec.statusCode).toBe(200);
    } finally {
      await Promise.all([offerApp.close(), productionApp.close(), intakeApp.close(), exportApp.close()]);
    }
  });
});
