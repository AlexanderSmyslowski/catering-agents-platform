import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type {
  AuditLogStore,
  ProductionScalingRule,
  QuantityDecisionInput,
  QuantityRecommendationInput,
  Recipe,
  RecipeOutputMapping,
  TrustedActor
} from "@catering/shared-core";
import { registerProductionQuantityWorkflowRoutes } from "../production-service/src/routes/quantity-workflow-routes.js";
import type { QuantityWorkflowRuntimeComponent } from "../production-service/src/quantity-workflow/runtime.js";

const actor: TrustedActor = {
  businessId: "business-the-one",
  name: "Alexander",
  source: "dev-header:x-actor-name",
  trusted: false
};

function recipe(): Recipe {
  return {
    schemaVersion: "1.0.0",
    recipeId: "recipe-roastbeef",
    name: "Roastbeef",
    source: {
      tier: "internal_verified",
      originType: "internal_db",
      reference: "THE ONE",
      retrievedAt: "2026-08-17T10:00:00.000Z",
      approvalState: "approved_internal",
      qualityScore: 1,
      fitScore: 1,
      extractionCompleteness: 1
    },
    baseYield: { servings: 10, unit: "servings" },
    ingredients: [
      { ingredientId: "roastbeef", name: "Roastbeef", quantity: { amount: 550, unit: "g" }, group: "Fleisch" },
      { ingredientId: "salt", name: "Salz", quantity: { amount: 8, unit: "g" }, group: "Gewürze" }
    ],
    steps: [{ index: 1, instruction: "Produzieren." }],
    scalingRules: { defaultLossFactor: 0.15, batchSize: 25 },
    allergens: [],
    dietTags: []
  };
}

function authority(): QuantityDecisionInput {
  return {
    decisionId: "quantity-current",
    eventSpecId: "event-1",
    componentId: "roastbeef",
    guestCount: 50,
    serviceFormat: "buffet",
    dishRole: "main",
    basis: "per_person_weight",
    perUnitAmount: 55,
    perUnitUnit: "g",
    targetAmount: 2750,
    targetUnit: "g",
    rationale: "Freigegebene Eventmenge.",
    evidence: { kind: "operator_instruction", reference: "approved-event" },
    reviewStatus: "approved"
  };
}

function recommendation(): QuantityRecommendationInput {
  return {
    decisionId: "recommendation-1",
    eventSpecId: "event-1",
    componentId: "roastbeef",
    guestCount: 50,
    serviceFormat: "buffet",
    dishRole: "main",
    basis: "per_person_weight",
    evidence: [{
      evidenceId: "professional-1",
      sourceKind: "professional_reference",
      reference: "Professional Catering Reference",
      dishRole: "main",
      serviceFormats: ["buffet"],
      basis: "per_person_weight",
      unit: "g",
      minAmount: 50,
      preferredAmount: 55,
      maxAmount: 65,
      rationale: "Professioneller Korridor."
    }]
  };
}

function mapping(): RecipeOutputMapping {
  return {
    recipeId: "recipe-roastbeef",
    outputAmount: 550,
    outputUnit: "g",
    recipeServings: 10,
    reviewedBy: "chef",
    reviewedAt: "2026-08-17T10:00:00.000Z"
  };
}

function rule(): ProductionScalingRule {
  return {
    ruleId: "salt-large-batch",
    recipeId: "recipe-roastbeef",
    ingredientId: "salt",
    minServings: 50,
    maxServings: 60,
    model: { kind: "factor", factor: 0.8 },
    rationale: "Nichtlinear erprobt.",
    supportingObservationIds: ["obs-1"],
    reviewStatus: "approved",
    approvedBy: "chef",
    approvedAt: "2026-08-17T21:00:00.000Z"
  };
}

function runtime(revision = "revision-1"): QuantityWorkflowRuntimeComponent {
  return {
    caseId: "case-1",
    componentId: "roastbeef",
    revision,
    projectionInput: {
      componentId: "roastbeef",
      label: "Roastbeef",
      recommendationInput: recommendation(),
      currentAuthority: authority(),
      purchaseRows: [{
        rowId: "purchase-roastbeef",
        articleName: "Roastbeef",
        amount: 2750,
        unit: "g",
        lineage: { eventSpecId: "event-1", componentId: "roastbeef", recipeId: "recipe-roastbeef", ingredientId: "roastbeef" }
      }]
    },
    previewInput: {
      eventSpecId: "event-1",
      componentId: "roastbeef",
      recipe: recipe(),
      currentAuthority: authority(),
      outputMapping: mapping(),
      recommendationReference: "recommendation-1",
      productionScalingRules: [rule()]
    }
  };
}

function appFor(input?: { unauthorized?: boolean; revision?: () => string }) {
  const app = Fastify();
  const auditEvents: Array<Record<string, unknown>> = [];
  const auditLog = {
    logFor: async (_context: unknown, event: Record<string, unknown>) => {
      auditEvents.push(event);
      return { ...event, auditId: `audit-${auditEvents.length}`, at: "2026-08-17T22:00:00.000Z", businessId: actor.businessId };
    }
  } as unknown as AuditLogStore;
  registerProductionQuantityWorkflowRoutes(app, {
    auditLog,
    trustedActorSecret: undefined,
    allowDevActorHeader: true,
    requireProductionOperator: (_request, reply) => input?.unauthorized
      ? reply.code(403).send({ error: "forbidden" })
      : undefined,
    actorForRequest: () => actor,
    resolveRuntime: async (_actor, caseId) => caseId === "case-1"
      ? [runtime(input?.revision?.() ?? "revision-1")]
      : []
  });
  return { app, auditEvents };
}

describe("production quantity workflow routes", () => {
  it("reads server-owned quantity projections", async () => {
    const { app } = appFor();
    const response = await app.inject({ method: "GET", url: "/v1/production/cases/case-1/quantity-workflow" });
    expect(response.statusCode).toBe(200);
    expect(response.json().items[0]).toMatchObject({ componentId: "roastbeef", recommendedAmount: 55, status: "recommended" });
  });

  it("creates a side-effect-free preview without mutation audit", async () => {
    const { app, auditEvents } = appFor();
    const response = await app.inject({
      method: "POST",
      url: "/v1/production/cases/case-1/quantity-workflow/roastbeef/preview",
      payload: { edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } }
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.previewId).toMatch(/^quantity-preview-/);
    expect(payload.sourceRevision).toBe("revision-1");
    expect(payload.preview).toMatchObject({ status: "preview_ready", confirmable: true, resultingTarget: { amount: 3000, unit: "g" } });
    expect(auditEvents).toHaveLength(0);
  });

  it("requires production-operator authorization for preview and confirm mutations", async () => {
    const { app } = appFor({ unauthorized: true });
    const preview = await app.inject({
      method: "POST",
      url: "/v1/production/cases/case-1/quantity-workflow/roastbeef/preview",
      payload: { edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } }
    });
    expect(preview.statusCode).toBe(403);
  });

  it("confirms only the exact fingerprinted preview and records mutation audit", async () => {
    const { app, auditEvents } = appFor();
    const previewResponse = await app.inject({
      method: "POST",
      url: "/v1/production/cases/case-1/quantity-workflow/roastbeef/preview",
      payload: { edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } }
    });
    const preview = previewResponse.json();
    const response = await app.inject({
      method: "POST",
      url: "/v1/production/cases/case-1/quantity-workflow/roastbeef/confirm",
      payload: {
        previewId: preview.previewId,
        edit: { origin: "target_output", perUnitAmount: 60, unit: "g" }
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "review_required", override: { componentId: "roastbeef" } });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({ action: "quantity_override_confirmed", entityType: "ProductionQuantityOverride" });
  });

  it("rejects stale previews when the server source revision changes", async () => {
    let revision = "revision-1";
    const { app, auditEvents } = appFor({ revision: () => revision });
    const previewResponse = await app.inject({
      method: "POST",
      url: "/v1/production/cases/case-1/quantity-workflow/roastbeef/preview",
      payload: { edit: { origin: "target_output", perUnitAmount: 60, unit: "g" } }
    });
    const preview = previewResponse.json();
    revision = "revision-2";
    const response = await app.inject({
      method: "POST",
      url: "/v1/production/cases/case-1/quantity-workflow/roastbeef/confirm",
      payload: {
        previewId: preview.previewId,
        edit: { origin: "target_output", perUnitAmount: 60, unit: "g" }
      }
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("quantity_preview_stale");
    expect(auditEvents).toHaveLength(0);
  });
});