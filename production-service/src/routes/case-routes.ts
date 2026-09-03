import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  CaseStoreConflictError,
  copyCaseForNewEvent,
  evaluateQuantityRecipeProductionBridge,
  formatCaseDisplayName,
  formatEventTypeLabel,
  summarizeCase,
  type QuantityDecisionInput,
  type RecipeEventUseReview,
  type RecipeOutputMapping,
  type ProductionCase,
  type TrustedActor
} from "@catering/shared-core";
import type { ProductionHandoffReader } from "../ports/production-handoff-reader.js";
import { InMemoryRecipeRepository } from "../repositories/in-memory-recipe-repository.js";
import {
  productionPlanningEvidenceId,
  type ProductionPlanningEvidence,
  type ProductionStore
} from "../repositories/production-store.js";
import {
  canReadProductionCommercials,
  projectProductionCaseEvent
} from "./production-response-projection.js";

interface ProductionCaseCreateBody {
  customerName?: unknown;
  eventTypeLabel?: unknown;
  eventDate?: unknown;
  attendeeCount?: unknown;
}

interface CaseMessageBody {
  text?: unknown;
  sourceId?: unknown;
}

export interface ProductionCaseRouteDependencies {
  store: ProductionStore;
  repository: InMemoryRecipeRepository;
  handoffReader?: ProductionHandoffReader;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
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

function hasOnlyKeys(value: unknown, allowed: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength = 320): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("Textfeld ist ungültig.");
  const normalized = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maxLength) throw new Error("Textfeld ist ungültig.");
  return normalized;
}

function createInput(body: unknown): {
  customerName?: string;
  eventTypeLabel?: string;
  eventDate?: string;
  attendeeCount?: number;
} {
  if (!hasOnlyKeys(body, ["customerName", "eventTypeLabel", "eventDate", "attendeeCount"])) {
    throw new Error("Auftragsdaten enthalten nicht erlaubte Felder.");
  }
  if (body.attendeeCount !== undefined &&
    (!Number.isSafeInteger(body.attendeeCount) || (body.attendeeCount as number) <= 0)) {
    throw new Error("Teilnehmerzahl ist ungültig.");
  }
  return {
    ...(body.customerName !== undefined ? { customerName: optionalText(body.customerName) } : {}),
    ...(body.eventTypeLabel !== undefined ? { eventTypeLabel: optionalText(body.eventTypeLabel) } : {}),
    ...(body.eventDate !== undefined ? { eventDate: optionalText(body.eventDate, 80) } : {}),
    ...(body.attendeeCount !== undefined ? { attendeeCount: body.attendeeCount as number } : {})
  };
}

function messageInput(body: unknown): { text: string; sourceId?: string } {
  if (!hasOnlyKeys(body, ["text", "sourceId"])) {
    throw new Error("Nachricht enthält nicht erlaubte Felder.");
  }
  const text = optionalText(body.text, 10_000);
  if (!text) throw new Error("Nachrichtentext fehlt.");
  const sourceId = body.sourceId === undefined ? undefined : optionalText(body.sourceId, 240);
  return { text, ...(sourceId ? { sourceId } : {}) };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function samePlanningEvidenceContent(
  left: ProductionPlanningEvidence,
  right: ProductionPlanningEvidence
): boolean {
  const { recordedAt: _leftRecordedAt, ...leftContent } = left;
  const { recordedAt: _rightRecordedAt, ...rightContent } = right;
  return areJsonValuesEqual(leftContent, rightContent);
}

function planningEvidenceBody(value: unknown): {
  draftId: string;
  draftRevision: number;
  componentId: string;
  recipeId: string;
  quantityDecision: QuantityDecisionInput;
  recipeEventUseReview?: RecipeEventUseReview;
  outputMapping?: RecipeOutputMapping;
} | undefined {
  if (!hasOnlyKeys(value, [
    "draftId",
    "draftRevision",
    "componentId",
    "recipeId",
    "quantityDecision",
    "recipeEventUseReview",
    "outputMapping"
  ])) return undefined;
  const body = value as Record<string, unknown>;
  if (
    typeof body.draftId !== "string" || !body.draftId.trim() ||
    !Number.isSafeInteger(body.draftRevision) || (body.draftRevision as number) < 1 ||
    typeof body.componentId !== "string" || !body.componentId.trim() ||
    typeof body.recipeId !== "string" || !body.recipeId.trim() ||
    !isRecord(body.quantityDecision) ||
    (body.recipeEventUseReview !== undefined && !isRecord(body.recipeEventUseReview))
  ) return undefined;
  if (body.outputMapping !== undefined && !isRecord(body.outputMapping)) return undefined;
  return {
    draftId: body.draftId.trim(),
    draftRevision: body.draftRevision as number,
    componentId: body.componentId.trim(),
    recipeId: body.recipeId.trim(),
    quantityDecision: body.quantityDecision as unknown as QuantityDecisionInput,
    ...(body.recipeEventUseReview
      ? { recipeEventUseReview: body.recipeEventUseReview as unknown as RecipeEventUseReview }
      : {}),
      ...(body.outputMapping ? { outputMapping: body.outputMapping as unknown as RecipeOutputMapping } : {})
  };
}

function newProductionCase(
  actor: TrustedActor,
  input: ReturnType<typeof createInput>,
  now: string,
  productionHandoffId?: string,
  caseId = `production-case-${randomUUID()}`
): ProductionCase {
  return {
    schemaVersion: "1.0",
    businessId: actor.businessId,
    caseId,
    product: "production",
    displayName: formatCaseDisplayName({ ...input, fallbackDate: now }),
    status: "open",
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...(productionHandoffId ? { productionHandoffId } : {})
  };
}

function productionCaseIdForHandoff(actor: TrustedActor, handoffId: string): string {
  return `production-case-handoff-${createHash("sha256")
    .update(`${actor.businessId}\0${handoffId}`)
    .digest("hex")}`;
}

export function registerProductionCaseRoutes(
  app: FastifyInstance,
  deps: ProductionCaseRouteDependencies
): void {
  const {
    store,
    repository,
    handoffReader,
    trustedActorSecret,
    allowDevActorHeader,
    requireProductionOperator,
    actorForRequest
  } = deps;
  const actor = (request: { headers: Record<string, string | string[] | undefined> }) =>
    actorForRequest(request, trustedActorSecret, allowDevActorHeader);
  const forbid = (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ) => requireProductionOperator(request, reply, trustedActorSecret, allowDevActorHeader);

  app.get<{ Querystring: { search?: string } }>("/v1/production/cases", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    const query = typeof request.query?.search === "string" ? request.query.search : "";
    return reply.send({ items: (await store.searchCases(actor(request), query)).map(summarizeCase) });
  });

  app.post<{ Body: ProductionCaseCreateBody }>("/v1/production/cases", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    let input: ReturnType<typeof createInput>;
    try {
      input = createInput(request.body);
    } catch (error) {
      return reply.code(422).send({
        message: error instanceof Error ? error.message : "Auftragsdaten sind ungültig."
      });
    }
    const trustedActor = actor(request);
    const productionCase = newProductionCase(trustedActor, input, new Date().toISOString());
    await store.createCase(trustedActor, productionCase);
    return reply.code(201).send({ case: productionCase });
  });

  app.get<{ Params: { caseId: string } }>("/v1/production/cases/:caseId", async (request, reply) => {
    const forbidden = forbid(request, reply);
    if (forbidden) return forbidden;
    const trustedActor = actor(request);
    const productionCase = await store.getCase(trustedActor, request.params.caseId);
    if (!productionCase) return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
    return reply.send({
      case: productionCase,
      events: (await store.listEvents(trustedActor, productionCase.caseId))
        .map((event) => projectProductionCaseEvent(trustedActor, event))
    });
  });

  app.post<{ Params: { caseId: string }; Body: Record<string, never> }>(
    "/v1/production/cases/:caseId/copies",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      if (!hasOnlyKeys(request.body ?? {}, [])) {
        return reply.code(422).send({ message: "Kopie-Auftrag enthält nicht erlaubte Felder." });
      }
      const trustedActor = actor(request);
      const source = await store.getCase(trustedActor, request.params.caseId);
      if (!source) return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
      const copy = copyCaseForNewEvent(source, {
        caseId: `production-case-${randomUUID()}`,
        now: new Date().toISOString()
      });
      await store.createCase(trustedActor, copy.case);
      return reply.code(201).send({
        case: copy.case,
        events: await store.listEvents(trustedActor, copy.case.caseId)
      });
    }
  );

  app.post<{ Params: { caseId: string }; Body: unknown }>(
    "/v1/production/cases/:caseId/planning-evidence",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      const input = planningEvidenceBody(request.body);
      if (!input) {
        return reply.code(422).send({ message: "Planungs-Evidenz ist unvollständig oder enthält nicht erlaubte Felder." });
      }
      const trustedActor = actor(request);
      const result = await store.withPlanningEvidenceCriticalSection(
        trustedActor,
        request.params.caseId,
        input.draftId,
        input.draftRevision,
        async (scope) => {
        const productionCase = await scope.getCase(request.params.caseId);
        if (!productionCase) return undefined;
        if (!productionCase.productionHandoffId || !productionCase.sourceSpecId) {
          return { kind: "conflict" as const, message: "Planungs-Evidenz benötigt einen kanonisch handoff-gebundenen Produktionsauftrag." };
        }
        const draft = await scope.getDraft(input.draftId);
        if (!draft || draft.revision !== input.draftRevision) {
          return { kind: "conflict" as const, message: "Planungs-Evidenz gehört nicht zur aktuellen ProductionDraft-Revision." };
        }
        if (draft.status !== "pending_review") {
          return { kind: "conflict" as const, message: "Planungs-Evidenz kann nur für einen offenen ProductionDraft gespeichert werden." };
        }
        if (await scope.hasDecisionEvidence(draft.draftId, draft.revision)) {
          return { kind: "conflict" as const, message: "Planungs-Evidenz darf nicht neben persistierter Freigabeevidenz gespeichert werden." };
        }
        const latestDraft = (await scope.listDrafts(productionCase.caseId))
          .sort((left, right) => right.revision - left.revision)[0];
        if (!latestDraft || latestDraft.draftId !== draft.draftId || latestDraft.revision !== draft.revision) {
          return { kind: "conflict" as const, message: "Planungs-Evidenz gehört nicht zur aktuellen Produktionsrevision." };
        }
        let linkedCaseId: string | undefined;
        try {
          linkedCaseId = await scope.findCaseIdForArtifact(draft.draftId);
        } catch {
          return { kind: "conflict" as const, message: "ProductionDraft ist nicht eindeutig mit dem Produktionsauftrag verknüpft." };
        }
        if (linkedCaseId !== productionCase.caseId) {
          return { kind: "conflict" as const, message: "Planungs-Evidenz ist nicht an den angeforderten Produktionsauftrag gebunden." };
        }
        if (draft.source.sourceRef !== `offer-handoff:${productionCase.productionHandoffId}`) {
          return { kind: "conflict" as const, message: "Planungs-Evidenz benötigt den unveränderten Offer-/Handoff-Quellpfad." };
        }
        const eventSpec = draft.draftArtifacts.eventSpec;
        const component = eventSpec?.menuPlan.find((item) => item.componentId === input.componentId);
        if (!eventSpec || eventSpec.specId !== productionCase.sourceSpecId || !component) {
          return { kind: "conflict" as const, message: "Planungs-Evidenz ist nicht an die aktuelle EventSpec gebunden." };
        }
        if (component.productionDecision?.mode !== "scratch" && component.productionDecision?.mode !== "hybrid") {
          return { kind: "unprocessable" as const, message: "Planungs-Evidenz ist nur für scratch- oder hybrid-Komponenten zulässig." };
        }
        if (component.recipeOverrideId !== input.recipeId) {
          return { kind: "conflict" as const, message: "Planungs-Evidenz referenziert nicht das freigegebene Rezept der Komponente." };
        }
        if (input.recipeEventUseReview && input.recipeEventUseReview.reviewedBy !== trustedActor.name) {
          return { kind: "unprocessable" as const, message: "RecipeEventUseReview muss durch den vertrauenswürdigen menschlichen Prüfer bestätigt sein." };
        }
        if (input.outputMapping && input.outputMapping.reviewedBy !== trustedActor.name) {
          return { kind: "unprocessable" as const, message: "outputMapping muss durch den vertrauenswürdigen menschlichen Prüfer bestätigt sein." };
        }
        const recipe = await repository.get(trustedActor, input.recipeId);
        if (!recipe) return { kind: "unprocessable" as const, message: "Das referenzierte Rezept ist nicht im aktuellen Betriebskontext vorhanden." };
        const bridge = evaluateQuantityRecipeProductionBridge({
          eventSpecId: eventSpec.specId,
          componentId: input.componentId,
          quantityDecision: input.quantityDecision,
          recipe,
          recipeEventUseReview: input.recipeEventUseReview,
          ...(input.outputMapping ? { outputMapping: input.outputMapping } : {})
        });
        if (bridge.status !== "ready_for_scaling") {
          const reviewMissing = bridge.issues.includes("recipe_event_review_required") || bridge.issues.includes("recipe_event_blocked");
          return {
            kind: "unprocessable" as const,
            message: reviewMissing
              ? "RecipeEventUseReview ist für diese Event-/Rezeptbindung erforderlich."
              : "Mengen-/Rezept-Evidenz ist für diese Produktionsrevision nicht freigabefähig.",
            errors: bridge.issues
          };
        }
        if (!input.recipeEventUseReview) {
          return { kind: "unprocessable" as const, message: "RecipeEventUseReview ist für diese Event-/Rezeptbindung erforderlich." };
        }
        const recipeSnapshotHash = `sha256:${createHash("sha256").update(stableJson(recipe)).digest("hex")}`;
        const evidenceId = productionPlanningEvidenceId({
          businessId: trustedActor.businessId,
          caseId: productionCase.caseId,
          draftId: draft.draftId,
          draftRevision: draft.revision,
          componentId: input.componentId
        });
        const evidence: ProductionPlanningEvidence = {
          schemaVersion: "1.0",
          evidenceId,
          businessId: trustedActor.businessId,
          caseId: productionCase.caseId,
          draftId: draft.draftId,
          draftRevision: draft.revision,
          eventSpecId: eventSpec.specId,
          componentId: input.componentId,
          recipeId: input.recipeId,
          recipeSnapshotHash,
          quantityDecision: structuredClone(input.quantityDecision),
          recipeEventUseReview: structuredClone(input.recipeEventUseReview),
          ...(input.outputMapping ? { outputMapping: structuredClone(input.outputMapping) } : {}),
          bridge,
          recordedBy: { name: trustedActor.name, source: trustedActor.source },
          recordedAt: new Date().toISOString()
        };
        const insertResult = await scope.insertEvidence(evidence);
        if (insertResult === "exists") {
          const existing = await scope.getEvidence(evidence.evidenceId);
          if (!existing || !samePlanningEvidenceContent(existing, evidence)) {
            return { kind: "conflict" as const, message: "Planungs-Evidenz wurde für dieselbe Bindung abweichend erneut eingereicht." };
          }
          return { kind: "created" as const, evidence: existing };
        }
        return { kind: "created" as const, evidence };
        }
      );
      if (!result) return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
      if (result.kind === "conflict") return reply.code(409).send({ message: result.message });
      if (result.kind === "unprocessable") return reply.code(422).send({ message: result.message, ...(result.errors ? { errors: result.errors } : {}) });
      return reply.code(201).send({ evidence: result.evidence });
    }
  );

  app.post<{ Params: { handoffId: string }; Body: Record<string, never> }>(
    "/v1/production/cases/from-handoff/:handoffId",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      if (!hasOnlyKeys(request.body ?? {}, [])) {
        return reply.code(422).send({ message: "Handoff-Auftrag enthält nicht erlaubte Felder." });
      }
      if (!handoffReader) {
        return reply.code(503).send({ message: "Angebotsübergaben sind nicht konfiguriert." });
      }
      const trustedActor = actor(request);
      let handoff;
      try {
        handoff = await handoffReader.get(trustedActor, request.params.handoffId);
      } catch {
        return reply.code(502).send({ message: "Produktionsübergabe konnte nicht geladen werden." });
      }
      if (!handoff) return reply.code(404).send({ message: "Produktionsübergabe nicht gefunden." });
      if (handoff.businessId !== trustedActor.businessId || handoff.handoffId !== request.params.handoffId) {
        return reply.code(502).send({ message: "Produktionsübergabe passt nicht zum Produktionsauftrag." });
      }
      const spec = handoff.eventSpecSnapshot;
      const productionCase = newProductionCase(trustedActor, {
        ...(spec.customer?.name ? { customerName: spec.customer.name } : {}),
        eventTypeLabel: formatEventTypeLabel(spec.servicePlan.eventType) ?? spec.servicePlan.eventType,
        ...(spec.event.date ? { eventDate: spec.event.date } : {}),
        ...(spec.attendees.expected ? { attendeeCount: spec.attendees.expected } : {})
      }, handoff.createdAt, handoff.handoffId, productionCaseIdForHandoff(trustedActor, handoff.handoffId));
      productionCase.sourceSpecId = spec.specId;
      const existingCase = await store.getCase(trustedActor, productionCase.caseId);
      if (existingCase) {
        return existingCase.productionHandoffId === handoff.handoffId
          ? reply.code(201).send({ case: existingCase })
          : reply.code(409).send({ message: "Bestehender Produktionsauftrag passt nicht zur Übergabe." });
      }
      try {
        await store.createCase(trustedActor, productionCase);
        return reply.code(201).send({ case: productionCase });
      } catch (error) {
        if (!(error instanceof CaseStoreConflictError)) throw error;
        const racedCase = await store.getCase(trustedActor, productionCase.caseId);
        return racedCase?.productionHandoffId === handoff.handoffId
          ? reply.code(201).send({ case: racedCase })
          : reply.code(409).send({ message: "Bestehender Produktionsauftrag passt nicht zur Übergabe." });
      }
    }
  );

  app.post<{ Params: { caseId: string }; Body: CaseMessageBody }>(
    "/v1/production/cases/:caseId/messages",
    async (request, reply) => {
      const forbidden = forbid(request, reply);
      if (forbidden) return forbidden;
      let input: ReturnType<typeof messageInput>;
      try {
        input = messageInput(request.body);
      } catch (error) {
        return reply.code(422).send({
          message: error instanceof Error ? error.message : "Nachricht ist ungültig."
        });
      }
      const trustedActor = actor(request);
      if (!await store.getCase(trustedActor, request.params.caseId)) {
        return reply.code(404).send({ message: "Produktionsauftrag nicht gefunden." });
      }
      const event = await store.appendEvent(trustedActor, request.params.caseId, {
        at: new Date().toISOString(),
        role: "user",
        kind: "instruction",
        text: input.text,
        visibility: canReadProductionCommercials(trustedActor) ? "commercial" : "operational",
        ...(input.sourceId ? { sourceId: input.sourceId } : {})
      });
      return reply.code(201).send({ event: projectProductionCaseEvent(trustedActor, event) });
    }
  );
}
