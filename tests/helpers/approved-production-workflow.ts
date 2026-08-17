import { type AcceptedEventSpec, type ProductionDraft } from "@catering/shared-core";
import { buildProductionApp } from "@catering/production-service";
import { testIntakeRecordsPortFor } from "../support/in-memory-intake-records-port.js";

type InjectInput = {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  payload?: unknown;
};

type InjectResponse = {
  statusCode: number;
  body: string;
  json: () => any;
};

type InjectableApp = ReturnType<typeof buildProductionApp>;

export const APPROVED_PRODUCTION_TEST_SECRET = "approved-production-workflow-test-secret";

export async function runApprovedProductionWorkflow(
  app: InjectableApp,
  input: {
    headers?: Record<string, string>;
    payload?: { eventSpec?: AcceptedEventSpec; sourceReviewConfirmed?: boolean };
  }
): Promise<InjectResponse> {
  const eventSpec = input.payload?.eventSpec;
  if (!eventSpec) throw new Error("Approved production test workflow requires an eventSpec.");

  app.setQuantityRecipeBridgeResolver(({ eventSpec, component, recipe, servings }) => ({
    status: "ready_for_scaling",
    eventSpecId: eventSpec.specId,
    componentId: component.componentId,
    recipeId: recipe.recipeId,
    targetOutput: { amount: servings, unit: "servings" },
    targetServings: servings,
    conversionMethod: "direct_servings",
    issues: []
  }));

  try {
    const headers: Record<string, string> = {
      "x-actor-name": "Produktions-Mitarbeiter",
      "x-catering-actor-name": "Produktions-Mitarbeiter",
      "x-catering-trusted-secret": APPROVED_PRODUCTION_TEST_SECRET,
      ...input.headers
    };
    const businessId = headers["x-catering-business-id"] ?? "local";
    await testIntakeRecordsPortFor(app).insertSpec({ businessId }, eventSpec);
    const caseResponse = await app.inject({
      method: "POST",
      url: "/v1/production/cases",
      headers,
      payload: {
        eventTypeLabel: eventSpec.servicePlan.eventType,
        attendeeCount: eventSpec.attendees.expected
      }
    });
    if (caseResponse.statusCode !== 201) return caseResponse;
    const caseId = caseResponse.json().case.caseId as string;
    const imported = await app.inject({
      method: "POST",
      url: "/v1/production/drafts",
      headers,
      payload: { caseId, specId: eventSpec.specId }
    });
    if (imported.statusCode !== 201) return imported;

    const sourceDraft = imported.json().draft as ProductionDraft;
    const preparedResponse = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/${sourceDraft.draftId}/prepare`,
      headers,
      payload: {}
    });
    if (preparedResponse.statusCode !== 201) return preparedResponse;
    const prepared = preparedResponse.json().draft as ProductionDraft;

    for (const card of prepared.reviewCards) {
      const reviewed = await app.inject({
        method: "PATCH",
        url: `/v1/production/drafts/${prepared.draftId}/review-cards/${card.cardId}`,
        headers,
        payload: { decision: "fits" }
      });
      if (reviewed.statusCode !== 200) return reviewed;
    }

    const decision = await app.inject({
      method: "POST",
      url: `/v1/production/drafts/${prepared.draftId}/decision`,
      headers,
      payload: { decision: "approved" }
    });
    if (decision.statusCode !== 201) return decision;
    const approvedProductionSpecId = decision.json().approvedProductionSpec.approvedProductionSpecId as string;
    const applied = await app.inject({
      method: "POST",
      url: `/v1/production/approved-specs/${approvedProductionSpecId}/apply`,
      headers,
      payload: {}
    });
    if (applied.statusCode !== 200) return applied;

    const canonical = applied.json();
    const legacyTestView = {
      eventSpec: canonical.eventSpec,
      productionPlan: canonical.plan,
      purchaseList: canonical.purchaseList,
      recipes: canonical.recipes
    };
    return {
      ...applied,
      statusCode: 201,
      body: JSON.stringify(legacyTestView),
      json: () => legacyTestView
    };
  } finally {
    app.setQuantityRecipeBridgeResolver(undefined);
  }
}
