import type { FastifyInstance } from "fastify";
import {
  areJsonValuesEqual,
  projectAcceptedEventSpecForActor,
  validateAcceptedEventSpec,
  validateEventRequest,
  type AcceptedEventSpec,
  type AuditLogStore,
  type OperationalArchiveReasonCode,
  type TrustedActor
} from "@catering/shared-core";
import {
  IntakeStoreConflictError,
  type IntakeStore
} from "../store.js";

export interface SpecUpdateBody {
  eventDate?: string;
  eventSchedule?: Array<{ label: string; start?: string; end?: string }>;
  attendeeCount?: number;
  serviceForm?: string;
  eventType?: string;
  menuItems?: string[];
  componentUpdates?: Array<{
    componentId: string;
    menuCategory?: "classic" | "vegetarian" | "vegan";
    productionMode?: "scratch" | "hybrid" | "convenience_purchase" | "external_finished";
    purchasedElements?: string[];
    recipeOverrideId?: string;
    notes?: string;
  }>;
}

export interface FinalizeSpecGovernanceBody {
  specId?: string;
  changeSetId?: string;
  confirmCriticalFinalize?: boolean;
}

export interface ArchiveIntakeRequestBody {
  reasonCode?: OperationalArchiveReasonCode;
}

interface InternalSpecWriteBody {
  acceptedEventSpec?: unknown;
}

interface InternalSpecReplacementBody {
  expected?: unknown;
  replacement?: unknown;
}

export interface IntakeWorkItemRouteDependencies {
  store: IntakeStore;
  auditLog: AuditLogStore;
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  includeArchivedFromQuery: (query: unknown) => boolean;
  parseArchiveReasonCode: (value: unknown) => OperationalArchiveReasonCode | undefined;
  applySpecUpdates: (spec: AcceptedEventSpec, body: SpecUpdateBody) => AcceptedEventSpec;
  isIntakeOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
  isOperationsAuditOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => boolean;
  requireIntakeOperator: (
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

export function registerIntakeWorkItemRoutes(
  app: FastifyInstance,
  deps: IntakeWorkItemRouteDependencies
) {
  const {
    store,
    auditLog,
    trustedActorSecret,
    allowDevActorHeader,
    includeArchivedFromQuery,
    parseArchiveReasonCode,
    applySpecUpdates,
    isIntakeOperator,
    isOperationsAuditOperator,
    requireIntakeOperator,
    actorForRequest
  } = deps;

  const productionServiceActor = (
    request: { headers: Record<string, string | string[] | undefined> }
  ): TrustedActor | undefined => {
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    return actor.trusted && actor.name === "Production-Service" ? actor : undefined;
  };

  const internalRequestReaderActor = (
    request: { headers: Record<string, string | string[] | undefined> }
  ): TrustedActor | undefined => {
    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    return actor.trusted && (actor.name === "Production-Service" || actor.name === "Offer-Service")
      ? actor
      : undefined;
  };

  app.get<{ Params: { requestId: string } }>(
    "/v1/intake/internal/requests/:requestId",
    async (request, reply) => {
      const actor = internalRequestReaderActor(request);
      if (!actor) return reply.code(403).send({ message: "Interner Request-Leser erforderlich." });
      const eventRequest = await store.getRequest(actor, request.params.requestId);
      if (!eventRequest) return reply.code(404).send({ message: "EventRequest nicht gefunden." });
      return reply.send({ eventRequest: validateEventRequest(eventRequest) });
    }
  );

  app.get<{ Params: { specId: string } }>(
    "/v1/intake/internal/specs/:specId",
    async (request, reply) => {
      const actor = productionServiceActor(request);
      if (!actor) return reply.code(403).send({ message: "Production-Service erforderlich." });
      const acceptedEventSpec = await store.getSpec(actor, request.params.specId);
      if (!acceptedEventSpec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }
      return reply.send({ acceptedEventSpec: validateAcceptedEventSpec(acceptedEventSpec) });
    }
  );

  app.put<{ Params: { specId: string }; Body: InternalSpecWriteBody }>(
    "/v1/intake/internal/specs/:specId",
    async (request, reply) => {
      const actor = productionServiceActor(request);
      if (!actor) return reply.code(403).send({ message: "Production-Service erforderlich." });
      let acceptedEventSpec: AcceptedEventSpec;
      try {
        acceptedEventSpec = validateAcceptedEventSpec(
          request.body?.acceptedEventSpec as AcceptedEventSpec
        );
      } catch {
        return reply.code(422).send({ message: "AcceptedEventSpec ist nicht schema-valide." });
      }
      if (acceptedEventSpec.specId !== request.params.specId) {
        return reply.code(422).send({ message: "AcceptedEventSpec passt nicht zur angeforderten specId." });
      }

      const existing = await store.getSpec(actor, acceptedEventSpec.specId);
      if (existing) {
        if (areJsonValuesEqual(existing, acceptedEventSpec)) {
          return reply.send({ result: "same_content" });
        }
        return reply.code(409).send({
          message: `AcceptedEventSpec ${acceptedEventSpec.specId} existiert bereits mit abweichendem Inhalt.`
        });
      }
      const inserted = await store.insertSpec(actor, acceptedEventSpec);
      if (inserted === "created") {
        return reply.code(201).send({ result: "created" });
      }
      const observed = await store.getSpec(actor, acceptedEventSpec.specId);
      if (observed && areJsonValuesEqual(observed, acceptedEventSpec)) {
        return reply.send({ result: "same_content" });
      }
      return reply.code(409).send({
        message: `AcceptedEventSpec ${acceptedEventSpec.specId} konnte nicht konfliktfrei eingefügt werden.`
      });
    }
  );

  app.put<{ Params: { specId: string }; Body: InternalSpecReplacementBody }>(
    "/v1/intake/internal/specs/:specId/replacement",
    async (request, reply) => {
      const actor = productionServiceActor(request);
      if (!actor) return reply.code(403).send({ message: "Production-Service erforderlich." });
      let expected: AcceptedEventSpec;
      let replacement: AcceptedEventSpec;
      try {
        expected = validateAcceptedEventSpec(request.body?.expected as AcceptedEventSpec);
        replacement = validateAcceptedEventSpec(request.body?.replacement as AcceptedEventSpec);
      } catch {
        return reply.code(422).send({ message: "AcceptedEventSpec-Ersetzung ist nicht schema-valide." });
      }
      if (
        expected.specId !== request.params.specId ||
        replacement.specId !== request.params.specId
      ) {
        return reply.code(422).send({ message: "AcceptedEventSpec-Ersetzung muss dieselbe specId behalten." });
      }
      const result = await store.replaceSpec(actor, expected, replacement);
      if (result === "missing") {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }
      if (result === "conflict") {
        return reply.code(409).send({
          message: "AcceptedEventSpec wurde zwischenzeitlich geändert. Bitte Daten neu laden."
        });
      }
      return reply.send({ result });
    }
  );

  app.get("/v1/intake/requests", async (request, reply) => {
    const forbidden = requireIntakeOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    return reply.send({
      items: await store.listRequests(actor, {
        includeArchived: includeArchivedFromQuery(request.query)
      })
    });
  });

  app.post<{ Params: { requestId: string }; Body: ArchiveIntakeRequestBody }>(
    "/v1/intake/requests/:requestId/archive",
    async (request, reply) => {
      if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
        return reply.code(403).send({
          message: "Intake-Operator erforderlich."
        });
      }

      const reasonCode = parseArchiveReasonCode(request.body?.reasonCode);
      if (!reasonCode) {
        return reply.code(400).send({
          message:
            "reasonCode muss wrong_upload, duplicate_test_data oder operator_rehearsal_cleanup sein."
        });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      let archived: Awaited<ReturnType<IntakeStore["archiveRequestContext"]>>;
      try {
        archived = await store.archiveRequestContext(actor, {
          requestId: request.params.requestId,
          reasonCode,
          archivedAt: new Date().toISOString(),
          archivedBy: actor.name
        });
      } catch (error) {
        if (error instanceof IntakeStoreConflictError) {
          return reply.code(409).send({ message: error.message });
        }
        throw error;
      }
      if (!archived.request) {
        return reply.code(404).send({ message: "EventRequest nicht gefunden." });
      }

      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "intake.request_soft_archived",
        entityType: "EventRequest",
        entityId: archived.request.requestId,
        actor,
        summary: "Intake-Kontext per Soft-Archiv aus dem aktiven Arbeitsfokus genommen.",
        details: {
          requestId: archived.request.requestId,
          reasonCode,
          archivedSpecCount: archived.specs.length,
          alreadyArchived: archived.alreadyArchived,
          hardDeleted: false
        }
      });

      return reply.send({
        eventRequest: archived.request,
        archivedSpecIds: archived.specs.map((spec) => spec.specId),
        alreadyArchived: archived.alreadyArchived,
        hardDeleted: false
      });
    }
  );

  app.get<{ Params: { requestId: string } }>("/v1/intake/requests/:requestId", async (request, reply) => {
    const forbidden = requireIntakeOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const intakeRequest = await store.getRequest(actor, request.params.requestId);
    if (!intakeRequest) {
      return reply.code(404).send({ message: "EventRequest nicht gefunden." });
    }

    return reply.send(intakeRequest);
  });

  app.get("/v1/intake/specs", async (request, reply) => {
    const forbidden = requireIntakeOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    return reply.send({
      items: (await store.listSpecs(actor, {
        includeArchived: includeArchivedFromQuery(request.query)
      })).map((spec) => projectAcceptedEventSpecForActor(actor, spec, {
        includeTargetBudgetForNonCommercial: true
      }))
    });
  });

  app.get<{ Params: { specId: string } }>("/v1/intake/specs/:specId", async (request, reply) => {
    const forbidden = requireIntakeOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
    const spec = await store.getSpec(actor, request.params.specId);
    if (!spec) {
      return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
    }

    return reply.send(projectAcceptedEventSpecForActor(actor, spec, {
      includeTargetBudgetForNonCommercial: true
    }));
  });

  app.patch<{ Params: { specId: string }; Body: SpecUpdateBody }>(
    "/v1/intake/specs/:specId",
    async (request, reply) => {
      if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
        return reply.code(403).send({
          message: "Intake-Operator erforderlich."
        });
      }

      const actor = actorForRequest(request, trustedActorSecret, allowDevActorHeader);
      const spec = await store.getSpec(actor, request.params.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      const updatedSpec = validateAcceptedEventSpec(applySpecUpdates(spec, request.body));
      await store.saveSpec(actor, updatedSpec);
      await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
        action: "intake.spec_updated",
        entityType: "AcceptedEventSpec",
        entityId: updatedSpec.specId,
        actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
        summary: "AcceptedEventSpec manuell nachbearbeitet.",
        details: {
          eventDate: updatedSpec.event.date,
          attendeeCount: updatedSpec.attendees.expected,
          serviceForm: updatedSpec.servicePlan.serviceForm,
          readiness: updatedSpec.readiness.status
        }
      });

      return reply.send({
        acceptedEventSpec: projectAcceptedEventSpecForActor(actor, updatedSpec, {
          includeTargetBudgetForNonCommercial: true
        })
      });
    }
  );

  app.post<{ Body: FinalizeSpecGovernanceBody }>("/v1/intake/spec-governance/finalize", async (request, reply) => {
    if (!isOperationsAuditOperator(request, trustedActorSecret, allowDevActorHeader)) {
      return reply.code(403).send({
        message: "Betriebs-/Audit-Operator erforderlich."
      });
    }

    const specId = request.body.specId?.trim();
    const changeSetId = request.body.changeSetId?.trim();

    if (!specId && !changeSetId) {
      return reply.code(400).send({
        message: "Es muss eine specId oder changeSetId übergeben werden."
      });
    }

    await auditLog.logFor(actorForRequest(request, trustedActorSecret, allowDevActorHeader), {
      action: "intake.spec_governance_finalized",
      entityType: "AcceptedEventSpec",
      entityId: specId ?? changeSetId ?? "unknown",
      actor: actorForRequest(request, trustedActorSecret, allowDevActorHeader),
      summary: "Spec-Governance im Intake-Finalize-Pfad bestaetigt.",
      details: {
        specId,
        changeSetId,
        confirmCriticalFinalize: request.body.confirmCriticalFinalize === true
      }
    });

    return reply.send({
      ok: true,
      specId,
      changeSetId,
      confirmCriticalFinalize: request.body.confirmCriticalFinalize === true
    });
  });
}
