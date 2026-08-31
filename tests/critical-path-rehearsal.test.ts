import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES,
  SCHEMA_VERSION,
  createEventRequestFromManualForm,
  type AcceptedEventSpec,
  type OfferDraft,
  type ProductionPlan,
  type PurchaseList,
  type Recipe,
  type QuantityDecisionInput,
  type RecipeEventUseReview
} from "@catering/shared-core";
import { buildOfferApp } from "@catering/offer-service";
import { buildPrintExportApp } from "@catering/print-export";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";
import {
  InMemoryRecipeRepository,
  ProductionStore,
  buildProductionApp
} from "@catering/production-service";
import { OfferStore } from "../offer-service/src/store.js";
import {
  runApprovedProductionWorkflow,
  type PlanningEvidenceSubmission
} from "./helpers/approved-production-workflow.js";
import {
  InMemoryIntakeRecordsPort,
  bindTestIntakeRecordsPort
} from "./support/in-memory-intake-records-port.js";

const TRUSTED_SECRET = "critical-path-rehearsal-secret";

type ProductionArtifactsResponse = {
  productionPlan: ProductionPlan;
  purchaseList: PurchaseList;
};

function trustedHeaders(role: keyof typeof MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES) {
  return {
    "x-catering-trusted-secret": TRUSTED_SECRET,
    "x-catering-actor-name": MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES[role]
  };
}

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-critical-path-"));
}

function createSoupRecipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "critical-path-tomato-soup",
    name: "Vegetarische Tomatensuppe Bankett",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "internal/critical-path-tomato-soup",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 0.97,
      fitScore: 0.96,
      extractionCompleteness: 1
    },
    baseYield: {
      servings: 10,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "critical-path-tomatoes",
        name: "Tomaten",
        quantity: {
          amount: 2,
          unit: "kg"
        },
        group: "produce",
        purchaseUnit: "kg",
        normalizedUnit: "g"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Tomaten garen, passieren und fuer das Buffet heisshalten."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.05,
      batchSize: 10
    },
    allergens: [],
    dietTags: ["vegetarian"]
  };
}

async function expectJsonResponse<T>(response: { statusCode: number; json: () => unknown }): Promise<T> {
  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
  return response.json() as T;
}

async function createCanonicalHandoff(input: {
  intakeApp: ReturnType<typeof buildIntakeApp>;
  offerApp: ReturnType<typeof buildOfferApp>;
  requestId: string;
  menuItems: string[];
  recipeOverrideIdFor?: (component: AcceptedEventSpec["menuPlan"][number]) => string | undefined;
}): Promise<{
  eventRequest: ReturnType<typeof createEventRequestFromManualForm>;
  acceptedEventSpec: AcceptedEventSpec;
  draft: OfferDraft;
  handoff: { handoffId: string; eventSpecSnapshot: AcceptedEventSpec };
}> {
  const intakeResponse = await input.intakeApp.inject({
    method: "POST",
    url: "/v1/intake/specs/manual",
    headers: trustedHeaders("intake_operator"),
    payload: {
      customerName: "Synthetic Demo Account",
      eventType: "Business Lunch",
      eventDate: "2026-09-18",
      attendeeCount: 80,
      serviceForm: "Buffet",
      menuItems: input.menuItems,
      notes: "Synthetischer Rehearsal-Fall ohne echte Kundendaten.",
      requestId: input.requestId
    }
  });
  const intakePayload = await expectJsonResponse<{
    eventRequest: ReturnType<typeof createEventRequestFromManualForm>;
    acceptedEventSpec: AcceptedEventSpec;
  }>(intakeResponse);
  const decisionResponse = await input.intakeApp.inject({
    method: "PATCH",
    url: `/v1/intake/specs/${intakePayload.acceptedEventSpec.specId}`,
    headers: trustedHeaders("intake_operator"),
    payload: {
      componentUpdates: intakePayload.acceptedEventSpec.menuPlan.map((component) => ({
        componentId: component.componentId,
        productionMode: "scratch",
        ...(input.recipeOverrideIdFor?.(component)
          ? { recipeOverrideId: input.recipeOverrideIdFor(component) }
          : {}),
        notes: "Operatorentscheidung aus dem Rehearsal: interne Rezeptbibliothek nutzen."
      }))
    }
  });
  const acceptedEventSpec = (await expectJsonResponse<{ acceptedEventSpec: AcceptedEventSpec }>(decisionResponse)).acceptedEventSpec;
  const offerCaseId = await expectJsonResponse<{ case: { caseId: string } }>(
    await input.offerApp.inject({
      method: "POST",
      url: "/v1/offers/cases",
      headers: trustedHeaders("offer_operator"),
      payload: { eventTypeLabel: "Business Lunch", attendeeCount: 80 }
    })
  ).then((body) => body.case.caseId);
  const draft = await expectJsonResponse<OfferDraft>(
    await input.offerApp.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers: trustedHeaders("offer_operator"),
      payload: {
        ...intakePayload.eventRequest,
        caseId: offerCaseId,
        acceptedEventSpecId: acceptedEventSpec.specId
      }
    })
  );
  const approval = await expectJsonResponse<{ approvedOffer: { approvedOfferId: string } }>(
    await input.offerApp.inject({
      method: "POST",
      url: `/v1/offers/drafts/${draft.draftId}/decision`,
      headers: trustedHeaders("offer_operator"),
      payload: { decision: "approved", revision: 1, variantId: "variant-2" }
    })
  );
  const handoff = await expectJsonResponse<{ handoff: { handoffId: string; eventSpecSnapshot: AcceptedEventSpec } }>(
    await input.offerApp.inject({
      method: "POST",
      url: `/v1/offers/approved/${approval.approvedOffer.approvedOfferId}/handoffs`,
      headers: trustedHeaders("offer_operator"),
      payload: {}
    })
  );
  return {
    eventRequest: intakePayload.eventRequest,
    acceptedEventSpec,
    draft,
    handoff: handoff.handoff
  };
}

function tomatoPlanningEvidence(spec: AcceptedEventSpec, componentId: string): PlanningEvidenceSubmission {
  const attendeeCount = spec.attendees.expected;
  if (attendeeCount === undefined) throw new Error("Critical-path fixture requires an attendee count.");
  const quantityDecision: QuantityDecisionInput = {
    decisionId: "quantity-critical-path-tomato-soup",
    eventSpecId: spec.specId,
    componentId,
    guestCount: attendeeCount,
    serviceFormat: spec.servicePlan.serviceForm,
    dishRole: "other",
    basis: "servings_per_person",
    perUnitAmount: 1,
    perUnitUnit: "servings",
    targetAmount: attendeeCount,
    targetUnit: "servings",
    rationale: "Explizite menschliche Mengenentscheidung für diesen Rehearsal-Fall.",
    evidence: { kind: "operator_instruction", reference: "operator:critical-path" },
    reviewStatus: "approved"
  };
  const recipeEventUseReview: RecipeEventUseReview = {
    eventSpecId: spec.specId,
    recipeId: "critical-path-tomato-soup",
    reviewedBy: MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES.production_operator,
    reviewedAt: "2026-08-30T10:05:00.000Z",
    decision: "accepted_for_event",
    confirmations: {
      quantitiesAndYield: true,
      methodAndEquipment: true,
      allergensAndDiet: true,
      holdingAndRegeneration: true
    }
  };
  return { componentId, recipeId: "critical-path-tomato-soup", quantityDecision, recipeEventUseReview };
}

describe("critical path rehearsal", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("creates a synthetic request and produces offer, production, purchase and read-only evidence", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);

    const repository = new InMemoryRecipeRepository({ rootDir: dataRoot });
    await repository.save({ businessId: "local" }, createSoupRecipe());

    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const intakeApp = buildIntakeApp({
      rootDir: dataRoot,
      store: intakeStore,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: TRUSTED_SECRET, CATERING_DEV_AUTH: "1" }
    });
    const offerStore = new OfferStore({ rootDir: dataRoot });
    const offerApp = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      sourceDocumentReader: {
        getMetadata: async () => undefined,
        getSpec: (context, specId) => intakeStore.getSpec(context, specId)
      },
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const productionApp = buildProductionApp({
      dataRoot,
      repository,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => offerStore.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: {
        CATERING_DEV_AUTH: "1",
        CATERING_ENABLE_WEB_RECIPE_SEARCH: "0"
      }
    });
    bindTestIntakeRecordsPort(productionApp, intakeRecords);
    const exportApp = buildPrintExportApp({
      rootDir: dataRoot,
      trustedActorSecret: TRUSTED_SECRET,
      env: { CATERING_DEV_AUTH: "1" }
    });

    try {
      const negativeScenario = await createCanonicalHandoff({
        intakeApp,
        offerApp,
        requestId: "critical-path-mystery-negative",
        menuItems: ["Vegetarische Tomatensuppe", "Mystery Bowl"]
      });
      expect(negativeScenario.eventRequest.rawInputs[0]?.content).toContain("Synthetischer Rehearsal-Fall");
      expect(negativeScenario.acceptedEventSpec.menuPlan.every((component) => component.productionDecision?.mode === "scratch")).toBe(true);
      expect(negativeScenario.draft.draftId).toMatch(/^draft-spec-critical-path-mystery-negative$/);
      expect(negativeScenario.draft.proposedEventSpec.menuPlan.map((component) => component.label)).toEqual(
        expect.arrayContaining(["Vegetarische Tomatensuppe", "Mystery Bowl"])
      );
      expect(negativeScenario.draft.variantSet.length).toBeGreaterThan(0);

      const productionStore = new ProductionStore({ rootDir: dataRoot });
      const negativePrepare = await runApprovedProductionWorkflow(productionApp, {
        headers: trustedHeaders("production_operator"),
        handoffId: negativeScenario.handoff.handoffId,
        payload: { eventSpec: negativeScenario.handoff.eventSpecSnapshot }
      });
      expect(negativePrepare.statusCode).toBe(409);
      expect(negativePrepare.body).toContain("Planungs-Evidenz");
      expect(negativePrepare.caseId).toBeTruthy();
      expect(negativePrepare.draftId).toBeTruthy();
      const negativeDraft = await productionStore.getProductionDraft(
        { businessId: "local" },
        negativePrepare.draftId!
      );
      expect(negativeDraft?.status).toBe("pending_review");
      expect(negativeDraft?.draftArtifacts.productionPlan).toBeUndefined();
      expect(negativeDraft?.draftArtifacts.purchaseList).toBeUndefined();
      expect(negativeDraft?.draftArtifacts.recipes).toBeUndefined();
      expect(await productionStore.listPlans({ businessId: "local" })).toHaveLength(0);
      expect(await productionStore.listPurchaseLists({ businessId: "local" })).toHaveLength(0);
      expect(await productionStore.listApplyManifests({ businessId: "local" })).toHaveLength(0);
      expect(await productionStore.listProductionPlanningEvidence({ businessId: "local" })).toHaveLength(0);

      const positiveScenario = await createCanonicalHandoff({
        intakeApp,
        offerApp,
        requestId: "critical-path-tomato-positive",
        menuItems: ["Vegetarische Tomatensuppe"],
        recipeOverrideIdFor: () => "critical-path-tomato-soup"
      });
      const promotedSpec = positiveScenario.handoff.eventSpecSnapshot;
      expect(promotedSpec.lifecycle.commercialState).toBe("accepted");
      expect(promotedSpec.attendees.expected).toBe(80);
      const tomatoComponentId = promotedSpec.menuPlan[0]?.componentId;
      expect(tomatoComponentId).toBeTruthy();
      expect(promotedSpec.menuPlan[0]?.recipeOverrideId).toBe("critical-path-tomato-soup");

      const productionSpec = promotedSpec;
      const artifacts = await expectJsonResponse<ProductionArtifactsResponse>(
        await runApprovedProductionWorkflow(productionApp, {
          headers: trustedHeaders("production_operator"),
          handoffId: positiveScenario.handoff.handoffId,
          payload: {
            eventSpec: productionSpec
          },
          planningEvidence: [tomatoPlanningEvidence(promotedSpec, tomatoComponentId!)]
        })
      );

      const { productionPlan, purchaseList } = artifacts;
      expect(productionPlan.eventSpecId).toBe(promotedSpec.specId);
      expect(productionPlan.productionBatches).toEqual([
        expect.objectContaining({
          componentId: tomatoComponentId,
          recipeId: "critical-path-tomato-soup"
        })
      ]);
      expect(productionPlan.kitchenSheets.map((sheet) => sheet.componentId)).toEqual([tomatoComponentId]);
      expect(productionPlan.recipeSelections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            componentId: tomatoComponentId,
            recipeId: "critical-path-tomato-soup",
            sourceTier: "internal_verified",
            autoUsedInternetRecipe: false
          })
        ])
      );
      expect(productionPlan.componentReadiness).toEqual(
        [expect.objectContaining({
          componentId: tomatoComponentId,
          status: "operational",
          includedInPurchaseList: true
        })]
      );

      expect(purchaseList.eventSpecId).toBe(promotedSpec.specId);
      expect(purchaseList.items).toEqual([
        expect.objectContaining({
          displayName: "Tomaten",
          group: "produce",
          sourceRecipes: ["critical-path-tomato-soup"]
        })
      ]);
      expect(purchaseList.totals).toMatchObject({
        itemCount: 1,
        groups: ["produce"]
      });

      const savedPlan = await expectJsonResponse<ProductionPlan>(
        await productionApp.inject({
          method: "GET",
          url: `/v1/production/plans/${productionPlan.planId}`,
          headers: trustedHeaders("production_operator")
        })
      );
      const savedPurchaseList = await expectJsonResponse<PurchaseList>(
        await productionApp.inject({
          method: "GET",
          url: `/v1/production/purchase-lists/${purchaseList.purchaseListId}`,
          headers: trustedHeaders("production_operator")
        })
      );
      expect(savedPlan.planId).toBe(productionPlan.planId);
      expect(savedPurchaseList.purchaseListId).toBe(purchaseList.purchaseListId);

      const offerExport = await exportApp.inject({
        method: "GET",
        url: `/v1/exports/offers/${positiveScenario.draft.draftId}/html`,
        headers: trustedHeaders("offer_operator")
      });
      expect(offerExport.statusCode).toBe(200);
      expect(offerExport.headers["content-type"]).toContain("text/html");
      expect(offerExport.body).toContain("<h1>Angebot</h1>");
      expect(offerExport.body).not.toContain(positiveScenario.draft.draftId);

      const planExport = await exportApp.inject({
        method: "GET",
        url: `/v1/exports/production-plans/${productionPlan.planId}/html`,
        headers: trustedHeaders("production_operator")
      });
      expect(planExport.statusCode).toBe(200);
      expect(planExport.headers["content-type"]).toContain("text/html");
      expect(planExport.body).toContain("<h2>Vegetarische Tomatensuppe</h2>");
      expect(planExport.body).not.toContain("<h2>critical-path-tomato-soup</h2>");
      expect(planExport.body).not.toContain("internal/critical-path-tomato-soup");
      expect(planExport.body).toContain("Tomaten garen");

      const purchaseExport = await exportApp.inject({
        method: "GET",
        url: `/v1/exports/purchase-lists/${purchaseList.purchaseListId}/csv`,
        headers: trustedHeaders("production_operator")
      });
      expect(purchaseExport.statusCode).toBe(200);
      expect(purchaseExport.headers["content-type"]).toContain("text/csv");
      expect(purchaseExport.body).toContain("Tomaten");
      expect(purchaseExport.body).toContain("purchaseQty");

      const auditEvents = await expectJsonResponse<{
        items: Array<{ action: string; entityId: string; actor: { name: string; source: string } }>;
      }>(
        await productionApp.inject({
          method: "GET",
          url: "/v1/production/audit/events?limit=5",
          headers: trustedHeaders("operations_audit_operator")
        })
      );
      expect(auditEvents.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
              action: "production.approved_spec_applied",
              entityId: expect.stringMatching(/^approved-production-spec-/),
            actor: expect.objectContaining({
              name: MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES.production_operator,
              source: "trusted-proxy:x-catering-actor-name"
            })
          })
        ])
      );
    } finally {
      await Promise.all([
        intakeApp.close(),
        offerApp.close(),
        productionApp.close(),
        exportApp.close()
      ]);
    }
  });
});
