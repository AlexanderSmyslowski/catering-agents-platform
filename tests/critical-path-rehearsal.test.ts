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
  type Recipe
} from "@catering/shared-core";
import { buildOfferApp } from "@catering/offer-service";
import { buildPrintExportApp } from "@catering/print-export";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";
import {
  InMemoryRecipeRepository,
  buildProductionApp
} from "@catering/production-service";
import { OfferStore } from "../offer-service/src/store.js";
import { runApprovedProductionWorkflow } from "./helpers/approved-production-workflow.js";
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
      env: { CATERING_DEFAULT_BUSINESS_ID: "local", CATERING_TRUSTED_ACTOR_SECRET: TRUSTED_SECRET }
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
      env: {}
    });
    const intakeRecords = new InMemoryIntakeRecordsPort();
    const productionApp = buildProductionApp({
      dataRoot,
      repository,
      intakeRecords,
      handoffReader: { get: async (context, handoffId) => offerStore.getHandoff(context, handoffId) },
      trustedActorSecret: TRUSTED_SECRET,
      env: {
        CATERING_ENABLE_WEB_RECIPE_SEARCH: "0"
      }
    });
    bindTestIntakeRecordsPort(productionApp, intakeRecords);
    const exportApp = buildPrintExportApp({
      rootDir: dataRoot,
      trustedActorSecret: TRUSTED_SECRET,
      env: {}
    });

    try {
      const intakeResponse = await intakeApp.inject({
        method: "POST",
        url: "/v1/intake/specs/manual",
        headers: trustedHeaders("intake_operator"),
        payload: {
          customerName: "Synthetic Demo Account",
          eventType: "Business Lunch",
          eventDate: "2026-09-18",
          attendeeCount: 80,
          serviceForm: "Buffet",
          menuItems: ["Vegetarische Tomatensuppe", "Mystery Bowl"],
          notes: "Synthetischer Rehearsal-Fall ohne echte Kundendaten."
        }
      });
      const intakePayload = await expectJsonResponse<{
        eventRequest: ReturnType<typeof createEventRequestFromManualForm>;
        acceptedEventSpec: AcceptedEventSpec;
      }>(intakeResponse);
      const decisionResponse = await intakeApp.inject({
        method: "PATCH",
        url: `/v1/intake/specs/${intakePayload.acceptedEventSpec.specId}`,
        headers: trustedHeaders("intake_operator"),
        payload: {
          componentUpdates: intakePayload.acceptedEventSpec.menuPlan.map((component) => ({
            componentId: component.componentId,
            productionMode: "scratch",
            notes: "Operatorentscheidung aus dem Rehearsal: interne Rezeptbibliothek nutzen."
          }))
        }
      });
      const acceptedEventSpec = (await expectJsonResponse<{ acceptedEventSpec: AcceptedEventSpec }>(decisionResponse)).acceptedEventSpec;
      const syntheticRequest = intakePayload.eventRequest;
      expect(syntheticRequest.rawInputs[0]?.content).toContain("Synthetischer Rehearsal-Fall");
      expect(acceptedEventSpec.menuPlan.every((component) => component.productionDecision?.mode === "scratch")).toBe(true);

      const offerCaseResponse = await offerApp.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: trustedHeaders("offer_operator"),
        payload: { eventTypeLabel: "Business Lunch", attendeeCount: 80 }
      });
      const offerCaseId = await expectJsonResponse<{ case: { caseId: string } }>(offerCaseResponse)
        .then((body) => body.case.caseId);

      const draft = await expectJsonResponse<OfferDraft>(
        await offerApp.inject({
          method: "POST",
          url: "/v1/offers/drafts",
          headers: trustedHeaders("offer_operator"),
          payload: { ...syntheticRequest, caseId: offerCaseId, acceptedEventSpecId: acceptedEventSpec.specId }
        })
      );

      expect(draft.draftId).toMatch(/^draft-spec-manual-/);
      expect(draft.proposedEventSpec.attendees.expected).toBe(80);
      expect(draft.proposedEventSpec.menuPlan.map((component) => component.label)).toEqual(
        expect.arrayContaining(["Vegetarische Tomatensuppe", "Mystery Bowl"])
      );
      expect(draft.variantSet.length).toBeGreaterThan(0);
      expect(draft.pricingSummary.notes?.join(" ")).toContain("Calculated for 80 attendees.");

      const approval = await expectJsonResponse<{ approvedOffer: { approvedOfferId: string } }>(
        await offerApp.inject({
          method: "POST",
          url: `/v1/offers/drafts/${draft.draftId}/decision`,
          headers: trustedHeaders("offer_operator"),
          payload: {
            decision: "approved",
            revision: 1,
            variantId: "variant-2"
          }
        })
      );
      const handoffResponse = await expectJsonResponse<{ handoff: { handoffId: string; eventSpecSnapshot: AcceptedEventSpec } }>(
        await offerApp.inject({ method: "POST", url: `/v1/offers/approved/${approval.approvedOffer.approvedOfferId}/handoffs`, headers: trustedHeaders("offer_operator"), payload: {} })
      );
      const promotedSpec = handoffResponse.handoff.eventSpecSnapshot;
      expect(promotedSpec.lifecycle.commercialState).toBe("accepted");
      expect(promotedSpec.attendees.expected).toBe(80);
      const tomatoComponentId = promotedSpec.menuPlan.find((component) => component.label === "Vegetarische Tomatensuppe")?.componentId;
      const mysteryComponentId = promotedSpec.menuPlan.find((component) => component.label === "Mystery Bowl")?.componentId;
      expect(tomatoComponentId).toBeTruthy();
      expect(mysteryComponentId).toBeTruthy();

      const productionSpec = promotedSpec;
      const artifacts = await expectJsonResponse<ProductionArtifactsResponse>(
        await runApprovedProductionWorkflow(productionApp, {
          headers: trustedHeaders("production_operator"),
          handoffId: handoffResponse.handoff.handoffId,
          payload: {
            eventSpec: productionSpec
          }
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
      expect(productionPlan.kitchenSheets.map((sheet) => sheet.componentId)).toEqual(
        expect.arrayContaining([tomatoComponentId, mysteryComponentId])
      );
      expect(productionPlan.recipeSelections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            componentId: tomatoComponentId,
            recipeId: "critical-path-tomato-soup",
            sourceTier: "internal_verified",
            autoUsedInternetRecipe: false
          }),
          expect.objectContaining({
            componentId: mysteryComponentId,
            autoUsedInternetRecipe: false
          })
        ])
      );
      expect(productionPlan.unresolvedItems.join(" ")).toContain("Mystery Bowl");
      expect(productionPlan.componentReadiness).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            componentId: tomatoComponentId,
            status: "operational",
            includedInPurchaseList: true
          }),
          expect.objectContaining({
            componentId: mysteryComponentId,
            status: "blocked",
            includedInPurchaseList: false
          })
        ])
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
        url: `/v1/exports/offers/${draft.draftId}/html`,
        headers: trustedHeaders("offer_operator")
      });
      expect(offerExport.statusCode).toBe(200);
      expect(offerExport.headers["content-type"]).toContain("text/html");
      expect(offerExport.body).toContain("<h1>Angebot</h1>");
      expect(offerExport.body).not.toContain(draft.draftId);

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
      expect(planExport.body).toContain("Mystery Bowl");

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
