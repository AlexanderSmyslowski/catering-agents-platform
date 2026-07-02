import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import {
  createLlmReadinessAgentAuditRecord,
  findLlmReadinessPromptSchemaEntryByInputKind,
  llmReadinessContractVersion,
  validateAcceptedEventSpec,
  validateLlmReadinessModelOutputCandidate,
  validateProductionDraft,
  validateProductionPlan,
  validatePurchaseList,
  validateRecipe,
  type AcceptedEventSpec,
  type AuditLogStore,
  type LlmReadinessModelInput,
  type LlmReadinessModelOutputCandidate,
  type LlmReadinessProviderAdapter,
  type LlmReadinessProviderAdapterRequest,
  type LlmReadinessProviderAdapterResponse,
  type ProductionDraft,
  type ProductionDraftReviewDecision,
  type ProductionPlan,
  type PurchaseList,
  type Recipe,
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

const operatorProductionDraftReviewDecisions = [
  "fits",
  "change_requested",
  "unclear",
  "blocked"
] as const satisfies readonly Exclude<ProductionDraftReviewDecision, "pending">[];

function sourceLineageRequestIds(eventSpec: AcceptedEventSpec): string[] {
  const ids = new Set<string>();

  for (const source of eventSpec.sourceLineage) {
    const reference = source.reference.trim();
    if (reference) {
      ids.add(reference);
    }
  }

  return [...ids];
}

function hasUnsafeDocumentIngestion(
  rawInputs: Array<{ documentIngestion?: { status?: string; warnings?: string[] } }>
): boolean {
  return rawInputs.some((rawInput) => {
    const status = rawInput.documentIngestion?.status?.trim();
    const warnings = Array.isArray(rawInput.documentIngestion?.warnings)
      ? rawInput.documentIngestion.warnings.map((warning) => warning.trim()).filter(Boolean)
      : [];

    return status === "fallback" || status === "failed" || warnings.length > 0;
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function productionDraftImportValidationMessage(errorMessage: string): string {
  if (errorMessage.includes("review coverage missing")) {
    return "ProductionDraft deckt nicht alle übernehmbaren Artefakte mit Review-Karten ab.";
  }

  return "ProductionDraft ist nicht schema-valide.";
}

async function assertNoDifferentExistingArtifact<T>(
  existing: T | undefined,
  next: T,
  label: string,
  id: string
): Promise<string | undefined> {
  if (!existing || stableJson(existing) === stableJson(next)) {
    return undefined;
  }

  return `${label} ${id} existiert bereits mit abweichendem Inhalt.`;
}

function validateDraftApplyArtifacts(draft: ProductionDraft): {
  eventSpec?: AcceptedEventSpec;
  productionPlan?: ProductionPlan;
  purchaseList?: PurchaseList;
  recipes: Recipe[];
  errors: string[];
} {
  const errors: string[] = [];
  let eventSpec: AcceptedEventSpec | undefined;
  let productionPlan: ProductionPlan | undefined;
  let purchaseList: PurchaseList | undefined;
  const recipes: Recipe[] = [];

  try {
    eventSpec = draft.draftArtifacts.eventSpec
      ? validateAcceptedEventSpec(draft.draftArtifacts.eventSpec)
      : undefined;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "eventSpec ist nicht schema-valide.");
  }

  try {
    productionPlan = draft.draftArtifacts.productionPlan
      ? validateProductionPlan(draft.draftArtifacts.productionPlan)
      : undefined;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "productionPlan ist nicht schema-valide.");
  }

  try {
    purchaseList = draft.draftArtifacts.purchaseList
      ? validatePurchaseList(draft.draftArtifacts.purchaseList)
      : undefined;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "purchaseList ist nicht schema-valide.");
  }

  for (const recipe of draft.draftArtifacts.recipes ?? []) {
    try {
      recipes.push(validateRecipe({
        ...recipe,
        source: {
          ...recipe.source,
          approvalState: "review_required"
        }
      }));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `recipe ${recipe.recipeId} ist nicht schema-valide.`);
    }
  }

  const eventSpecId = eventSpec?.specId;
  const planSpecId = productionPlan?.eventSpecId;
  const purchaseSpecId = purchaseList?.eventSpecId;
  if (eventSpecId && planSpecId && eventSpecId !== planSpecId) {
    errors.push("productionPlan.eventSpecId passt nicht zum eventSpec.specId.");
  }
  if (eventSpecId && purchaseSpecId && eventSpecId !== purchaseSpecId) {
    errors.push("purchaseList.eventSpecId passt nicht zum eventSpec.specId.");
  }
  if (planSpecId && purchaseSpecId && planSpecId !== purchaseSpecId) {
    errors.push("productionPlan.eventSpecId passt nicht zur purchaseList.eventSpecId.");
  }
  if (!eventSpec && !productionPlan && !purchaseList && recipes.length === 0) {
    errors.push("ProductionDraft enthält keine übernehmbaren Produktartefakte.");
  }

  return {
    eventSpec,
    productionPlan,
    purchaseList,
    recipes,
    errors
  };
}

async function hasUnsafeLinkedIntakeSource(
  eventSpec: AcceptedEventSpec,
  intakeStore: IntakeStore
): Promise<boolean> {
  for (const requestId of sourceLineageRequestIds(eventSpec)) {
    const intakeRequest = await intakeStore.getRequest(requestId);
    if (intakeRequest && hasUnsafeDocumentIngestion(intakeRequest.rawInputs)) {
      return true;
    }
  }

  return false;
}

interface RecipeCandidateRepository {
  get(recipeId: string): Promise<Recipe | undefined>;
  save(recipe: Recipe): Promise<void>;
}

export interface ProductionArtifactRouteDependencies {
  store: ProductionStore;
  intakeStore: IntakeStore;
  repository: RecipeCandidateRepository;
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

export function registerProductionArtifactRoutes(
  app: FastifyInstance,
  deps: ProductionArtifactRouteDependencies
) {
  const {
    store,
    intakeStore,
    repository,
    discoveryService,
    auditLog,
    buildLlmAdapter,
    trustedActorSecret,
    allowDevActorHeader,
    isProductionOperator,
    requireProductionOperator,
    actorForRequest
  } = deps;

  app.post<{ Body: { eventSpec: AcceptedEventSpec; sourceReviewConfirmed?: boolean } }>(
    "/v1/production/plans",
    async (request, reply) => {
      if (!isProductionOperator(request, trustedActorSecret, allowDevActorHeader)) {
        return reply.code(403).send({
          message: "Produktions-Operator erforderlich."
        });
      }

      const eventSpec = validateAcceptedEventSpec(request.body.eventSpec);
      const sourceReviewRequired = await hasUnsafeLinkedIntakeSource(eventSpec, intakeStore);
      if (sourceReviewRequired && request.body.sourceReviewConfirmed !== true) {
        return reply.code(422).send({
          message: "Quellenprüfung erforderlich, bevor Produktionsartefakte berechnet werden."
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
          recipeSelections: artifacts.productionPlan.recipeSelections.length,
          sourceReviewConfirmed: sourceReviewRequired ? true : undefined
        }
      });
      return reply.code(201).send(artifacts);
    }
  );

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

  app.post<{ Body: ProductionDraft }>("/v1/production/drafts", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    let draft: ProductionDraft;
    try {
      draft = validateProductionDraft(request.body);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Validierungsfehler.";
      return reply.code(422).send({
        message: productionDraftImportValidationMessage(errorMessage),
        errors: [errorMessage]
      });
    }

    if (draft.status !== "pending_review") {
      return reply.code(422).send({
        message: "ProductionDraft-Import akzeptiert nur Entwürfe im Status pending_review.",
        errors: ["status must be pending_review for draft-only import"]
      });
    }
    if (await store.getProductionDraft(draft.draftId)) {
      return reply.code(409).send({
        message: "ProductionDraft mit dieser ID existiert bereits."
      });
    }

    await store.saveProductionDraft(draft);
    const artifacts = draft.draftArtifacts;
    await auditLog.log({
      action: "production.production_draft_imported",
      entityType: "ProductionDraft",
      entityId: draft.draftId,
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: "ProductionDraft importiert und zur Review vorgemerkt.",
      details: compactAuditDetails({
        draftId: draft.draftId,
        status: draft.status,
        sourceKind: draft.source.kind,
        providerId: draft.source.providerId,
        modelId: draft.source.modelId,
        inputHash: draft.source.inputHash,
        outputHash: draft.source.outputHash,
        reviewCardCount: draft.reviewCards.length,
        hasEventSpec: Boolean(artifacts.eventSpec),
        hasProductionPlan: Boolean(artifacts.productionPlan),
        hasPurchaseList: Boolean(artifacts.purchaseList),
        recipeCount: artifacts.recipes?.length ?? 0,
        openQuestionCount: artifacts.openQuestions?.length ?? 0,
        noteCount: artifacts.notes?.length ?? 0,
        humanApprovalRequired: draft.guardrails.humanApprovalRequired,
        writesProductObject: draft.guardrails.writesProductObjects
      })
    });

    return reply.code(201).send({ draft });
  });

  app.get("/v1/production/drafts", async (request, reply) => {
    const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listProductionDrafts()
    });
  });

  app.patch<{
    Params: { draftId: string; cardId: string };
    Body: { decision?: unknown; operatorComment?: unknown };
  }>(
    "/v1/production/drafts/:draftId/review-cards/:cardId",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const decision = productionDraftReviewDecisionFromBody(request.body?.decision);
      if (!decision) {
        return reply.code(400).send({
          message: "decision muss fits, change_requested, unclear oder blocked sein."
        });
      }

      const operatorComment = operatorCommentFromBody(request.body?.operatorComment);
      if (operatorComment === false) {
        return reply.code(400).send({
          message: "operatorComment muss Text mit maximal 1000 Zeichen sein."
        });
      }

      const draft = await store.getProductionDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ProductionDraft wurde bereits entschieden." });
      }

      const cardIndex = draft.reviewCards.findIndex((card) => card.cardId === request.params.cardId);
      if (cardIndex < 0) {
        return reply.code(404).send({ message: "Review-Karte nicht gefunden." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const decidedAt = new Date().toISOString();
      const reviewCards = draft.reviewCards.map((card, index) =>
        index === cardIndex
          ? {
            ...card,
            decision,
            decidedBy: actor.name,
            decidedAt,
            ...(operatorComment ? { operatorComment } : {})
          }
          : card
      );
      const reviewedDraft = validateProductionDraft({
        ...draft,
        reviewCards
      });

      await store.saveProductionDraft(reviewedDraft);
      const card = reviewedDraft.reviewCards[cardIndex];
      await auditLog.log({
        action: "production.production_draft_review_card_decided",
        entityType: "ProductionDraft",
        entityId: reviewedDraft.draftId,
        actor,
        summary: "ProductionDraft-Review-Karte entschieden.",
        details: compactAuditDetails({
          draftId: reviewedDraft.draftId,
          cardId: card.cardId,
          cardKind: card.kind,
          decision: card.decision,
          targetId: card.targetId,
          riskLevel: card.riskLevel,
          requiredApproval: card.requiredApproval
        })
      });

      return reply.send({
        draft: reviewedDraft,
        reviewCard: card
      });
    }
  );

  app.post<{ Params: { draftId: string }; Body: { approve?: unknown } }>(
    "/v1/production/drafts/:draftId/decision",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      if (typeof request.body?.approve !== "boolean") {
        return reply.code(400).send({ message: "approve muss true oder false sein." });
      }

      const draft = await store.getProductionDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      }
      if (draft.status !== "pending_review") {
        return reply.code(409).send({ message: "ProductionDraft wurde bereits entschieden." });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const decidedAt = new Date().toISOString();
      let decidedDraft: ProductionDraft;
      if (request.body.approve) {
        const openCards = draft.reviewCards.filter((card) => card.decision !== "fits");
        const blockingCards = draft.reviewCards.filter((card) => card.riskLevel === "blocking");
        if (openCards.length > 0 || blockingCards.length > 0) {
          return reply.code(422).send({
            message: "ProductionDraft kann erst freigegeben werden, wenn alle Review-Karten passen und keine Blocking-Risiken offen sind.",
            errors: [
              ...openCards.map((card) => `reviewCard ${card.cardId} is ${card.decision}`),
              ...blockingCards.map((card) => `reviewCard ${card.cardId} has blocking risk`)
            ]
          });
        }
        decidedDraft = validateProductionDraft({
          ...draft,
          status: "approved",
          approvedBy: actor.name,
          approvedAt: decidedAt
        });
      } else {
        decidedDraft = validateProductionDraft({
          ...draft,
          status: "rejected"
        });
      }

      await store.saveProductionDraft(decidedDraft);
      await auditLog.log({
        action: request.body.approve
          ? "production.production_draft_approved"
          : "production.production_draft_rejected",
        entityType: "ProductionDraft",
        entityId: decidedDraft.draftId,
        actor,
        summary: request.body.approve
          ? "ProductionDraft nach Review freigegeben."
          : "ProductionDraft nach Review verworfen.",
        details: compactAuditDetails({
          draftId: decidedDraft.draftId,
          status: decidedDraft.status,
          reviewCardCount: decidedDraft.reviewCards.length,
          fittingReviewCardCount: decidedDraft.reviewCards.filter((card) => card.decision === "fits").length,
          blockingReviewCardCount: decidedDraft.reviewCards.filter((card) => card.riskLevel === "blocking").length,
          humanApprovalRequired: decidedDraft.guardrails.humanApprovalRequired,
          writesProductObject: decidedDraft.guardrails.writesProductObjects
        })
      });

      return reply.send({ draft: decidedDraft });
    }
  );

  app.post<{ Params: { draftId: string } }>(
    "/v1/production/drafts/:draftId/apply",
    async (request, reply) => {
      const forbidden = requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) {
        return forbidden;
      }

      const draft = await store.getProductionDraft(request.params.draftId);
      if (!draft) {
        return reply.code(404).send({ message: "ProductionDraft nicht gefunden." });
      }
      if (draft.status !== "approved") {
        return reply.code(409).send({ message: "ProductionDraft muss vor der Übernahme freigegeben sein." });
      }
      if (draft.appliedAt) {
        return reply.code(409).send({ message: "ProductionDraft wurde bereits übernommen." });
      }

      const artifacts = validateDraftApplyArtifacts(draft);
      if (artifacts.errors.length > 0) {
        return reply.code(422).send({
          message: "ProductionDraft kann nicht übernommen werden.",
          errors: artifacts.errors
        });
      }

      const conflictErrors = [
        artifacts.eventSpec
          ? await assertNoDifferentExistingArtifact(
            await intakeStore.getSpec(artifacts.eventSpec.specId),
            artifacts.eventSpec,
            "AcceptedEventSpec",
            artifacts.eventSpec.specId
          )
          : undefined,
        artifacts.productionPlan
          ? await assertNoDifferentExistingArtifact(
            await store.getPlan(artifacts.productionPlan.planId),
            artifacts.productionPlan,
            "ProductionPlan",
            artifacts.productionPlan.planId
          )
          : undefined,
        artifacts.purchaseList
          ? await assertNoDifferentExistingArtifact(
            await store.getPurchaseList(artifacts.purchaseList.purchaseListId),
            artifacts.purchaseList,
            "PurchaseList",
            artifacts.purchaseList.purchaseListId
          )
          : undefined,
        ...(await Promise.all(artifacts.recipes.map(async (recipe) =>
          assertNoDifferentExistingArtifact(
            await repository.get(recipe.recipeId),
            recipe,
            "Recipe",
            recipe.recipeId
          )
        )))
      ].filter((error): error is string => Boolean(error));

      if (conflictErrors.length > 0) {
        return reply.code(409).send({
          message: "ProductionDraft-Übernahme würde bestehende Produktobjekte überschreiben.",
          errors: conflictErrors
        });
      }

      if (artifacts.eventSpec) {
        await intakeStore.saveSpec(artifacts.eventSpec);
      }
      if (artifacts.productionPlan) {
        await store.savePlan(artifacts.productionPlan);
      }
      if (artifacts.purchaseList) {
        await store.savePurchaseList(artifacts.purchaseList);
      }
      for (const recipe of artifacts.recipes) {
        await repository.save(recipe);
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const appliedAt = new Date().toISOString();
      const appliedArtifactIds = {
        ...(artifacts.eventSpec ? { specId: artifacts.eventSpec.specId } : {}),
        ...(artifacts.productionPlan ? { planId: artifacts.productionPlan.planId } : {}),
        ...(artifacts.purchaseList ? { purchaseListId: artifacts.purchaseList.purchaseListId } : {}),
        ...(artifacts.recipes.length > 0 ? { recipeIds: artifacts.recipes.map((recipe) => recipe.recipeId) } : {})
      };
      const appliedDraft = validateProductionDraft({
        ...draft,
        appliedBy: actor.name,
        appliedAt,
        appliedArtifactIds
      });
      await store.saveProductionDraft(appliedDraft);
      await auditLog.log({
        action: "production.production_draft_applied",
        entityType: "ProductionDraft",
        entityId: appliedDraft.draftId,
        actor,
        summary: "Freigegebener ProductionDraft in Produktobjekte übernommen.",
        details: compactAuditDetails({
          draftId: appliedDraft.draftId,
          specId: artifacts.eventSpec?.specId,
          planId: artifacts.productionPlan?.planId,
          purchaseListId: artifacts.purchaseList?.purchaseListId,
          hasEventSpec: Boolean(artifacts.eventSpec),
          hasProductionPlan: Boolean(artifacts.productionPlan),
          hasPurchaseList: Boolean(artifacts.purchaseList),
          recipeCandidateCount: artifacts.recipes.length,
          skippedOpenQuestionCount: draft.draftArtifacts.openQuestions?.length ?? 0,
          writesProductObject: true,
          rawProviderPayloadStored: false
        })
      });

      return reply.send({
        draft: appliedDraft,
        applied: appliedDraft.appliedArtifactIds
      });
    }
  );

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

function productionDraftReviewDecisionFromBody(
  value: unknown
): Exclude<ProductionDraftReviewDecision, "pending"> | undefined {
  return typeof value === "string" &&
    operatorProductionDraftReviewDecisions.includes(value as Exclude<ProductionDraftReviewDecision, "pending">)
    ? value as Exclude<ProductionDraftReviewDecision, "pending">
    : undefined;
}

function operatorCommentFromBody(value: unknown): string | false | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.length <= 1000 ? trimmed : false;
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
