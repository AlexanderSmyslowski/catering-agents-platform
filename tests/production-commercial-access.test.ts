import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { InMemoryRecipeRepository } from "../production-service/src/repositories/in-memory-recipe-repository.js";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";
import { projectProductionDraft } from "../production-service/src/routes/production-response-projection.js";
import { internalRecipes } from "../shared-core/src/fixtures/sample-data.js";
import { trustedActorFromHeaders, type TrustedActor } from "../shared-core/src/access-control.js";
import type { BusinessContext } from "../shared-core/src/business-context.js";
import type { CaseSourceRef } from "../shared-core/src/case-contracts.js";
import type { OfferDraft, PricingSummary, ProductionDraft } from "../shared-core/src/types.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import { AuditLogStore } from "../shared-core/src/audit-log.js";

const TRUSTED_SECRET = "gate-b-production-commercial-secret";

const headersFor = (actorName: string) => ({
  "x-catering-trusted-secret": TRUSTED_SECRET,
  "x-catering-actor-name": actorName,
  "x-catering-business-id": "local"
});

const offerHeaders = headersFor("Angebots-Mitarbeiter");
const productionHeaders = headersFor("Produktions-Mitarbeiter");
const adminHeaders = headersFor("Administrator");
const serviceHeaders = headersFor("Production-Service");

type InjectableApp = {
  inject: (request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    payload?: unknown;
  }) => Promise<{
    statusCode: number;
    body: string;
    json: <T>() => T;
  }>;
  close: () => Promise<void>;
};

function commercialSentinelSummary(summary: PricingSummary): PricingSummary {
  return {
    ...structuredClone(summary),
    subtotal: {
      ...summary.subtotal,
      amount: 9876.54
    },
    notes: [...(summary.notes ?? []), "COMMERCIAL_SENTINEL"]
  };
}

function commercialSentinelDraft(draft: OfferDraft): OfferDraft {
  const summary = commercialSentinelSummary(draft.pricingSummary);
  const proposedEventSpec = {
    ...structuredClone(draft.proposedEventSpec),
    budgetContext: {
      ...(draft.proposedEventSpec.budgetContext ?? {}),
      pricingSummary: structuredClone(summary)
    }
  };
  return {
    ...structuredClone(draft),
    pricingSummary: structuredClone(summary),
    proposedEventSpec,
    variantSet: draft.variantSet.map((variant, index) => index === 0
      ? {
          ...structuredClone(variant),
          estimatedPrice: { ...variant.estimatedPrice, amount: 9876.54 },
          proposedEventSpec: {
            ...structuredClone(variant.proposedEventSpec),
            budgetContext: {
              ...(variant.proposedEventSpec.budgetContext ?? {}),
              pricingSummary: structuredClone(summary)
            }
          }
        }
      : structuredClone(variant))
  };
}

class CommercialSentinelOfferStore extends OfferStore {
  override async saveDraftForCase(
    context: BusinessContext,
    caseId: string,
    draft: OfferDraft,
    sourceRefs: readonly CaseSourceRef[] = []
  ): Promise<"saved" | "case_conflict"> {
    return super.saveDraftForCase(context, caseId, commercialSentinelDraft(draft), sourceRefs);
  }
}

function createDataRoot(): string {
  return mkdtempSync(path.join("/private/tmp", "catering-gate-b-production-commercial-"));
}

function expectStatus(response: { statusCode: number; body: string }, expected: number): void {
  expect(response.statusCode, response.body).toBe(expected);
}

function offerServiceFetch(offerApp: InjectableApp) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
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

function actorFromHeaders(headers: Record<string, string>): TrustedActor {
  return trustedActorFromHeaders(headers, {
    fallbackActorName: "Produktions-Mitarbeiter",
    fallbackBusinessId: "local",
    trustedActorSecret: TRUSTED_SECRET
  });
}

function commercialKeyPaths(value: unknown, pathPrefix = "$"): string[] {
  const keys = new Set([
    "pricingSnapshot",
    "pricingSummary",
    "targetBudget",
    "estimatedPrice",
    "pricing",
    "maximumEstimatedCostEur",
    "policyMaximumEstimatedCostEur"
  ]);
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => commercialKeyPaths(entry, `${pathPrefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    keys.has(key)
      ? [`${pathPrefix}.${key}`]
      : commercialKeyPaths(nested, `${pathPrefix}.${key}`)
  );
}

function expectProductionCommercialsAbsent(value: unknown): void {
  expect(commercialKeyPaths(value)).toEqual([]);
  expect(JSON.stringify(value)).not.toContain("9876.54");
  expect(JSON.stringify(value)).not.toContain("COMMERCIAL_SENTINEL");
}

async function createCanonicalProduction() {
  const rootDir = createDataRoot();
  const offerStore = new CommercialSentinelOfferStore({ rootDir });
  const offerApp = buildOfferApp({ rootDir, store: offerStore, trustedActorSecret: TRUSTED_SECRET });
  const createdCase = await offerApp.inject({
    method: "POST",
    url: "/v1/offers/cases",
    headers: offerHeaders,
    payload: {
      customerName: "Pseudonymisierte Organisation",
      eventTypeLabel: "Business Lunch",
      eventDate: "2026-09-18",
      attendeeCount: 35
    }
  });
  expectStatus(createdCase, 201);
  const offerCaseId = createdCase.json<{ case: { caseId: string } }>().case.caseId;

  const createdDraft = await offerApp.inject({
    method: "POST",
    url: "/v1/offers/from-text",
    headers: offerHeaders,
    payload: {
      caseId: offerCaseId,
      text: "Business Lunch am 2026-09-18 fuer 35 Personen mit Caesar Salad Buffet."
    }
  });
  expectStatus(createdDraft, 201);
  const draft = createdDraft.json<{
    draftId: string;
    variantSet: Array<{ variantId: string; proposedEventSpec: { budgetContext?: unknown } }>;
  }>();
  const selectedVariant = draft.variantSet[0];
  expect(selectedVariant).toBeDefined();
  expect(selectedVariant?.proposedEventSpec.budgetContext).toBeDefined();

  const approved = await offerApp.inject({
    method: "POST",
    url: `/v1/offers/drafts/${draft.draftId}/decision`,
    headers: offerHeaders,
    payload: { decision: "approved", revision: 1, variantId: selectedVariant!.variantId }
  });
  expectStatus(approved, 201);
  const approvedOfferId = approved.json<{ approvedOffer: { approvedOfferId: string } }>().approvedOffer.approvedOfferId;

  const createdHandoff = await offerApp.inject({
    method: "POST",
    url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
    headers: offerHeaders,
    payload: {}
  });
  expectStatus(createdHandoff, 201);
  const createdHandoffId = createdHandoff.json<{ handoff: { handoffId: string } }>().handoff.handoffId;
  const handoff = await offerStore.getHandoff({ businessId: "local" }, createdHandoffId);
  expect(handoff).toBeDefined();
  expect(handoff?.pricingSnapshot.subtotal.amount).toBe(9876.54);
  expect(handoff?.pricingSnapshot.notes).toContain("COMMERCIAL_SENTINEL");
  const approvedOffer = await offerStore.getApprovedOffer({ businessId: "local" }, approvedOfferId);
  expect(approvedOffer).toBeDefined();
  expect(approvedOffer?.pricingSummary).toEqual(handoff?.pricingSnapshot);
  expect(approvedOffer?.selectedVariant.proposedEventSpec.budgetContext?.pricingSummary)
    .toEqual(handoff?.pricingSnapshot);

  const repository = new InMemoryRecipeRepository({ rootDir });
  await repository.seed({ businessId: "local" }, internalRecipes);
  const store = new ProductionStore({ rootDir });
  const productionApp = buildProductionApp({
    dataRoot: rootDir,
    repository,
    store,
    intakeRecords: new InMemoryIntakeRecordsPort(),
    handoffReader: new HttpProductionHandoffReader({
      offerServiceUrl: "http://offer-service.test",
      trustedServiceSecret: TRUSTED_SECRET,
      fetch: offerServiceFetch(offerApp)
    }),
    trustedActorSecret: TRUSTED_SECRET,
    env: { CATERING_ENABLE_WEB_RECIPE_SEARCH: "0" }
  });

  const productionCase = await productionApp.inject({
    method: "POST",
    url: `/v1/production/cases/from-handoff/${handoff!.handoffId}`,
    headers: productionHeaders,
    payload: {}
  });
  expectStatus(productionCase, 201);
  expectProductionCommercialsAbsent(productionCase.json());
  const caseId = productionCase.json<{ case: { caseId: string } }>().case.caseId;
  const productionDraft = await productionApp.inject({
    method: "POST",
    url: `/v1/production/drafts/from-handoff/${handoff!.handoffId}`,
    headers: productionHeaders,
    payload: { caseId }
  });
  expectStatus(productionDraft, 201);
  expectProductionCommercialsAbsent(productionDraft.json());
  const sourceDraft = productionDraft.json<{ draft: { draftId: string } }>().draft;

  const prepared = await productionApp.inject({
    method: "POST",
    url: `/v1/production/drafts/${sourceDraft.draftId}/prepare`,
    headers: productionHeaders,
    payload: {}
  });
  expectStatus(prepared, 201);
  const preparedDraft = prepared.json<{
    draft: {
      draftId: string;
      reviewCards: Array<{ cardId: string; kind: ProductionDraft["reviewCards"][number]["kind"] }>;
    };
  }>().draft;

  return {
    rootDir,
    offerApp,
    productionApp,
    store,
    caseId,
    handoff: handoff!,
    sourceDraft,
    preparedDraft,
    adminActor: actorFromHeaders(adminHeaders),
    serviceActor: actorFromHeaders(serviceHeaders)
  };
}

describe("Gate B Slice 2 production commercial confidentiality", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [root], { stdio: "ignore" });
      } catch {
        // The sandbox may deny Trash access; no repository path is removed.
      }
    }
  });

  it("denies production operators raw Offer-Handoff pricing while trusted readers retain access", async () => {
    const fixture = await createCanonicalProduction();
    roots.push(fixture.rootDir);
    try {
      const productionResponse = await fixture.offerApp.inject({
        method: "GET",
        url: `/v1/offers/handoffs/${fixture.handoff.handoffId}`,
        headers: productionHeaders
      });
      if (productionResponse.statusCode === 200) {
        expect(productionResponse.body).toContain("9876.54");
        expect(productionResponse.body).toContain("COMMERCIAL_SENTINEL");
      }
      expectStatus(productionResponse, 403);

      for (const headers of [offerHeaders, adminHeaders, serviceHeaders]) {
        const authorized = await fixture.offerApp.inject({
          method: "GET",
          url: `/v1/offers/handoffs/${fixture.handoff.handoffId}`,
          headers
        });
        expectStatus(authorized, 200);
        const authorizedHandoff = authorized.json<{
          handoff: { pricingSnapshot: { subtotal: { amount: number }; notes?: string[] } };
        }>().handoff;
        expect(authorizedHandoff.pricingSnapshot).toBeDefined();
        expect(authorizedHandoff.pricingSnapshot.subtotal.amount).toBe(9876.54);
        expect(authorizedHandoff.pricingSnapshot.notes).toContain("COMMERCIAL_SENTINEL");
      }
    } finally {
      await Promise.all([fixture.offerApp.close(), fixture.productionApp.close()]);
    }
  });

  it("keeps production actions available while omitting commercial fields from every response", async () => {
    const fixture = await createCanonicalProduction();
    roots.push(fixture.rootDir);
    try {
      const listed = await fixture.productionApp.inject({
        method: "GET",
        url: "/v1/production/drafts",
        headers: productionHeaders
      });
      expectStatus(listed, 200);
      expectProductionCommercialsAbsent(listed.json());

      const missingEventSpec = structuredClone(fixture.sourceDraft) as ProductionDraft;
      delete missingEventSpec.draftArtifacts.eventSpec;
      missingEventSpec.reviewCards[0] = {
        ...missingEventSpec.reviewCards[0]!,
        decision: "change_requested",
        operatorComment: "EVENT_SPEC_LESS_COMMERCIAL_REVIEW_SENTINEL",
        decidedBy: "Administrator",
        decidedAt: "2026-08-27T12:00:00.000Z"
      };
      missingEventSpec.source = {
        ...missingEventSpec.source,
        processingPolicy: { maximumEstimatedCostEur: 9876.54 } as ProductionDraft["source"]["processingPolicy"]
      };
      expectProductionCommercialsAbsent(
        projectProductionDraft(actorFromHeaders(productionHeaders), missingEventSpec)
      );
      expect(JSON.stringify(projectProductionDraft(
        actorFromHeaders(productionHeaders),
        missingEventSpec
      ))).not.toContain("EVENT_SPEC_LESS_COMMERCIAL_REVIEW_SENTINEL");

      expectProductionCommercialsAbsent(fixture.preparedDraft);

      for (const card of fixture.preparedDraft.reviewCards) {
        const reviewed = await fixture.productionApp.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${card.cardId}`,
          headers: productionHeaders,
          payload: { decision: "fits", operatorComment: "Produktionsprüfung ohne Preisrecht." }
        });
        expectStatus(reviewed, 200);
        expectProductionCommercialsAbsent(reviewed.json());
      }

      const decision = await fixture.productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/decision`,
        headers: productionHeaders,
        payload: { decision: "approved" }
      });
      expectStatus(decision, 201);
      expectProductionCommercialsAbsent(decision.json());
      const approvedProductionSpecId = decision.json<{ approvedProductionSpec: { approvedProductionSpecId: string } }>()
        .approvedProductionSpec.approvedProductionSpecId;

      const applied = await fixture.productionApp.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: productionHeaders,
        payload: {}
      });
      expectStatus(applied, 200);
      expectProductionCommercialsAbsent(applied.json());
      await expect(fixture.store.getApprovedProductionSpec(fixture.adminActor, approvedProductionSpecId)).resolves.toMatchObject({
        artifacts: {
          eventSpec: {
            budgetContext: {
              pricingSummary: {
                subtotal: { amount: 9876.54 },
                notes: expect.arrayContaining(["COMMERCIAL_SENTINEL"])
              }
            }
          }
        }
      });
    } finally {
      await Promise.all([fixture.offerApp.close(), fixture.productionApp.close()]);
    }
  });

  it("keeps an admin review comment canonical while redacting GET and decision-only PATCH responses for production", async () => {
    const fixture = await createCanonicalProduction();
    roots.push(fixture.rootDir);
    try {
      const card = fixture.preparedDraft.reviewCards[0]!;
      const sentinel = "COMMERCIAL_REVIEW_SENTINEL Verkaufspreis 9.876,54 EUR bei Marge 31 Prozent.";
      const adminReview = await fixture.productionApp.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${card.cardId}`,
        headers: adminHeaders,
        payload: {
          decision: "change_requested",
          operatorComment: sentinel,
          operatorCommentVisibility: "operational"
        }
      });
      expectStatus(adminReview, 200);
      expect(adminReview.body).toContain(sentinel);
      expect(adminReview.json<{ reviewCard: Record<string, unknown> }>().reviewCard)
        .toMatchObject({ operatorCommentVisibility: "commercial" });

      const persistedAfterAdmin = await fixture.store.getProductionDraft(
        fixture.adminActor,
        fixture.preparedDraft.draftId
      );
      expect(persistedAfterAdmin?.reviewCards[0]).toMatchObject({
        operatorComment: sentinel,
        operatorCommentVisibility: "commercial"
      });

      const productionRead = await fixture.productionApp.inject({
        method: "GET",
        url: `/v1/production/drafts?caseId=${fixture.caseId}`,
        headers: productionHeaders
      });
      expectStatus(productionRead, 200);
      expect(productionRead.body).not.toContain(sentinel);
      expect(productionRead.json<{ items: ProductionDraft[] }>().items
        .flatMap((draft) => draft.reviewCards)
        .find((item) => item.cardId === card.cardId)?.operatorComment).toBeUndefined();

      const identicalProductionRetry = await fixture.productionApp.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${card.cardId}`,
        headers: productionHeaders,
        payload: { decision: "change_requested", operatorComment: `  ${sentinel}  ` }
      });
      expectStatus(identicalProductionRetry, 200);
      expect(identicalProductionRetry.body).not.toContain(sentinel);
      expect(await fixture.store.getProductionDraft(fixture.adminActor, fixture.preparedDraft.draftId))
        .toMatchObject({
          reviewCards: expect.arrayContaining([
            expect.objectContaining({
              cardId: card.cardId,
              decidedBy: "Administrator",
              operatorComment: sentinel,
              operatorCommentVisibility: "commercial"
            })
          ])
        });

      const productionDecisionOnly = await fixture.productionApp.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${card.cardId}`,
        headers: productionHeaders,
        payload: { decision: "unclear" }
      });
      expectStatus(productionDecisionOnly, 200);
      expect(productionDecisionOnly.body).not.toContain(sentinel);
      expect(productionDecisionOnly.json<{ reviewCard: ProductionDraft["reviewCards"][number] }>()
        .reviewCard.operatorComment).toBeUndefined();

      const persistedAfterDecision = await fixture.store.getProductionDraft(
        fixture.adminActor,
        fixture.preparedDraft.draftId
      );
      expect(persistedAfterDecision?.reviewCards[0]).toMatchObject({
        decision: "unclear",
        decidedBy: "Produktions-Mitarbeiter",
        operatorComment: sentinel,
        operatorCommentVisibility: "commercial"
      });

      const adminRead = await fixture.productionApp.inject({
        method: "GET",
        url: `/v1/production/drafts?caseId=${fixture.caseId}`,
        headers: adminHeaders
      });
      expectStatus(adminRead, 200);
      expect(adminRead.body).toContain(sentinel);
    } finally {
      await Promise.all([fixture.offerApp.close(), fixture.productionApp.close()]);
    }
  });

  it("keeps an operational review comment visible and leaves historical unclassified comments fail-closed", async () => {
    const fixture = await createCanonicalProduction();
    roots.push(fixture.rootDir);
    try {
      const [operationalCard, historicalCard] = fixture.preparedDraft.reviewCards;
      expect(operationalCard).toBeDefined();
      expect(historicalCard).toBeDefined();
      const operationalComment = "Roastbeef vor dem Aufschneiden zehn Minuten ruhen lassen.";
      const operationalReview = await fixture.productionApp.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${operationalCard!.cardId}`,
        headers: productionHeaders,
        payload: { decision: "change_requested", operatorComment: operationalComment }
      });
      expectStatus(operationalReview, 200);
      expect(operationalReview.json<{ reviewCard: Record<string, unknown> }>().reviewCard).toMatchObject({
        operatorComment: operationalComment,
        operatorCommentVisibility: "operational"
      });

      const current = await fixture.store.getProductionDraft(fixture.adminActor, fixture.preparedDraft.draftId);
      expect(current).toBeDefined();
      const historicalComment = "HISTORICAL_REVIEW_SENTINEL 7.654,32 EUR";
      await fixture.store.saveProductionDraft(fixture.adminActor, {
        ...current!,
        reviewCards: current!.reviewCards.map((card) => card.cardId === historicalCard!.cardId
          ? {
              ...card,
              decision: "change_requested",
              operatorComment: historicalComment,
              decidedBy: "Historischer Import",
              decidedAt: "2026-08-20T12:00:00.000Z"
            }
          : card)
      });

      const productionRead = await fixture.productionApp.inject({
        method: "GET",
        url: `/v1/production/drafts?caseId=${fixture.caseId}`,
        headers: productionHeaders
      });
      expectStatus(productionRead, 200);
      expect(productionRead.body).toContain(operationalComment);
      expect(productionRead.body).not.toContain(historicalComment);

      const historicalIdenticalRetry = await fixture.productionApp.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${historicalCard!.cardId}`,
        headers: productionHeaders,
        payload: { decision: "change_requested", operatorComment: ` ${historicalComment} ` }
      });
      expectStatus(historicalIdenticalRetry, 200);
      expect(historicalIdenticalRetry.body).not.toContain(historicalComment);

      const historicalDecisionOnly = await fixture.productionApp.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${historicalCard!.cardId}`,
        headers: productionHeaders,
        payload: { decision: "unclear" }
      });
      expectStatus(historicalDecisionOnly, 200);
      expect(historicalDecisionOnly.body).not.toContain(historicalComment);

      const operationalDecisionOnly = await fixture.productionApp.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${operationalCard!.cardId}`,
        headers: adminHeaders,
        payload: { decision: "fits" }
      });
      expectStatus(operationalDecisionOnly, 200);
      expect(operationalDecisionOnly.body).toContain(operationalComment);
      const persisted = await fixture.store.getProductionDraft(fixture.adminActor, fixture.preparedDraft.draftId);
      expect(persisted?.reviewCards.find((card) => card.cardId === operationalCard!.cardId)).toMatchObject({
        decision: "fits",
        operatorComment: operationalComment,
        operatorCommentVisibility: "operational"
      });
      expect(persisted?.reviewCards.find((card) => card.cardId === historicalCard!.cardId)).toMatchObject({
        decision: "unclear",
        operatorComment: historicalComment
      });
      expect(persisted?.reviewCards.find((card) => card.cardId === historicalCard!.cardId))
        .not.toHaveProperty("operatorCommentVisibility");
    } finally {
      await Promise.all([fixture.offerApp.close(), fixture.productionApp.close()]);
    }
  });

  it("rejects revise before adapter invocation when change requests contain a commercial comment", async () => {
    const fixture = await createCanonicalProduction();
    roots.push(fixture.rootDir);
    const adapterFactory = vi.fn(() => ({
      adapterId: "must-not-run-review-comment-adapter",
      adapterMode: "fixture_only" as const,
      run: vi.fn(async () => {
        throw new Error("Adapter must not be invoked for a commercial review comment.");
      })
    }));
    const auditLog = new AuditLogStore({ rootDir: fixture.rootDir });
    const guardedApp = buildProductionApp({
      dataRoot: fixture.rootDir,
      store: fixture.store,
      auditLog,
      trustedActorSecret: TRUSTED_SECRET,
      buildLlmAdapter: adapterFactory,
      llmProviderDescriptor: {
        providerKind: "fixture",
        dataLeavesInstallation: false,
        providerModel: "fixture-review-comment-test",
        capability: "structured_output",
        actualRegion: "local",
        maximumEstimatedCostEur: 0,
        retentionPolicy: "none",
        trainingUse: "contractually_excluded",
        endpoint: "local://fixture-review-comment-test",
        metadataVerified: true
      },
      env: {}
    });
    try {
      const supportedCard = fixture.preparedDraft.reviewCards.find((card) =>
        card.kind === "event_data" || card.kind === "menu_component" || card.kind === "open_question"
      );
      expect(supportedCard).toBeDefined();
      const sentinel = "COMMERCIAL_REVISE_SENTINEL Verkaufspreis 6.543,21 EUR.";
      const reviewed = await fixture.productionApp.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/review-cards/${supportedCard!.cardId}`,
        headers: adminHeaders,
        payload: { decision: "change_requested", operatorComment: sentinel }
      });
      expectStatus(reviewed, 200);

      const draftsBefore = await fixture.store.listProductionDrafts(fixture.adminActor, fixture.caseId);
      const eventsBefore = await fixture.store.listEvents(fixture.adminActor, fixture.caseId);
      const auditsBefore = await auditLog.listRecentFor(fixture.adminActor, 200);
      const draftRead = vi.spyOn(fixture.store, "getProductionDraft");
      const response = await guardedApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${fixture.preparedDraft.draftId}/revise`,
        headers: productionHeaders,
        payload: {}
      });

      expect(response.statusCode, response.body).toBe(422);
      expect(response.body).not.toContain(sentinel);
      expect(adapterFactory).not.toHaveBeenCalled();
      expect(draftRead).toHaveBeenCalledTimes(1);
      expect(draftRead).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: "local", name: "Produktions-Mitarbeiter" }),
        fixture.preparedDraft.draftId
      );
      await expect(fixture.store.listProductionDrafts(fixture.adminActor, fixture.caseId))
        .resolves.toEqual(draftsBefore);
      await expect(fixture.store.listEvents(fixture.adminActor, fixture.caseId))
        .resolves.toEqual(eventsBefore);
      await expect(auditLog.listRecentFor(fixture.adminActor, 200))
        .resolves.toEqual(auditsBefore);
    } finally {
      await Promise.all([guardedApp.close(), fixture.offerApp.close(), fixture.productionApp.close()]);
    }
  });
});
