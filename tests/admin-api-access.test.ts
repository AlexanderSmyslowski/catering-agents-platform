import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { HttpSourceDocumentMetadataReader } from "../offer-service/src/gateways/http-source-document-metadata-reader.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { InMemoryRecipeRepository } from "../production-service/src/repositories/in-memory-recipe-repository.js";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";
import { internalRecipes } from "../shared-core/src/fixtures/sample-data.js";
import type { AcceptedEventSpec } from "../shared-core/src/types.js";
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
const intakeHeaders = headersFor("Intake-Mitarbeiter");

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
  const intakeStore = new IntakeStore({ rootDir });
  const intakeApp = buildIntakeApp({
    rootDir,
    store: intakeStore,
    trustedActorSecret: TRUSTED_SECRET,
    env: { CATERING_DEV_AUTH: "1" }
  });
  const offerApp = buildOfferApp({
    rootDir,
    sourceDocumentReader: new HttpSourceDocumentMetadataReader({
      intakeServiceUrl: "http://intake-service.test",
      trustedServiceSecret: TRUSTED_SECRET,
      fetch: offerServiceFetch(intakeApp)
    }),
    trustedActorSecret: TRUSTED_SECRET,
    env: { CATERING_DEV_AUTH: "1" }
  });
  const intakeResponse = await intakeApp.inject({
    method: "POST",
    url: "/v1/intake/specs/manual",
    headers: intakeHeaders,
    payload: {
      customerName: "Pseudonymisierte Organisation",
      eventType: "Business Lunch",
      eventDate: "2026-09-18",
      attendeeCount: 35,
      serviceForm: "Buffet",
      menuItems: ["Caesar Salad Buffet"],
      notes: "Kanonische Admin-API-Fixture.",
      requestId: "admin-api-canonical-request"
    }
  });
  expectStatus(intakeResponse, 201);
  const intakePayload = intakeResponse.json<{
    eventRequest: Record<string, unknown>;
    acceptedEventSpec: { specId: string; menuPlan: Array<{ componentId: string }> };
  }>();
  const updatedIntake = await intakeApp.inject({
    method: "PATCH",
    url: `/v1/intake/specs/${intakePayload.acceptedEventSpec.specId}`,
    headers: intakeHeaders,
    payload: {
      componentUpdates: intakePayload.acceptedEventSpec.menuPlan.map((component) => ({
        componentId: component.componentId,
        menuCategory: "classic",
        productionMode: "scratch",
        recipeOverrideId: "recipe-caesar-salad",
        notes: "Explizite kanonische Rezeptentscheidung der Fixture."
      }))
    }
  });
  expectStatus(updatedIntake, 200);
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
    url: "/v1/offers/drafts",
    headers: offerHeaders,
    payload: {
      caseId: offerCaseId,
      ...intakePayload.eventRequest,
      acceptedEventSpecId: intakePayload.acceptedEventSpec.specId
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
    handoff: { handoffId: string; pricingSnapshot: unknown; eventSpecSnapshot: AcceptedEventSpec }
  }>().handoff;
  expect(handoff.pricingSnapshot).toBeDefined();

  return { intakeApp, offerApp, handoff };
}

async function createCanonicalProductionDraft(rootDir: string) {
  const { intakeApp, offerApp, handoff } = await createCanonicalOfferHandoff(rootDir);
  const repository = new InMemoryRecipeRepository({ rootDir });
  await repository.seed({ businessId: "local" }, internalRecipes);
  const intakeRecords = new InMemoryIntakeRecordsPort();
  await intakeRecords.insertSpec({ businessId: "local" }, handoff.eventSpecSnapshot);
  const productionApp = buildProductionApp({
    dataRoot: rootDir,
    repository,
    store: new ProductionStore({ rootDir }),
    intakeRecords,
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
  const draft = productionDraft.json<{
    draft: { draftId: string; revision: number; draftArtifacts: { eventSpec?: AcceptedEventSpec } }
  }>().draft;
  const eventSpec = draft.draftArtifacts.eventSpec;
  const component = eventSpec?.menuPlan[0];
  expect(eventSpec?.specId).toBeTruthy();
  expect(component?.componentId).toBeTruthy();
  const evidence = await productionApp.inject({
    method: "POST",
    url: `/v1/production/cases/${caseId}/planning-evidence`,
    headers: productionHeaders,
    payload: {
      draftId: draft.draftId,
      draftRevision: draft.revision,
      componentId: component!.componentId,
      recipeId: "recipe-caesar-salad",
      quantityDecision: {
        decisionId: "admin-api-canonical-quantity",
        eventSpecId: eventSpec!.specId,
        componentId: component!.componentId,
        guestCount: eventSpec!.attendees.expected,
        serviceFormat: eventSpec!.servicePlan.serviceForm,
        dishRole: "other",
        basis: "servings_per_person",
        perUnitAmount: 1,
        perUnitUnit: "servings",
        targetAmount: eventSpec!.attendees.expected,
        targetUnit: "servings",
        rationale: "Explizite kanonische Mengenentscheidung der Fixture.",
        evidence: { kind: "operator_instruction", reference: "admin-api-canonical" },
        reviewStatus: "approved"
      },
      recipeEventUseReview: {
        eventSpecId: eventSpec!.specId,
        recipeId: "recipe-caesar-salad",
        reviewedBy: "Produktions-Mitarbeiter",
        reviewedAt: "2026-08-30T12:00:00.000Z",
        decision: "accepted_for_event",
        confirmations: {
          quantitiesAndYield: true,
          methodAndEquipment: true,
          allergensAndDiet: true,
          holdingAndRegeneration: true
        }
      }
    }
  });
  expectStatus(evidence, 201);
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
  return { intakeApp, offerApp, productionApp, preparedDraft };
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
    const { intakeApp, offerApp, handoff } = await createCanonicalOfferHandoff(rootDir);
    try {
      const response = await offerApp.inject({
        method: "GET",
        url: `/v1/offers/handoffs/${handoff.handoffId}`,
        headers: adminHeaders
      });
      expectStatus(response, 200);
      expect(response.json<{ handoff: { pricingSnapshot: unknown } }>().handoff.pricingSnapshot).toEqual(handoff.pricingSnapshot);
    } finally {
      await Promise.all([intakeApp.close(), offerApp.close()]);
    }
  });

  it("lets Administrator execute a canonical Production-Decision path", async () => {
    const rootDir = createDataRoot();
    roots.push(rootDir);
    const { intakeApp, offerApp, productionApp, preparedDraft } = await createCanonicalProductionDraft(rootDir);
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
      await Promise.all([intakeApp.close(), offerApp.close(), productionApp.close()]);
    }
  });

  it("lets Administrator execute a canonical ApprovedProductionSpec Apply path", async () => {
    const rootDir = createDataRoot();
    roots.push(rootDir);
    const { intakeApp, offerApp, productionApp, preparedDraft } = await createCanonicalProductionDraft(rootDir);
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
      await Promise.all([intakeApp.close(), offerApp.close(), productionApp.close()]);
    }
  });
});
