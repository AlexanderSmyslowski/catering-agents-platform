import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  createEventRequestFromText,
  createCuratedOfferDraft,
  createOfferDraft,
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

  app.post<{ Body: EventRequest & { caseId?: string } }>("/v1/offers/drafts", async (request, reply) => {
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
    let eventRequest: EventRequest;
    try {
      const { caseId: _caseId, ...body } = request.body;
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
    const draft = validateOfferDraft({ ...createPortfolioAwareOfferDraft(verifiedEventRequest), businessId: actor.businessId, revision: 1 });
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
    const draft = validateOfferDraft({ ...createPortfolioAwareOfferDraft(eventRequest), businessId: actor.businessId, revision: 1 });
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
