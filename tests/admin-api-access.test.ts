import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { InMemoryRecipeRepository } from "../production-service/src/repositories/in-memory-recipe-repository.js";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";
import { internalRecipes } from "../shared-core/src/fixtures/sample-data.js";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";

const TRUSTED_SECRET = "gate-b-admin-api-secret";

const headersFor = (actorName: string) => ({
  "x-catering-trusted-secret": TRUSTED_SECRET,
  "x-catering-actor-name": actorName,
  "x-catering-business-id": "local"
});

const offerHeaders = headersFor("Angebots-Mitarbeiter");
const productionHeaders = headersFor("Produktions-Mitarbeiter");
const adminHeaders = headersFor("Administrator");

type InjectableApp = { inject: (request: { method: string; url: string; headers: Record<string, string>; payload?: unknown }) => Promise<{ statusCode: number; body: string; json: <T>() => T }>; close: () => Promise<void> };

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-gate-b-admin-api-"));
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

async function createCanonicalOfferHandoff(rootDir: string) {
  const offerApp = buildOfferApp({
    rootDir,
    trustedActorSecret: TRUSTED_SECRET,
    env: { CATERING_DEV_AUTH: "1" }
  });
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
  const draft = createdDraft.json<{ draftId: string; variantSet: Array<{ variantId: string; proposedEventSpec: unknown }> }>();
  const selectedVariant = draft.variantSet[0];
  expect(selectedVariant).toBeDefined();

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
  const handoff = createdHandoff.json<{
    handoff: { handoffId: string; pricingSnapshot: unknown }
  }>().handoff;
  expect(handoff.pricingSnapshot).toBeDefined();

  return { offerApp, handoff };
}

async function createCanonicalProductionDraft(rootDir: string) {
  const { offerApp, handoff } = await createCanonicalOfferHandoff(rootDir);
  const repository = new InMemoryRecipeRepository({ rootDir });
  await repository.seed({ businessId: "local" }, internalRecipes);
  const productionApp = buildProductionApp({
    dataRoot: rootDir,
    repository,
    store: new ProductionStore({ rootDir }),
    intakeRecords: new InMemoryIntakeRecordsPort(),
    handoffReader: new HttpProductionHandoffReader({
      offerServiceUrl: "http://offer-service.test",
      trustedServiceSecret: TRUSTED_SECRET,
      fetch: offerServiceFetch(offerApp)
    }),
    trustedActorSecret: TRUSTED_SECRET,
    env: { CATERING_ENABLE_WEB_RECIPE_SEARCH: "0", CATERING_DEV_AUTH: "1" }
  });

  const productionCase = await productionApp.inject({
    method: "POST",
    url: `/v1/production/cases/from-handoff/${handoff.handoffId}`,
    headers: productionHeaders,
    payload: {}
  });
  expectStatus(productionCase, 201);
  const caseId = productionCase.json<{ case: { caseId: string } }>().case.caseId;
  const productionDraft = await productionApp.inject({
    method: "POST",
    url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
    headers: productionHeaders,
    payload: { caseId }
  });
  expectStatus(productionDraft, 201);
  const draft = productionDraft.json<{ draft: { draftId: string } }>().draft;
  const prepared = await productionApp.inject({
    method: "POST",
    url: `/v1/production/drafts/${draft.draftId}/prepare`,
    headers: productionHeaders,
    payload: {}
  });
  expectStatus(prepared, 201);
  const preparedDraft = prepared.json<{
    draft: { draftId: string; reviewCards: Array<{ cardId: string }> }
  }>().draft;
  for (const card of preparedDraft.reviewCards) {
    const reviewed = await productionApp.inject({
      method: "PATCH",
      url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${card.cardId}`,
      headers: productionHeaders,
      payload: { decision: "fits", operatorComment: "Kanonische Fixture-Prüfung." }
    });
    expectStatus(reviewed, 200);
  }
  return { offerApp, productionApp, preparedDraft };
}

describe("Gate B Slice 1 administrator API access", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [root], { stdio: "ignore" });
      } catch {
        // The sandbox may deny Trash access; the attempt remains recoverable where permitted.
      }
    }
  });

  it("lets Administrator read a canonical Offer-Handoff pricing snapshot", async () => {
    const rootDir = createDataRoot();
    roots.push(rootDir);
    const { offerApp, handoff } = await createCanonicalOfferHandoff(rootDir);
    try {
      const response = await offerApp.inject({
        method: "GET",
        url: `/v1/offers/handoffs/${handoff.handoffId}`,
        headers: adminHeaders
      });
      expectStatus(response, 200);
      expect(response.json<{ handoff: { pricingSnapshot: unknown } }>().handoff.pricingSnapshot).toEqual(handoff.pricingSnapshot);
    } finally {
      await offerApp.close();
    }
  });

  it("lets Administrator execute a canonical Production-Decision path", async () => {
    const rootDir = createDataRoot();
    roots.push(rootDir);
    const { offerApp, productionApp, preparedDraft } = await createCanonicalProductionDraft(rootDir);
    try {
      const response = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: adminHeaders,
        payload: { decision: "approved" }
      });
      expectStatus(response, 201);
      expect(response.json()).toHaveProperty("approvedProductionSpec");
    } finally {
      await Promise.all([offerApp.close(), productionApp.close()]);
    }
  });

  it("lets Administrator execute a canonical ApprovedProductionSpec Apply path", async () => {
    const rootDir = createDataRoot();
    roots.push(rootDir);
    const { offerApp, productionApp, preparedDraft } = await createCanonicalProductionDraft(rootDir);
    try {
      const decision = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: productionHeaders,
        payload: { decision: "approved" }
      });
      expectStatus(decision, 201);
      const approvedProductionSpecId = decision.json<{ approvedProductionSpec: { approvedProductionSpecId: string } }>()
        .approvedProductionSpec.approvedProductionSpecId;

      const response = await productionApp.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: adminHeaders,
        payload: {}
      });
      expectStatus(response, 200);
      expect(response.json()).toHaveProperty("plan");
    } finally {
      await Promise.all([offerApp.close(), productionApp.close()]);
    }
  });
});
