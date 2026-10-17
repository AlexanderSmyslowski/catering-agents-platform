import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  createEventRequestFromText,
  createCuratedOfferDraft,
  createOfferDraft,
  createOfferDraftFromAcceptedEventSpec,
  normalizeEventRequestToSpec,
  validateEventRequest,
  validateOfferDraft,
  type AuditLogStore,
  type CaseSourceRef,
  type EventRequest,
  type TrustedActor
} from "@catering/shared-core";
import { selectCuratedPackage } from "../../../shared-core/src/rules/curated-offer-selection.js";
import type { OfferStore } from "../store.js";
import type { SourceDocumentMetadataReader } from "../ports/source-document-reader.js";

class SourceDocumentVerificationError extends Error {
  readonly statusCode = 422;
}

class SourceDocumentReaderUnavailableError extends Error {
  readonly statusCode = 503;
}

export interface OfferDraftRouteDependencies {
  store: OfferStore;
  auditLog: AuditLogStore;
  sourceDocumentReader?: SourceDocumentMetadataReader;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  isOfferOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
  requireOfferOperator: (
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

export function registerOfferDraftRoutes(
  app: FastifyInstance,
  deps: OfferDraftRouteDependencies
) {
  const {
    store,
    auditLog,
    sourceDocumentReader,
    trustedActorSecret,
    allowDevActorHeader,
    isOfferOperator,
    requireOfferOperator,
    actorForRequest
  } = deps;

  async function verifiedSourceRefs(
    actor: TrustedActor,
    eventRequest: EventRequest
  ): Promise<CaseSourceRef[]> {
    const documentIds = [...new Set(eventRequest.rawInputs
      .map((input) => input.documentId?.trim())
      .filter((documentId): documentId is string => Boolean(documentId)))];
    if (documentIds.length === 0) return [];
    if (!sourceDocumentReader) {
      throw new SourceDocumentReaderUnavailableError(
        "Quelldokumente können im Angebotsdienst derzeit nicht verifiziert werden."
      );
    }

    const refs: CaseSourceRef[] = [];
    for (const documentId of documentIds) {
      let metadata;
      try {
        metadata = await sourceDocumentReader.getMetadata({ businessId: actor.businessId }, documentId);
      } catch {
        throw new SourceDocumentReaderUnavailableError(
          "Quelldokumente können im Angebotsdienst derzeit nicht verifiziert werden."
        );
      }
      if (!metadata || metadata.businessId !== actor.businessId || metadata.documentId !== documentId) {
        throw new SourceDocumentVerificationError(
          "Quelldokument konnte nicht verifiziert werden."
        );
      }
      refs.push({
        sourceId: metadata.documentId,
        documentId: metadata.documentId,
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        sha256: metadata.sha256,
        dataClass: metadata.dataClass,
        addedAt: metadata.createdAt
      });
    }
    return refs;
  }

  async function serverAuthoritativeEventRequest(
    actor: TrustedActor,
    submitted: EventRequest
  ): Promise<EventRequest> {
    const submittedInputs = submitted.rawInputs
      .filter((input) => Boolean(input.documentId?.trim()))
      .map((input) => ({
        kind: input.kind,
        content: input.content,
        documentId: input.documentId?.trim()
      }));
    if (submittedInputs.length === 0) return submitted;
    if (!sourceDocumentReader?.getRequest) {
      throw new SourceDocumentReaderUnavailableError(
        "Serverseitige Intake-Anfragen können im Angebotsdienst derzeit nicht verifiziert werden."
      );
    }
    let canonical: EventRequest | undefined;
    try {
      canonical = await sourceDocumentReader.getRequest(
        { businessId: actor.businessId },
        submitted.requestId
      );
    } catch {
      throw new SourceDocumentReaderUnavailableError(
        "Serverseitige Intake-Anfragen können im Angebotsdienst derzeit nicht verifiziert werden."
      );
    }
    if (!canonical) {
      throw new SourceDocumentVerificationError(
        "Serverseitige Intake-Anfrage konnte nicht verifiziert werden."
      );
    }
    const canonicalInputs = canonical.rawInputs
      .filter((input) => Boolean(input.documentId?.trim()))
      .map((input) => ({
        kind: input.kind,
        content: input.content,
        documentId: input.documentId?.trim()
      }));
    if (!areJsonValuesEqual(submittedInputs, canonicalInputs)) {
      throw new SourceDocumentVerificationError(
        "Quelldokument-Inhalt passt nicht zur serverseitigen Intake-Anfrage."
      );
    }
    return canonical;
  }

  function createPortfolioAwareOfferDraft(eventRequest: EventRequest) {
    const spec = normalizeEventRequestToSpec(eventRequest, {
      sourceType: "offer_service",
      reference: eventRequest.requestId,
      commercialState: "quoted"
    });
    const packagePreset = selectCuratedPackage(spec);
    return packagePreset ? createCuratedOfferDraft(eventRequest, packagePreset) : createOfferDraft(eventRequest);
  }

  app.post<{ Body: EventRequest & { caseId?: string; acceptedEventSpecId?: unknown } }>("/v1/offers/drafts", async (request, reply) => {
    if (!isOfferOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Angebots-Operator erforderlich."
      });
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const caseId = typeof request.body?.caseId === "string" ? request.body.caseId.trim() : "";
    if (!caseId) return reply.code(422).send({ message: "caseId ist erforderlich." });
    if (!await store.getCase(actor, caseId)) {
      return reply.code(404).send({ message: "Angebotsauftrag nicht gefunden." });
    }
    const rawAcceptedEventSpecId = request.body?.acceptedEventSpecId;
    const acceptedEventSpecId = rawAcceptedEventSpecId === undefined
      ? undefined
      : typeof rawAcceptedEventSpecId === "string" && rawAcceptedEventSpecId.trim()
        ? rawAcceptedEventSpecId.trim()
        : null;
    if (acceptedEventSpecId === null) {
      return reply.code(422).send({ message: "acceptedEventSpecId muss eine nichtleere Zeichenfolge sein." });
    }
    let eventRequest: EventRequest;
    try {
      const { caseId: _caseId, acceptedEventSpecId: _acceptedEventSpecId, ...body } = request.body;
      eventRequest = validateEventRequest(body as EventRequest);
    } catch (error) {
      return reply.code(422).send({
        message: "EventRequest ist ungültig.",
        errors: [error instanceof Error ? error.message : "Unbekannter Validierungsfehler."]
      });
    }
    let verifiedEventRequest: EventRequest;
    let sourceRefs: CaseSourceRef[];
    try {
      verifiedEventRequest = await serverAuthoritativeEventRequest(actor, eventRequest);
      sourceRefs = await verifiedSourceRefs(actor, verifiedEventRequest);
    } catch (error) {
      const statusCode = error instanceof SourceDocumentVerificationError || error instanceof SourceDocumentReaderUnavailableError
        ? error.statusCode
        : 503;
      return reply.code(statusCode).send({
        message: error instanceof SourceDocumentVerificationError || error instanceof SourceDocumentReaderUnavailableError
          ? error.message
          : "Quelldokument konnte nicht verifiziert werden."
      });
    }
    let draft;
    if (acceptedEventSpecId) {
      if (!sourceDocumentReader?.getSpec) {
        return reply.code(503).send({
          message: "Serverseitige AcceptedEventSpec kann im Angebotsdienst derzeit nicht verifiziert werden."
        });
      }
      let acceptedEventSpec;
      try {
        acceptedEventSpec = await sourceDocumentReader.getSpec(
          { businessId: actor.businessId },
          acceptedEventSpecId
        );
      } catch {
        return reply.code(503).send({
          message: "Serverseitige AcceptedEventSpec kann im Angebotsdienst derzeit nicht verifiziert werden."
        });
      }
      if (!acceptedEventSpec || acceptedEventSpec.specId !== acceptedEventSpecId) {
        return reply.code(422).send({
          message: "AcceptedEventSpec konnte für diesen Auftrag nicht verifiziert werden."
        });
      }
      if (!acceptedEventSpec.sourceLineage.some((source) => source.reference === verifiedEventRequest.requestId)) {
        return reply.code(422).send({
          message: "AcceptedEventSpec gehört nicht zur angeforderten Intake-Anfrage."
        });
      }
      try {
        draft = validateOfferDraft({
          ...createOfferDraftFromAcceptedEventSpec(acceptedEventSpec),
          businessId: actor.businessId,
          revision: 1
        });
      } catch {
        return reply.code(422).send({ message: "AcceptedEventSpec ist nicht schema-valide." });
      }
    } else {
      draft = validateOfferDraft({ ...createPortfolioAwareOfferDraft(verifiedEventRequest), businessId: actor.businessId, revision: 1 });
    }
    if (await store.saveDraftForCase(actor, caseId, draft, sourceRefs) === "case_conflict") {
      return reply.code(409).send({ message: "Dieser Angebotsentwurf gehört bereits zu einem anderen Auftrag." });
    }
    await auditLog.logFor(actor, {
      action: "offer.draft_created",
      entityType: "OfferDraft",
      entityId: draft.draftId,
      actor,
      idempotencyKey: `draft-created:${draft.draftId}`,
      summary: "Angebotsentwurf aus strukturierter Event-Anfrage erstellt.",
      details: {
        requestId: verifiedEventRequest.requestId,
        acceptedEventSpecId: acceptedEventSpecId ?? null,
        readiness: draft.proposedEventSpec.readiness.status,
        variants: draft.variantSet.length
      }
    });
    return reply.code(201).send(draft);
  });

  app.post<{ Body: { caseId?: unknown; text?: unknown; requestId?: unknown } }>("/v1/offers/from-text", async (request, reply) => {
    if (!isOfferOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Angebots-Operator erforderlich."
      });
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body) ||
      Object.keys(request.body).some((key) => !["caseId", "text", "requestId"].includes(key))) {
      return reply.code(422).send({ message: "Freitext-Anfrage ist ungültig." });
    }
    const caseId = typeof request.body.caseId === "string" ? request.body.caseId.trim() : "";
    const text = typeof request.body.text === "string" ? request.body.text.trim() : "";
    const suppliedRequestId = request.body.requestId === undefined
      ? undefined
      : typeof request.body.requestId === "string" ? request.body.requestId.trim() : "";
    if (!caseId || !text || suppliedRequestId === "") {
      return reply.code(422).send({
        message: "caseId und text sind erforderlich; requestId muss bei Angabe eine nichtleere Zeichenfolge sein."
      });
    }
    // Browser retries may omit a command ID. Deriving it from the owned case and
    // normalized input lets a lost-response retry recover the same draft.
    const requestId = suppliedRequestId ?? `request-free-text-${createHash("sha256")
      .update(`${actor.businessId}\0${caseId}\0${text}`)
      .digest("hex")}`;
    if (!await store.getCase(actor, caseId)) {
      return reply.code(404).send({ message: "Angebotsauftrag nicht gefunden." });
    }
    const eventRequest = createEventRequestFromText({
      requestId,
      channel: "text",
      rawText: text
    });
    let sourceAcceptedEventSpecSnapshot;
    if (sourceDocumentReader) {
      if (!sourceDocumentReader.ensureTextRequest) return reply.code(503).send({ message: "Intake-Textursprung kann derzeit nicht gespeichert werden." });
      try {
        sourceAcceptedEventSpecSnapshot = await sourceDocumentReader.ensureTextRequest(actor, requestId, text);
      } catch (error) {
        return reply.code((error as { statusCode?: number }).statusCode === 409 ? 409 : 503).send({ message: "Intake-Textursprung konnte nicht konfliktfrei gespeichert werden." });
      }
    }
    const draft = validateOfferDraft({ ...createPortfolioAwareOfferDraft(eventRequest), businessId: actor.businessId, revision: 1,
      ...(sourceAcceptedEventSpecSnapshot ? { sourceAcceptedEventSpecSnapshot } : {}) });
    const existingDraft = await store.getDraft(actor, draft.draftId);
    if (existingDraft && !areJsonValuesEqual(existingDraft, draft)) {
      return reply.code(409).send({ message: "Diese Anfrage besitzt bereits eine unveränderliche Angebotsfassung. Bitte als neue Anfragefassung fortsetzen." });
    }
    if (await store.saveDraftForCase(actor, caseId, draft) === "case_conflict") {
      return reply.code(409).send({ message: "Dieser Angebotsentwurf gehört bereits zu einem anderen Auftrag." });
    }
    await auditLog.logFor(actor, {
      action: "offer.draft_created_from_text",
      entityType: "OfferDraft",
      entityId: draft.draftId,
      actor,
      idempotencyKey: `draft-created:${draft.draftId}`,
      summary: "Angebotsentwurf aus Freitext erstellt.",
      details: {
        requestId: eventRequest.requestId,
        readiness: draft.proposedEventSpec.readiness.status,
        variants: draft.variantSet.length
      }
    });
    return reply.code(201).send(draft);
  });

  app.get("/v1/offers/drafts", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listDrafts(actorForRequest(request, trustedActorSecret, allowDevActorHeader))
    });
  });

  app.post<{ Params: { draftId: string }; Body: { revision?: unknown; menuPlan?: unknown } }>(
    "/v1/offers/drafts/:draftId/menu", async (request, reply) => {
      const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
      if (forbidden) return forbidden;
      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const source = await store.getDraft(actor, request.params.draftId);
      if (!source) return reply.code(404).send({ message: "Angebotsentwurf nicht gefunden." });
      if (sourceDocumentReader && !source.sourceAcceptedEventSpecSnapshot) {
        return reply.code(409).send({ message: "Für diese ältere Fassung fehlt der gespeicherte Anfrageursprung. Bitte die Originalanfrage im selben Auftrag als neue Textfassung erfassen." });
      }
      const body = request.body;
      if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).some((key) => !["revision", "menuPlan"].includes(key))
        || !Number.isInteger(body.revision) || body.revision !== source.revision
        || !Array.isArray(body.menuPlan) || body.menuPlan.length < 1 || body.menuPlan.length > 100) {
        return reply.code(422).send({ message: "Aktuelle Revision und 1–100 Menüpositionen erforderlich." });
      }
      const caseId = await store.findCaseIdForDraft(actor, source.draftId, source.revision);
      if (!caseId) return reply.code(409).send({ message: "Entwurf ist keinem eindeutigen Auftrag zugeordnet." });
      let revised;
      try {
        const menuPlan = body.menuPlan.map((raw, index) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)
            || Object.keys(raw).some((key) => !["componentId", "label", "servings", "menuCategory", "dietaryTags"].includes(key))) throw new Error("Ungültige Menüposition.");
          const item = raw as Record<string, unknown>;
          if (typeof item.label !== "string" || !item.label.trim() || item.label.length > 500
            || typeof item.servings !== "number" || !Number.isFinite(item.servings) || item.servings <= 0 || item.servings > 100000) throw new Error("Gericht und positive Portionszahl erforderlich.");
          const previous = typeof item.componentId === "string"
            ? source.proposedEventSpec.menuPlan.find((entry) => entry.componentId === item.componentId)
            : undefined;
          const category = item.menuCategory;
          if (category !== undefined && !["classic", "vegetarian", "vegan"].includes(String(category))) throw new Error("Menükategorie ungültig.");
          const tags = item.dietaryTags ?? (category === "vegan" ? ["vegan"] : category === "vegetarian" ? ["vegetarian"] : []);
          if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || tag.length > 100)) throw new Error("Ernährungskennzeichnung ungültig.");
          const sameDish = previous?.label === item.label.trim() && previous?.menuCategory === category;
          return {
            ...(sameDish ? previous : { serviceStyle: source.proposedEventSpec.servicePlan.serviceForm }),
            componentId: previous?.componentId ?? `menu-${index + 1}-${createHash("sha256").update(item.label.trim()).digest("hex").slice(0, 12)}`,
            label: item.label.trim(),
            servings: item.servings,
            menuCategory: category as "classic" | "vegetarian" | "vegan" | undefined,
            dietaryTags: tags as string[]
          };
        });
        if (new Set(menuPlan.map((item) => item.componentId)).size !== menuPlan.length) throw new Error("Doppelte Menüposition.");
        const draftId = `draft-menu-${createHash("sha256").update(JSON.stringify([actor.businessId, caseId, source.draftId, source.revision, menuPlan])).digest("hex")}`;
        const proposedEventSpec = { ...source.proposedEventSpec, menuPlan };
        const serviceModules = [
          ...menuPlan.map((item) => ({ moduleId: item.componentId, label: item.label, category: "food", quantity: item.servings })),
          ...source.serviceModules.filter((item) => item.category !== "food")
        ];
        revised = validateOfferDraft({
          ...source, draftId, revision: 1, proposedEventSpec, serviceModules,
          variantSet: source.variantSet.map((variant) => ({
            ...variant,
            moduleIds: serviceModules.map((item) => item.moduleId),
            proposedEventSpec: { ...variant.proposedEventSpec, menuPlan, servicePlan: { ...variant.proposedEventSpec.servicePlan, modules: serviceModules } }
          })),
          customerFacingText: [
            source.eventSummary, "Menü und Portionszahlen:",
            ...menuPlan.map((item) => `- ${item.label}: ${item.servings} Portionen`),
            "Weitere Leistungen:", ...serviceModules.filter((item) => item.category !== "food").map((item) => `- ${item.label}`),
            `Vorläufige Gesamtschätzung: ${source.pricingSummary.subtotal.amount.toFixed(2)} EUR. Preis, Steuern und Leistungsumfang weiterhin prüfen.`
          ].join("\n"),
          internalWorkingText: `Menübearbeitung aus ${source.draftId} / Revision ${source.revision}. Neue fachliche Prüfung erforderlich.\n${source.internalWorkingText}`,
          reviewStatus: source.reviewStatus ? { ...source.reviewStatus, priceReviewStatus: "review_required", taxReviewStatus: "review_required", allergenReviewStatus: "review_required", hygieneTemperatureReviewStatus: "review_required", publishApproved: false } : undefined
        });
        revised.proposedEventSpec.servicePlan.modules = serviceModules;
      } catch (error) {
        return reply.code(422).send({ message: error instanceof Error ? error.message : "Menü ungültig." });
      }
      const result = await store.saveDraftForCase(actor, caseId, revised, [], { draftId: source.draftId, revision: source.revision });
      if (result !== "saved") return reply.code(409).send({ message: "Der Auftrag wurde inzwischen bearbeitet. Bitte neu laden." });
      await auditLog.logFor(actor, {
        action: "offer.menu_revised", entityType: "OfferDraft", entityId: revised.draftId, actor,
        idempotencyKey: `menu-revised:${revised.draftId}`, summary: "Menü als neue Angebotsfassung gespeichert.",
        details: { sourceDraftId: source.draftId, sourceRevision: source.revision, caseId, menuItems: revised.proposedEventSpec.menuPlan.length }
      });
      return reply.code(201).send(revised);
    }
  );

  app.get<{ Params: { draftId: string } }>("/v1/offers/drafts/:draftId", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const draft = await store.getDraft(actorForRequest(request, trustedActorSecret, allowDevActorHeader), request.params.draftId);
    if (!draft) {
      return reply.code(404).send({ message: "OfferDraft nicht gefunden." });
    }

    return reply.send(draft);
  });

}
