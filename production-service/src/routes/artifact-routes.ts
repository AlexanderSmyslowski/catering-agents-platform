import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import {
  createLlmReadinessAgentAuditRecord,
  findLlmReadinessPromptSchemaEntryByInputKind,
  llmReadinessContractVersion,
  buildProductionClarificationQuestions,
  validateAcceptedEventSpec,
  validateLlmReadinessModelOutputCandidate,
  type AcceptedEventSpec,
  type AuditLogStore,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest,
  type LlmReadinessProviderAdapterResponse,
  type ProductionClarificationQuestion,
  type TrustedActor
} from "@catering/shared-core";
import type { IntakeStore } from "@catering/intake-service";
import type { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import type {
  ClarificationDraft,
  ClarificationDraftQuestion,
  ProductionStore
} from "../repositories/production-store.js";
import { buildProductionArtifacts } from "../rules/planning.js";

export interface ProductionArtifactRouteDependencies {
  store: ProductionStore;
  intakeStore: IntakeStore;
  discoveryService: RecipeDiscoveryService;
  auditLog: AuditLogStore;
  buildLlmAdapter: () => LlmReadinessProviderAdapter;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  isProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
  requireProductionOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => unknown | undefined;
  actorForRequest: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => TrustedActor;
}

function blockingProductionClarificationQuestions(eventSpec: AcceptedEventSpec): ProductionClarificationQuestion[] {
  return buildProductionClarificationQuestions({
    spec: eventSpec as unknown as Record<string, unknown>
  }).filter((question) => question.blocking);
}

function responseQuestion(question: ProductionClarificationQuestion) {
  return {
    questionId: question.questionId,
    prompt: question.prompt,
    reason: question.reason,
    reasonCode: question.reasonCode
  };
}

export function registerProductionArtifactRoutes(
  app: FastifyInstance,
  deps: ProductionArtifactRouteDependencies
) {
  const {
    store,
    intakeStore,
    discoveryService,
    auditLog,
    buildLlmAdapter,
    trustedActorSecret,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    actorForRequest
  } = deps;

  app.post<{ Body: { eventSpec: AcceptedEventSpec } }>("/v1/production/plans", async (request, reply) => {
    if (!isProductionOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Produktions-Operator erforderlich."
      });
    }

    const eventSpec = validateAcceptedEventSpec(request.body.eventSpec);
    const blockingQuestions = blockingProductionClarificationQuestions(eventSpec);
    if (blockingQuestions.length > 0) {
      await auditLog.log({
        action: "production.plan_blocked_by_clarification",
        entityType: "AcceptedEventSpec",
        entityId: eventSpec.specId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        summary: "Produktionsplanung wegen blockierender Rückfragen gestoppt.",
        details: {
          specId: eventSpec.specId,
          blockingQuestionCount: blockingQuestions.length,
          blockingQuestionIds: blockingQuestions.map((question) => question.questionId).join(",")
        }
      });
      return reply.code(409).send({
        message: "Blockierende Rückfragen müssen vor der Produktionsplanung geklärt werden.",
        specId: eventSpec.specId,
        blockingQuestions: blockingQuestions.map(responseQuestion)
      });
    }

    const artifacts = await buildProductionArtifacts(eventSpec, discoveryService);
    await store.savePlan(artifacts.productionPlan);
    await store.savePurchaseList(artifacts.purchaseList);
    await auditLog.log({
      action: "production.plan_created",
      entityType: "ProductionPlan",
      entityId: artifacts.productionPlan.planId,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: "Produktionsplan erstellt.",
      details: {
        specId: eventSpec.specId,
        purchaseListId: artifacts.purchaseList.purchaseListId,
        readiness: artifacts.productionPlan.readiness.status,
        recipeSelections: artifacts.productionPlan.recipeSelections.length
      }
    });
    return reply.code(201).send(artifacts);
  });

  app.get("/v1/production/plans", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listPlans()
    });
  });

  app.get<{ Params: { planId: string } }>("/v1/production/plans/:planId", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const plan = await store.getPlan(request.params.planId);
    if (!plan) {
      return reply.code(404).send({ message: "ProductionPlan nicht gefunden." });
    }

    return reply.send(plan);
  });

  app.get<{ Params: { purchaseListId: string } }>(
    "/v1/production/purchase-lists/:purchaseListId",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const list = await store.getPurchaseList(request.params.purchaseListId);
      if (!list) {
        return reply.code(404).send({ message: "PurchaseList nicht gefunden." });
      }

      return reply.send(list);
    }
  );

  app.get("/v1/production/purchase-lists", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listPurchaseLists()
    });
  });

  app.get<{ Params: { specId: string } }>(
    "/v1/production/specs/:specId/clarification-drafts",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const spec = await intakeStore.getSpec(request.params.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      return reply.send({
        items: await store.listClarificationDrafts(request.params.specId)
      });
    }
  );

  app.post<{ Params: { specId: string } }>(
    "/v1/production/specs/:specId/clarification-drafts",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const spec = await intakeStore.getSpec(request.params.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      const promptSchema = findLlmReadinessPromptSchemaEntryByInputKind("clarification_draft_request");
      if (!promptSchema) {
        return reply.code(500).send({ message: "Prompt-Schema für Rückfragen-Entwurf nicht registriert." });
      }

      const input = buildClarificationDraftInput(spec);
      const adapterRequest: LlmReadinessProviderAdapterRequest = {
        input,
        promptSchemaId: promptSchema.promptSchemaId
      };
      const draftSeed = `draft-${spec.specId}-${randomUUID()}`;
      let adapter: LlmReadinessProviderAdapter;
      try {
        adapter = buildLlmAdapter();
      } catch (error) {
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "BYO-LLM-Adapter konnte nicht gestartet werden."
        });
      }

      const adapterResponse = await adapter.run(adapterRequest);
      const auditBuild = createLlmReadinessAgentAuditRecord({
        auditId: `agent-audit-${draftSeed}`,
        request: adapterRequest,
        response: adapterResponse
      });
      const questionsBuild = questionsFromOutput(adapterResponse.outputCandidate);
      const responseErrors = [
        ...(adapterResponse.ok ? [] : adapterResponse.errors),
        ...questionsBuild.errors,
        ...auditBuild.errors.map((error) => `agentAudit.${error}`)
      ];

      if (!adapterResponse.ok || responseErrors.length > 0 || !questionsBuild.questions || !auditBuild.auditRecord) {
        await auditLog.log({
          action: "production.clarification_draft_rejected",
          entityType: "ClarificationDraft",
          entityId: draftSeed,
          actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
          summary: `KI-Rückfragen-Entwurf für ${spec.specId} verworfen.`,
          details: compactAuditDetails({
            specId: spec.specId,
            inputId: input.inputId,
            adapterId: adapterResponse.adapterId,
            adapterMode: adapterResponse.adapterMode,
            promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
            fixtureId: adapterResponse.fixtureId,
            providerId: adapterResponse.providerId,
            providerRequestId: adapterResponse.providerRequestId,
            errorCount: responseErrors.length
          })
        });
        return reply.code(422).send({
          message: "KI-Rückfragen-Entwurf ist nicht schema-valide.",
          errors: [...new Set(responseErrors)]
        });
      }

      const now = new Date().toISOString();
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const draft: ClarificationDraft = {
        draftId: draftSeed,
        specId: spec.specId,
        questions: questionsBuild.questions,
        status: "pending_review",
        createdAt: now,
        updatedAt: now,
        createdBy: {
          name: actor.name,
          source: actor.source
        },
        modelMetadata: {
          adapterId: adapterResponse.adapterId,
          adapterMode: adapterResponse.adapterMode,
          inputId: input.inputId,
          outputId: adapterResponse.outputCandidate?.outputId,
          outputKind: adapterResponse.outputCandidate?.kind,
          promptSchemaId: adapterResponse.promptSchemaId ?? promptSchema.promptSchemaId,
          fixtureId: adapterResponse.fixtureId,
          providerId: adapterResponse.providerId,
          providerRequestId: adapterResponse.providerRequestId
        },
        agentAudit: auditBuild.auditRecord
      };
      await store.saveClarificationDraft(draft);
      await auditLog.log({
        action: "production.clarification_draft_created",
        entityType: "ClarificationDraft",
        entityId: draft.draftId,
        actor,
        summary: `KI-Rückfragen-Entwurf für ${spec.specId} angelegt.`,
        details: compactAuditDetails({
          specId: spec.specId,
          draftId: draft.draftId,
          agentAuditId: auditBuild.auditRecord.auditId,
          inputId: input.inputId,
          outputId: adapterResponse.outputCandidate?.outputId,
          outputTextHash: hashText(questionsBuild.questions.map((question) => question.text).join("\n")),
          adapterId: adapterResponse.adapterId,
          adapterMode: adapterResponse.adapterMode,
          promptSchemaId: draft.modelMetadata.promptSchemaId,
          fixtureId: adapterResponse.fixtureId,
          providerId: adapterResponse.providerId,
          providerRequestId: adapterResponse.providerRequestId,
          humanApprovalRequired: true,
          writesProductObject: false
        })
      });

      return reply.code(201).send({ draft });
    }
  );

  app.post<{ Params: { draftId: string }; Body: { approve?: unknown } }>(
    "/v1/production/clarification-drafts/:draftId/decision",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      if (typeof request.body?.approve !== "boolean") {
        return reply.code(400).send({ message: "approve muss true oder false sein." });
      }

      const draft = await store.getClarificationDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ClarificationDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ClarificationDraft wurde bereits entschieden." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const now = new Date().toISOString();
      const decidedDraft: ClarificationDraft = {
        ...draft,
        status: request.body.approve ? "approved" : "rejected",
        updatedAt: now,
        decidedAt: now,
        decisionBy: {
          name: actor.name,
          source: actor.source
        }
      };

      let acceptedEventSpec: AcceptedEventSpec | undefined;
      if (request.body.approve) {
        const spec = await intakeStore.getSpec(draft.specId);
        if (!spec) {
          return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
        }
        acceptedEventSpec = applyApprovedDraftToSpec(spec, draft);
        await intakeStore.saveSpec(acceptedEventSpec);
      }

      await store.saveClarificationDraft(decidedDraft);
      await auditLog.log({
        action: request.body.approve
          ? "production.clarification_draft_approved"
          : "production.clarification_draft_rejected_by_operator",
        entityType: "ClarificationDraft",
        entityId: draft.draftId,
        actor,
        summary: request.body.approve
          ? `KI-Rückfragen-Entwurf für ${draft.specId} übernommen.`
          : `KI-Rückfragen-Entwurf für ${draft.specId} verworfen.`,
        details: compactAuditDetails({
          specId: draft.specId,
          draftId: draft.draftId,
          questionCount: draft.questions.length,
          status: decidedDraft.status,
          outputTextHash: hashText(draft.questions.map((question) => question.text).join("\n"))
        })
      });

      return reply.send({
        draft: decidedDraft,
        ...(acceptedEventSpec ? { acceptedEventSpec } : {})
      });
    }
  );
}

function buildClarificationDraftInput(spec: AcceptedEventSpec): LlmReadinessModelInput {
  return {
    contractVersion: llmReadinessContractVersion,
    inputId: `input-${spec.specId}-clarification-draft`,
    kind: "clarification_draft_request",
    sourceRefs: [
      {
        objectType: "accepted_event_spec",
        objectId: spec.specId,
        label: "accepted event spec"
      }
    ],
    policy: {
      providerCalls: "disabled",
      dataMode: "synthetic_or_demo_only",
      allowedToolEffects: ["read", "draft"]
    }
  };
}

function questionsFromOutput(outputCandidate?: LlmReadinessModelOutputCandidate): {
  questions?: ClarificationDraftQuestion[];
  errors: string[];
} {
  const errors = validateLlmReadinessModelOutputCandidate(outputCandidate).errors.map((error) =>
    `outputCandidate.${error}`
  );
  if (!outputCandidate) {
    return { errors };
  }

  if (outputCandidate.kind !== "clarification_question_draft") {
    errors.push("outputCandidate.kind must be clarification_question_draft");
  }
  if (outputCandidate.humanApprovalRequired !== true) {
    errors.push("outputCandidate.humanApprovalRequired must be true");
  }
  if (outputCandidate.writesProductObject !== false) {
    errors.push("outputCandidate.writesProductObject must be false");
  }

  const text = outputCandidate.text.trim();
  const reason = outputCandidate.structuredCandidate?.reason;
  const reasonCode = outputCandidate.structuredCandidate?.reasonCode;
  if (!text) {
    errors.push("outputCandidate.text must be non-empty");
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    errors.push("outputCandidate.structuredCandidate.reason must be a non-empty string");
  }
  if (typeof reasonCode !== "string" || reasonCode.trim().length === 0) {
    errors.push("outputCandidate.structuredCandidate.reasonCode must be a non-empty string");
  }

  if (errors.length > 0 || typeof reason !== "string" || typeof reasonCode !== "string") {
    return { errors: [...new Set(errors)] };
  }

  return {
    questions: [
      {
        text,
        reason: reason.trim(),
        reasonCode: reasonCode.trim()
      }
    ],
    errors: []
  };
}

function applyApprovedDraftToSpec(spec: AcceptedEventSpec, draft: ClarificationDraft): AcceptedEventSpec {
  const existing = spec.uncertainties ?? [];
  const additions = draft.questions.map((question) => ({
    field: question.reasonCode,
    message: `KI-Rückfragen-Entwurf: ${question.reason}`,
    severity: "medium" as const,
    suggestedQuestion: question.text
  }));
  const deduped = new Map<string, (typeof additions)[number] | (typeof existing)[number]>();

  for (const uncertainty of [...existing, ...additions]) {
    deduped.set(
      [uncertainty.field, uncertainty.suggestedQuestion ?? uncertainty.message].join("::"),
      uncertainty
    );
  }

  return {
    ...spec,
    uncertainties: [...deduped.values()]
  };
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compactAuditDetails(details: Record<string, string | number | boolean | undefined>) {
  return Object.fromEntries(
    Object.entries(details).filter((entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined
    )
  );
}
