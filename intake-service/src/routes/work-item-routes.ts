import type { FastifyInstance } from "fastify";
import {
  validateAcceptedEventSpec,
  type AcceptedEventSpec,
  type AuditLogStore,
  type OperationalArchiveReasonCode,
  type TrustedActor
} from "@catering/shared-core";
import type { IntakeStore } from "../store.js";

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

  app.get("/v1/intake/requests", async (request, reply) => {
    const forbidden = requireIntakeOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    return reply.send({
      items: await store.listRequests({
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
      const archived = await store.archiveRequestContext({
        requestId: request.params.requestId,
        reasonCode,
        archivedAt: new Date().toISOString(),
        archivedBy: actor.name
      });
      if (!archived.request) {
        return reply.code(404).send({ message: "EventRequest nicht gefunden." });
      }

      await auditLog.log({
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

    const intakeRequest = await store.getRequest(request.params.requestId);
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

    return reply.send({
      items: await store.listSpecs({
        includeArchived: includeArchivedFromQuery(request.query)
      })
    });
  });

  app.get<{ Params: { specId: string } }>("/v1/intake/specs/:specId", async (request, reply) => {
    const forbidden = requireIntakeOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const spec = await store.getSpec(request.params.specId);
    if (!spec) {
      return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
    }

    return reply.send(spec);
  });

  app.patch<{ Params: { specId: string }; Body: SpecUpdateBody }>(
    "/v1/intake/specs/:specId",
    async (request, reply) => {
      if (!isIntakeOperator(request, trustedActorSecret, allowDevActorHeader)) {
        return reply.code(403).send({
          message: "Intake-Operator erforderlich."
        });
      }

      const spec = await store.getSpec(request.params.specId);
      if (!spec) {
        return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
      }

      const updatedSpec = validateAcceptedEventSpec(applySpecUpdates(spec, request.body));
      await store.saveSpec(updatedSpec);
      await auditLog.log({
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
        acceptedEventSpec: updatedSpec
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

    await auditLog.log({
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
