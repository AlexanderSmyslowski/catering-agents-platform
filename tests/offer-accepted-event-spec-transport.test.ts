import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  SCHEMA_VERSION,
  type BusinessContext,
  type AcceptedEventSpec,
  type EventRequest,
  type OfferDraft,
  type ProductionDraft
} from "@catering/shared-core";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { OfferStore } from "../offer-service/src/store.js";
import { HttpSourceDocumentMetadataReader } from "../offer-service/src/gateways/http-source-document-metadata-reader.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { buildPrintExportApp } from "../print-export/src/index.js";
import { HttpProductionHandoffReader } from "../production-service/src/gateways/http-production-handoff-reader.js";
import { HttpIntakeRecordsPort } from "../production-service/src/gateways/http-intake-records-port.js";
import {
  ProductionStore,
  productionDecisionRepositoryFor
} from "../production-service/src/repositories/production-store.js";
import { buildProductionArtifacts } from "../production-service/src/rules/planning.js";
import { InMemoryRecipeRepository } from "../production-service/src/repositories/in-memory-recipe-repository.js";
import { RecipeDiscoveryService } from "../production-service/src/recipe-discovery/service.js";
import { internalRecipes } from "../shared-core/src/fixtures/sample-data.js";
import type {
  IntakeRecordsPort,
  IntakeSpecInsertResult,
  IntakeSpecReplaceResult
} from "../production-service/src/ports/intake-records-port.js";

const trustedSecret = "accepted-spec-transport-test-secret";
const roots: string[] = [];

const intakeHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Intake-Mitarbeiter",
  "x-catering-business-id": "local"
};
const offerHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "local"
};
const productionHeaders = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Produktions-Mitarbeiter",
  "x-catering-business-id": "local"
};

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "catering-accepted-spec-transport-"));
  roots.push(root);
  return root;
}

function appFetch(app: FastifyInstance): typeof fetch {
  const inject = app.inject.bind(app) as unknown as (request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    payload?: string;
  }) => Promise<{ statusCode: number; body: string; headers: Record<string, string | string[] | undefined> }>;
  return async (input, init) => {
    const url = new URL(String(input));
    const response = await inject({
      method: init?.method ?? "GET",
      url: `${url.pathname}${url.search}`,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      payload: typeof init?.body === "string" ? init.body : undefined
    });
    return new Response(response.body, {
      status: response.statusCode,
      headers: response.headers as HeadersInit
    });
  };
}

function expectStatus(response: { statusCode: number; body: string }, statusCode: number): void {
  expect(response.statusCode, response.body).toBe(statusCode);
}

describe("AcceptedEventSpec production decision transport", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("carries an edited 55/25/20 portion menu through canonical Intake, approval, Apply and exports", async () => {
    const rootDir = createRoot();
    const env = { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: trustedSecret, CATERING_DEV_AUTH: "1" };
    const intakeApp = buildIntakeApp({ rootDir, trustedActorSecret: trustedSecret, env });
    const reader = new HttpSourceDocumentMetadataReader({ intakeServiceUrl: "http://intake.internal", trustedServiceSecret: trustedSecret, fetch: appFetch(intakeApp) });
    const offerApp = buildOfferApp({ rootDir, trustedActorSecret: trustedSecret, env, sourceDocumentReader: reader });
    const repository = new InMemoryRecipeRepository({ rootDir });
    await repository.seed({ businessId: "local" }, internalRecipes);
    const productionApp = buildProductionApp({
      dataRoot: rootDir, repository, trustedActorSecret: trustedSecret, env,
      handoffReader: new HttpProductionHandoffReader({ offerServiceUrl: "http://offer.internal", trustedServiceSecret: trustedSecret, fetch: appFetch(offerApp) }),
      intakeRecords: new HttpIntakeRecordsPort({ intakeServiceUrl: "http://intake.internal", trustedServiceSecret: trustedSecret, fetch: appFetch(intakeApp) })
    });
    const exports = buildPrintExportApp({ rootDir, trustedActorSecret: trustedSecret, env });
    try {
      const c = await offerApp.inject({ method: "POST", url: "/v1/offers/cases", headers: offerHeaders, payload: {} });
      const caseId = c.json().case.caseId;
      const response = await offerApp.inject({ method: "POST", url: "/v1/offers/from-text", headers: offerHeaders,
        payload: { caseId, requestId: "menu-apply-100", text: "Kunde: SYNTHETISCH Nachprüfung 19.10.2026\nLunch für 100 Gäste am 12.11.2026. 55 Portionen Hähnchenragout, 25 Portionen Gemüsebratlinge, 20 Portionen Linsenragout. 4 Gäste benötigen glutenfreie Sonderkost, 3 Gäste keine Schalenfrüchte; Gruppen können sich überschneiden." } });
      expectStatus(response, 201);
      const original = response.json() as OfferDraft;
      const baseline = structuredClone(original.sourceAcceptedEventSpecSnapshot);
      expect(baseline?.menuPlan.map(x => x.servings)).toEqual([55, 25, 20]);
      // This fixture verifies transport/scaling with an existing test recipe;
      // it is not a claim that Caesar Salad is a real replacement for the mains.
      const edit = await offerApp.inject({ method: "POST", url: `/v1/offers/drafts/${original.draftId}/menu`, headers: offerHeaders,
        payload: { revision: 1, menuPlan: [55, 25, 20].map(servings => ({ label: "Caesar Salad", servings, menuCategory: "vegetarian" })),
          eventDetails: { eventDate: "2026-11-13", eventType: "Wissenschaftlicher Abend", eventSchedule: [{label:"Abendcatering",start:"18:00",end:"22:00"}] } } });
      expectStatus(edit, 201);
      const revised = edit.json() as OfferDraft;
      const approved = await offerApp.inject({ method: "POST", url: `/v1/offers/drafts/${revised.draftId}/decision`, headers: offerHeaders,
        payload: { decision: "approved", revision: 1, variantId: revised.variantSet[1]!.variantId } });
      expectStatus(approved, 201);
      const handoffResponse = await offerApp.inject({ method: "POST", url: `/v1/offers/approved/${approved.json().approvedOffer.approvedOfferId}/handoffs`, headers: offerHeaders, payload: {} });
      expectStatus(handoffResponse, 201);
      const handoff = handoffResponse.json().handoff;
      const productionCase = await productionApp.inject({ method: "POST", url: `/v1/production/cases/from-handoff/${handoff.handoffId}`, headers: productionHeaders, payload: {} });
      expectStatus(productionCase, 201);
      const productionCaseId = productionCase.json().case.caseId;
      const draftResponse = await productionApp.inject({ method: "POST", url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`, headers: productionHeaders, payload: { caseId: productionCaseId } });
      expectStatus(draftResponse, 201);
      let draft = draftResponse.json().draft as ProductionDraft;
      expect(draft.draftArtifacts.eventSpec!.event.date).toBe("2026-11-13");
      const sourceDraft = structuredClone(draft);
      const premature = await productionApp.inject({method:"POST",url:`/v1/production/drafts/${draft.draftId}/decision`,headers:productionHeaders,payload:{decision:"approved"}});
      expectStatus(premature,422);
      expect(premature.body).toContain("Sonderkost-Rückfrage zuerst");
      const answer = "SYNTHETISCH: 4 glutenfreie und 3 schalenfruchtvermeidende Gäste, eine Person in beiden Gruppen. Separate gekennzeichnete Portionen; Lieferanten- und Küchenfreigabe vor realem Einsatz offen.";
      const emptyAnswer = await productionApp.inject({method:"POST", url:`/v1/production/drafts/${draft.draftId}/revise`,headers:productionHeaders,
        payload:{caseId:productionCaseId,expectedRevision:draft.revision,componentClassifications:[],specialDietResponse:" "}});
      expectStatus(emptyAnswer,422);
      const operationalRevision = await productionApp.inject({ method: "POST", url: `/v1/production/drafts/${draft.draftId}/revise`, headers: productionHeaders,
        payload: { caseId: productionCaseId, expectedRevision: draft.revision, componentClassifications: [], specialDietResponse: answer,
          componentUpdates: draft.draftArtifacts.eventSpec!.menuPlan.map(component => ({ componentId: component.componentId, productionMode: "scratch", purchasedElements: [], recipeOverrideId: "recipe-caesar-salad" })) } });
      expectStatus(operationalRevision, 201);
      draft = operationalRevision.json().draft as ProductionDraft;
      expect(draft.draftArtifacts.eventSpec!.uncertainties?.some(item=>item.message === "Angefragte Sonderkostfälle benötigen eine gesonderte fachliche Klärung.")).toBe(false);
      expect(draft.draftArtifacts.eventSpec!.productionConstraints?.join(" ")).toContain(answer);
      expect(draft.reviewCards.some(card=>card.requiredApproval && card.decision==="pending")).toBe(true);
      expect(sourceDraft.draftArtifacts.eventSpec!.uncertainties?.some(item=>item.field==="productionConstraints")).toBe(true);
      const loaded = await productionApp.inject({method:"GET",url:`/v1/production/drafts?caseId=${productionCaseId}`,headers:productionHeaders});
      expectStatus(loaded,200);
      expect(loaded.body).toContain("Sonderkost-Antwort von Produktions-Mitarbeiter");
      for (const [index, component] of draft.draftArtifacts.eventSpec!.menuPlan.entries()) {
        const portions = [55, 25, 20][index]!;
        const evidence = await productionApp.inject({ method: "POST", url: `/v1/production/cases/${productionCaseId}/planning-evidence`, headers: productionHeaders, payload: {
          draftId: draft.draftId, draftRevision: draft.revision, componentId: component.componentId, recipeId: "recipe-caesar-salad",
          quantityDecision: { decisionId: `menu-apply-quantity-${index}`, eventSpecId: baseline!.specId, componentId: component.componentId,
            guestCount: 100, serviceFormat: "buffet", dishRole: "main", basis: "servings_per_person",
            perUnitAmount: portions / 100, perUnitUnit: "servings", targetAmount: portions, targetUnit: "servings",
            rationale: "Explizite synthetische Portionsentscheidung.", evidence: { kind: "operator_instruction", reference: "menu-apply-test" }, reviewStatus: "approved" },
          recipeEventUseReview: { eventSpecId: baseline!.specId, recipeId: "recipe-caesar-salad", reviewedBy: "Produktions-Mitarbeiter", reviewedAt: "2026-10-17T17:00:00.000Z", decision: "accepted_for_event",
            confirmations: { quantitiesAndYield: true, methodAndEquipment: true, allergensAndDiet: true, holdingAndRegeneration: true } }
        } });
        expectStatus(evidence, 201);
      }
      const prepared = await productionApp.inject({ method: "POST", url: `/v1/production/drafts/${draft.draftId}/prepare`, headers: productionHeaders, payload: {} });
      expectStatus(prepared, 201);
      const ready = prepared.json().draft as ProductionDraft;
      for (const card of ready.reviewCards) {
        const r = await productionApp.inject({ method: "PATCH", url: `/v1/production/drafts/${ready.draftId}/review-cards/${card.cardId}`, headers: productionHeaders,
          payload: { decision: "fits", operatorComment: "Synthetischer Vertrags-/Skalierungstest." } });
        expectStatus(r, 200);
      }
      const decision = await productionApp.inject({ method: "POST", url: `/v1/production/drafts/${ready.draftId}/decision`, headers: productionHeaders, payload: { decision: "approved" } });
      expectStatus(decision, 201);
      const applied = await productionApp.inject({ method: "POST", url: `/v1/production/approved-specs/${decision.json().approvedProductionSpec.approvedProductionSpecId}/apply`, headers: productionHeaders, payload: {} });
      expectStatus(applied, 200);
      expect(applied.json().eventSpec.event.date).toBe("2026-11-13");
      expect(applied.json().eventSpec.productionConstraints.join(" ")).toContain(answer);
      expect(applied.json().eventSpec.menuPlan.map((x: any) => x.servings)).toEqual([55, 25, 20]);
      expect(await reader.getSpec({ businessId: "local" }, baseline!.specId)).toEqual(baseline);
      for (const url of [`/v1/exports/production-folders/${applied.json().plan.planId}/html`, `/v1/exports/purchase-lists/${applied.json().purchaseList.purchaseListId}/csv`]) {
        expectStatus(await exports.inject({ method: "GET", url, headers: productionHeaders }), 200);
      }
    } finally { await Promise.all([intakeApp.close(), offerApp.close(), productionApp.close(), exports.close()]); }
  });

  it("preserves the server-owned production decision and provenance through offer approval and production draft", async () => {
    const rootDir = createRoot();
    const intakeApp = buildIntakeApp({
      rootDir,
      store: new IntakeStore({ rootDir }),
      trustedActorSecret: trustedSecret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: trustedSecret, CATERING_DEV_AUTH: "1" }
    });
    const sourceDocumentReader = new HttpSourceDocumentMetadataReader({
      intakeServiceUrl: "http://intake.internal",
      trustedServiceSecret: trustedSecret,
      fetch: appFetch(intakeApp)
    });
    const intakeStore = new IntakeStore({ rootDir });
    const productionStore = new ProductionStore({ rootDir });
    const productionRepository = new InMemoryRecipeRepository({ rootDir });
    await productionRepository.seed({ businessId: "local" }, internalRecipes);
    const offerApp = buildOfferApp({
      rootDir,
      store: new OfferStore({ rootDir }),
      sourceDocumentReader,
      trustedActorSecret: trustedSecret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: trustedSecret, CATERING_DEV_AUTH: "1" }
    });
    const handoffReader = new HttpProductionHandoffReader({
      offerServiceUrl: "http://offer.internal",
      trustedServiceSecret: trustedSecret,
      fetch: appFetch(offerApp)
    });
    const productionApp = buildProductionApp({
      dataRoot: rootDir,
      store: productionStore,
      repository: productionRepository,
      handoffReader,
      intakeRecords: new HttpIntakeRecordsPort({
        intakeServiceUrl: "http://intake.internal",
        trustedServiceSecret: trustedSecret,
        fetch: appFetch(intakeApp)
      }),
      trustedActorSecret: trustedSecret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: trustedSecret, CATERING_DEV_AUTH: "1" }
    });
    const exportApp = buildPrintExportApp({
      rootDir,
      trustedActorSecret: trustedSecret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: trustedSecret, CATERING_DEV_AUTH: "1" }
    });

    try {
      const intakeResponse = await intakeApp.inject({
        method: "POST",
        url: "/v1/intake/specs/manual",
        headers: intakeHeaders,
        payload: {
          customerName: "Synthetischer Goldlauf-Kunde",
          eventType: "Lunch",
          eventDate: "2026-09-18",
          attendeeCount: 35,
          serviceForm: "Buffet",
          menuItems: ["Vegetarische Tomatensuppe"],
          notes: "Synthetischer Testfall ohne Kundendaten."
        }
      });
      expectStatus(intakeResponse, 201);
      const intakePayload = intakeResponse.json() as {
        eventRequest: EventRequest;
        acceptedEventSpec: AcceptedEventSpec;
      };
      const initialSpec = intakePayload.acceptedEventSpec;
      const componentId = initialSpec.menuPlan[0]?.componentId;
      expect(componentId).toBeTruthy();

      const updatedIntakeResponse = await intakeApp.inject({
        method: "PATCH",
        url: `/v1/intake/specs/${initialSpec.specId}`,
        headers: intakeHeaders,
        payload: {
          componentUpdates: [{
            componentId,
            menuCategory: "vegetarian",
            productionMode: "scratch",
            recipeOverrideId: "recipe-caesar-salad",
            notes: "Explizite synthetische Testakteur-Entscheidung."
          }]
        }
      });
      expectStatus(updatedIntakeResponse, 200);
      const updatedSpecWithoutBudget = (updatedIntakeResponse.json() as { acceptedEventSpec: AcceptedEventSpec }).acceptedEventSpec;
      const updatedSpec: AcceptedEventSpec = {
        ...structuredClone(updatedSpecWithoutBudget),
        budgetContext: {
          pricingSummary: {
            subtotal: { amount: 420, currency: "EUR" },
            perPerson: { amount: 12, currency: "EUR" },
            notes: ["Synthetische Intake-Budgetgrundlage vor Angebotskalkulation."]
          }
        }
      };
      expect(await intakeStore.replaceSpec(
        { businessId: "local" },
        updatedSpecWithoutBudget,
        updatedSpec
      )).toBe("updated");
      const intakeSpecBeforeApply = structuredClone(updatedSpec);
      const authoritativeDecision = updatedSpec.menuPlan[0]?.productionDecision;
      expect(authoritativeDecision?.mode).toBe("scratch");
      const authoritativeProvenance = structuredClone(updatedSpec.sourceLineage);

      const offerCaseResponse = await offerApp.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: offerHeaders,
        payload: { eventTypeLabel: "Lunch", attendeeCount: 35 }
      });
      expectStatus(offerCaseResponse, 201);
      const offerCaseId = (offerCaseResponse.json() as { case: { caseId: string } }).case.caseId;

      const draftResponse = await offerApp.inject({
        method: "POST",
        url: "/v1/offers/drafts",
        headers: offerHeaders,
        payload: {
          ...intakePayload.eventRequest,
          caseId: offerCaseId,
          acceptedEventSpecId: updatedSpec.specId
        }
      });
      expectStatus(draftResponse, 201);
      const draft = draftResponse.json() as OfferDraft;
      const draftSpec = draft.variantSet[0]?.proposedEventSpec;
      expect(draftSpec?.specId).toBe(updatedSpec.specId);
      expect(draftSpec?.sourceLineage).toEqual(authoritativeProvenance);
      expect(draftSpec?.menuPlan.find((component) => component.componentId === componentId)?.productionDecision)
        .toEqual(authoritativeDecision);

      const approvalResponse = await offerApp.inject({
        method: "POST",
        url: `/v1/offers/drafts/${draft.draftId}/decision`,
        headers: offerHeaders,
        payload: { decision: "approved", revision: draft.revision, variantId: draft.variantSet[0]!.variantId }
      });
      expectStatus(approvalResponse, 201);
      const approvedOfferId = (approvalResponse.json() as { approvedOffer: { approvedOfferId: string } }).approvedOffer.approvedOfferId;

      const handoffResponse = await offerApp.inject({
        method: "POST",
        url: `/v1/offers/approved/${approvedOfferId}/handoffs`,
        headers: offerHeaders,
        payload: {}
      });
      expectStatus(handoffResponse, 201);
      const handoff = (handoffResponse.json() as {
        handoff: {
          handoffId: string;
          eventSpecSnapshot: AcceptedEventSpec;
          sourceAcceptedEventSpecSnapshot?: AcceptedEventSpec;
        };
      }).handoff;
      expect(handoff.eventSpecSnapshot.specId).toBe(updatedSpec.specId);
      expect(handoff.sourceAcceptedEventSpecSnapshot).toEqual(intakeSpecBeforeApply);
      expect(handoff.eventSpecSnapshot.sourceLineage).toEqual(authoritativeProvenance);
      expect(handoff.eventSpecSnapshot.menuPlan.find((component) => component.componentId === componentId)?.productionDecision)
        .toEqual(authoritativeDecision);

      const productionCaseResponse = await productionApp.inject({
        method: "POST",
        url: `/v1/production/cases/from-handoff/${handoff.handoffId}`,
        headers: productionHeaders,
        payload: {}
      });
      expectStatus(productionCaseResponse, 201);
      const productionCaseId = (productionCaseResponse.json() as { case: { caseId: string } }).case.caseId;

      const productionDraftResponse = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/from-handoff/${handoff.handoffId}`,
        headers: productionHeaders,
        payload: { caseId: productionCaseId }
      });
      expectStatus(productionDraftResponse, 201);
      const productionDraft = (productionDraftResponse.json() as { draft: ProductionDraft }).draft;
      expect(productionDraft.draftArtifacts.eventSpec?.specId).toBe(updatedSpec.specId);
      expect(productionDraft.draftArtifacts.eventSpec?.sourceLineage).toEqual(authoritativeProvenance);
      expect(productionDraft.draftArtifacts.eventSpec?.menuPlan.find((component) => component.componentId === componentId)?.productionDecision)
        .toEqual(authoritativeDecision);

      const guestCount = productionDraft.draftArtifacts.eventSpec?.attendees.expected ?? 0;
      const planningEvidence = await productionApp.inject({
        method: "POST",
        url: `/v1/production/cases/${productionCaseId}/planning-evidence`,
        headers: productionHeaders,
        payload: {
          draftId: productionDraft.draftId,
          draftRevision: productionDraft.revision,
          componentId,
          recipeId: "recipe-caesar-salad",
          quantityDecision: {
            decisionId: "accepted-spec-transport-quantity",
            eventSpecId: updatedSpec.specId,
            componentId,
            guestCount,
            serviceFormat: "buffet",
            dishRole: "other",
            basis: "servings_per_person",
            perUnitAmount: 1,
            perUnitUnit: "servings",
            targetAmount: guestCount,
            targetUnit: "servings",
            rationale: "Explizite menschliche Mengenentscheidung für den Transportvertrag.",
            evidence: { kind: "operator_instruction", reference: "accepted-spec-transport" },
            reviewStatus: "approved"
          },
          recipeEventUseReview: {
            eventSpecId: updatedSpec.specId,
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
      expectStatus(planningEvidence, 201);

      const prepareResponse = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${productionDraft.draftId}/prepare`,
        headers: productionHeaders,
        payload: {}
      });
      expectStatus(prepareResponse, 201);
      const preparedDraft = (prepareResponse.json() as { draft: ProductionDraft }).draft;
      expect(preparedDraft.supersedesDraftId).toBe(productionDraft.draftId);
      expect(preparedDraft.draftArtifacts.eventSpec?.specId).toBe(updatedSpec.specId);
      expect(preparedDraft.reviewCards.length).toBeGreaterThan(0);

      for (const card of preparedDraft.reviewCards) {
        const reviewResponse = await productionApp.inject({
          method: "PATCH",
          url: `/v1/production/drafts/${preparedDraft.draftId}/review-cards/${card.cardId}`,
          headers: productionHeaders,
          payload: { decision: "fits", operatorComment: "Synthetische Goldlauf-Prüfung: keine Korrektur erforderlich." }
        });
        expectStatus(reviewResponse, 200);
      }
      const productionApprovalResponse = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${preparedDraft.draftId}/decision`,
        headers: productionHeaders,
        payload: { decision: "approved" }
      });
      expectStatus(productionApprovalResponse, 201);
      const approvedProductionSpecId = (productionApprovalResponse.json() as {
        approvedProductionSpec: { approvedProductionSpecId: string }
      }).approvedProductionSpec.approvedProductionSpecId;
      const intakeWithoutBudget = structuredClone(intakeSpecBeforeApply);
      delete intakeWithoutBudget.budgetContext;
      expect(await intakeStore.replaceSpec(
        { businessId: "local" },
        intakeSpecBeforeApply,
        intakeWithoutBudget
      )).toBe("updated");
      const rejectedBudgetDeletion = await productionApp.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: productionHeaders,
        payload: {}
      });
      expectStatus(rejectedBudgetDeletion, 409);
      expect(await productionStore.listPlans({ businessId: "local" })).toEqual([]);
      expect(await productionStore.listApplyManifests({ businessId: "local" })).toEqual([]);
      expect(await intakeStore.replaceSpec(
        { businessId: "local" },
        intakeWithoutBudget,
        handoff.eventSpecSnapshot
      )).toBe("updated");
      const rejectedHandoffRootReplacement = await productionApp.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: productionHeaders,
        payload: {}
      });
      expectStatus(rejectedHandoffRootReplacement, 409);
      expect(await productionStore.listPlans({ businessId: "local" })).toEqual([]);
      expect(await productionStore.listApplyManifests({ businessId: "local" })).toEqual([]);
      expect(await intakeStore.replaceSpec(
        { businessId: "local" },
        handoff.eventSpecSnapshot,
        intakeSpecBeforeApply
      )).toBe("updated");
      const applyResponse = await productionApp.inject({
        method: "POST",
        url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
        headers: productionHeaders,
        payload: {}
      });
      expectStatus(applyResponse, 200);
      const applyPayload = applyResponse.json() as {
        eventSpec: AcceptedEventSpec;
        plan: { planId: string };
        purchaseList: { purchaseListId: string };
        recipes: Array<{ recipeId: string }>;
      };
      expect(applyPayload.eventSpec.specId).toBe(updatedSpec.specId);
      expect(applyPayload.eventSpec.sourceLineage).toEqual(authoritativeProvenance);
      expect(applyPayload.eventSpec.menuPlan.find((component) => component.componentId === componentId)?.productionDecision)
        .toEqual(authoritativeDecision);
      expect(applyPayload.eventSpec.menuPlan).not.toEqual(intakeSpecBeforeApply.menuPlan);
      expect(await intakeStore.getSpec({ businessId: "local" }, updatedSpec.specId)).toEqual(intakeSpecBeforeApply);
      expect(await productionStore.getPlan({ businessId: "local" }, applyPayload.plan.planId)).toEqual(applyPayload.plan);
      expect(await productionStore.getPurchaseList({ businessId: "local" }, applyPayload.purchaseList.purchaseListId))
        .toEqual(applyPayload.purchaseList);
      const productionDocument = await exportApp.inject({
        method: "GET",
        url: `/v1/exports/production-folders/${applyPayload.plan.planId}/html`,
        headers: productionHeaders
      });
      expectStatus(productionDocument, 200);
      expect(productionDocument.headers["content-type"]).toContain("text/html");
      expect(productionDocument.body).toContain("Produktionsmappe");
      expect(productionDocument.body).toContain("Vegetarische Tomatensuppe");
      const purchaseExport = await exportApp.inject({
        method: "GET",
        url: `/v1/exports/purchase-lists/${applyPayload.purchaseList.purchaseListId}/csv`,
        headers: productionHeaders
      });
      expectStatus(purchaseExport, 200);
      expect(purchaseExport.headers["content-type"]).toContain("text/csv");
      expect(purchaseExport.body).toContain("purchaseQty");
      const auditResponse = await productionApp.inject({
        method: "GET",
        url: "/v1/production/audit/events?limit=20",
        headers: {
          ...productionHeaders,
          "x-catering-actor-name": "Betriebs-/Audit-Operator"
        }
      });
      expectStatus(auditResponse, 200);
      expect(auditResponse.json().items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          action: "production.approved_spec_applied",
          entityType: "ApprovedProductionSpec"
        })
      ]));
    } finally {
      await Promise.all([intakeApp.close(), offerApp.close(), productionApp.close(), exportApp.close()]);
    }
  });

  it("rejects missing, foreign, and malformed AcceptedEventSpec references before persisting a draft", async () => {
    const rootDir = createRoot();
    const sourceDocumentReader = {
      getMetadata: async () => undefined,
      getSpec: async () => undefined
    };
    const offerApp = buildOfferApp({
      rootDir,
      store: new OfferStore({ rootDir }),
      sourceDocumentReader,
      trustedActorSecret: trustedSecret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: trustedSecret, CATERING_DEV_AUTH: "1" }
    });

    try {
      const offerCaseResponse = await offerApp.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: offerHeaders,
        payload: { eventTypeLabel: "Lunch", attendeeCount: 35 }
      });
      expectStatus(offerCaseResponse, 201);
      const offerCaseId = (offerCaseResponse.json() as { case: { caseId: string } }).case.caseId;
      const eventRequest = createEventRequestFromText({
        requestId: "synthetic-invalid-spec-reference",
        channel: "text",
        rawText: "35 Personen Lunch Buffet"
      });

      for (const acceptedEventSpecId of ["missing-spec", "foreign-business-spec"]) {
        const response = await offerApp.inject({
          method: "POST",
          url: "/v1/offers/drafts",
          headers: offerHeaders,
          payload: { ...eventRequest, caseId: offerCaseId, acceptedEventSpecId }
        });
        expectStatus(response, 422);
        expect(response.json().message).toContain("AcceptedEventSpec");
      }

      const malformedResponse = await offerApp.inject({
        method: "POST",
        url: "/v1/offers/drafts",
        headers: offerHeaders,
        payload: { ...eventRequest, caseId: offerCaseId, acceptedEventSpecId: 42 }
      });
      expectStatus(malformedResponse, 422);
      expect((await offerApp.inject({
        method: "GET",
        url: "/v1/offers/drafts",
        headers: offerHeaders
      })).json().items).toHaveLength(0);
    } finally {
      await offerApp.close();
    }
  });

  it("fails closed for a historical direct-import snapshot without publishing artifacts", async () => {
    const rootDir = createRoot();
    const intakeStore = new IntakeStore({ rootDir });
    const canonicalSpec = normalizeEventRequestToSpec(createEventRequestFromText({
      requestId: "apply-lineage-canonical-request",
      channel: "text",
      rawText: "Synthetisches Lunch-Buffet fuer 20 Personen."
    }));
    await intakeStore.insertSpec({ businessId: "local" }, canonicalSpec);
    const tamperedSpec = {
      ...structuredClone(canonicalSpec),
      sourceLineage: canonicalSpec.sourceLineage.map((source, index) => index === 0
        ? { ...source, reference: "foreign-lineage-reference" }
        : source)
    };
    const repository = new InMemoryRecipeRepository({ rootDir });
    const artifacts = await buildProductionArtifacts(
      tamperedSpec,
      new RecipeDiscoveryService(repository, { searchRecipes: async () => [] }),
      { context: { businessId: "local" } }
    );
    const draft: ProductionDraft = {
      schemaVersion: SCHEMA_VERSION,
      businessId: "local",
      draftId: "apply-lineage-mismatch-draft",
      revision: 1,
      status: "pending_review",
      createdAt: "2026-08-24T00:00:00.000Z",
      source: {
        kind: "fixture",
        receivedAt: "2026-08-24T00:00:00.000Z",
        sourceRef: "fixture:apply-lineage-mismatch"
      },
      guardrails: {
        draftOnly: true,
        humanApprovalRequired: true,
        writesProductObjects: false,
        rawProviderPayloadStored: false,
        knowledgeWritePolicy: "reviewed_only"
      },
      reviewCards: [
        {
          cardId: "apply-lineage-event",
          kind: "event_data",
          title: "Eventdaten",
          summary: "Provenienzvertrag pruefen.",
          decision: "fits",
          targetPath: "$.draftArtifacts.eventSpec",
          targetId: tamperedSpec.specId,
          requiredApproval: true,
          decidedBy: "Produktions-Mitarbeiter",
          decidedAt: "2026-08-24T00:00:01.000Z"
        },
        {
          cardId: "apply-lineage-plan",
          kind: "timeline",
          title: "Produktionsplan",
          summary: "Produktionsplan pruefen.",
          decision: "fits",
          targetPath: "$.draftArtifacts.productionPlan",
          targetId: artifacts.productionPlan.planId,
          requiredApproval: true,
          decidedBy: "Produktions-Mitarbeiter",
          decidedAt: "2026-08-24T00:00:01.000Z"
        },
        {
          cardId: "apply-lineage-purchase",
          kind: "purchase_item",
          title: "Einkaufsliste",
          summary: "Einkaufsliste pruefen.",
          decision: "fits",
          targetPath: "$.draftArtifacts.purchaseList",
          targetId: artifacts.purchaseList.purchaseListId,
          requiredApproval: true,
          decidedBy: "Produktions-Mitarbeiter",
          decidedAt: "2026-08-24T00:00:01.000Z"
        }
      ],
      draftArtifacts: {
        eventSpec: tamperedSpec,
        productionPlan: artifacts.productionPlan,
        purchaseList: artifacts.purchaseList,
        recipes: artifacts.recipes
      }
    };
    const productionStore = new ProductionStore({ rootDir });
    const intakeRecords: IntakeRecordsPort = {
      getRequest: async () => undefined,
      getSpec: (context: BusinessContext, specId) => intakeStore.getSpec(context, specId),
      insertSpec: async (context: BusinessContext, spec): Promise<IntakeSpecInsertResult> =>
        (await intakeStore.insertSpec(context, spec)) === "created" ? "created" : "same_content",
      replaceSpec: async (
        context: BusinessContext,
        expected,
        replacement
      ): Promise<IntakeSpecReplaceResult> => {
        const result = await intakeStore.replaceSpec(context, expected, replacement);
        if (result === "updated") return "updated";
        if (result === "same_content") return "same_content";
        throw new Error(`Test-Intake-Spec konnte nicht ersetzt werden: ${result}`);
      }
    };
    await productionStore.saveProductionDraft({ businessId: "local" }, draft);
    const productionApp = buildProductionApp({
      dataRoot: rootDir,
      store: productionStore,
      repository,
      intakeRecords,
      trustedActorSecret: trustedSecret,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: trustedSecret, CATERING_DEV_AUTH: "1" }
    });

    try {
      const approvalResponse = await productionApp.inject({
        method: "POST",
        url: `/v1/production/drafts/${draft.draftId}/decision`,
        headers: productionHeaders,
        payload: { decision: "approved" }
      });
      expectStatus(approvalResponse, 409);
      expect(approvalResponse.json().message).toContain("unzureichender Produktionsbereitschaft");
      const target = {
        kind: "production_draft" as const,
        artifactId: draft.draftId,
        revision: draft.revision
      };
      await expect(productionStore.listApprovalsForTarget({ businessId: "local" }, target))
        .resolves.toHaveLength(0);
      await expect(productionDecisionRepositoryFor(productionStore)
        .listDecisionAggregatesForDraft({ businessId: "local" }, draft.draftId))
        .resolves.toHaveLength(0);
      await expect(productionStore.listApprovedProductionSpecs({ businessId: "local" }))
        .resolves.toHaveLength(0);
      await expect(productionStore.listApplyManifests({ businessId: "local" }))
        .resolves.toHaveLength(0);
      await expect(productionStore.listPlans({ businessId: "local" }))
        .resolves.toHaveLength(0);
      await expect(productionStore.listPurchaseLists({ businessId: "local" }))
        .resolves.toHaveLength(0);
      expect(await productionStore.getPlan({ businessId: "local" }, artifacts.productionPlan.planId)).toBeUndefined();
      expect(await productionStore.getPurchaseList({ businessId: "local" }, artifacts.purchaseList.purchaseListId))
        .toBeUndefined();
      expect(await intakeStore.getSpec({ businessId: "local" }, canonicalSpec.specId)).toEqual(canonicalSpec);
    } finally {
      await productionApp.close();
    }
  });
});
