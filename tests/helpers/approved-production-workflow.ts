import { createHash } from "node:crypto";
import { SCHEMA_VERSION, type AcceptedEventSpec, type ProductionDraft } from "@catering/shared-core";
import { buildProductionApp } from "@catering/production-service";

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

let workflowSequence = 0;
export const APPROVED_PRODUCTION_TEST_SECRET = "approved-production-workflow-test-secret";

function workflowDraft(eventSpec: AcceptedEventSpec, businessId: string): ProductionDraft {
  workflowSequence += 1;
  const suffix = createHash("sha256")
    .update(`${eventSpec.specId}:${workflowSequence}`)
    .digest("hex")
    .slice(0, 20);
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    businessId,
    draftId: `production-draft-test-workflow-${suffix}`,
    revision: 1,
    status: "pending_review",
    createdAt: now,
    source: {
      kind: "fixture",
      receivedAt: now,
      sourceRef: "test:approved-production-workflow"
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [{
      cardId: "card-test-event-spec",
      kind: "event_data",
      title: "Eventdaten prüfen",
      summary: "Testworkflow prüft den Event-Snapshot.",
      decision: "pending",
      targetPath: "$.draftArtifacts.eventSpec",
      targetId: eventSpec.specId,
      requiredApproval: true
    }],
    draftArtifacts: { eventSpec }
  };
}

export async function runApprovedProductionWorkflow(
  app: InjectableApp,
  input: {
    headers?: Record<string, string>;
    payload?: { eventSpec?: AcceptedEventSpec; sourceReviewConfirmed?: boolean };
  }
): Promise<InjectResponse> {
  const eventSpec = input.payload?.eventSpec;
  if (!eventSpec) throw new Error("Approved production test workflow requires an eventSpec.");
  const headers: Record<string, string> = {
    "x-actor-name": "Produktions-Mitarbeiter",
    "x-catering-actor-name": "Produktions-Mitarbeiter",
    "x-catering-trusted-secret": APPROVED_PRODUCTION_TEST_SECRET,
    ...input.headers
  };
  const businessId = headers["x-catering-business-id"] ?? "local";
  const imported = await app.inject({
    method: "POST",
    url: "/v1/production/drafts",
    headers,
    payload: workflowDraft(eventSpec, businessId)
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
}
