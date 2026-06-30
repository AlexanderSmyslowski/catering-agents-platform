import type { FastifyInstance } from "fastify";
import { estimateUniSideCosts, selectUniPackages } from "@catering/shared-core";

interface UniPackageQuery {
  eventType?: string | string[];
  pax?: string | string[];
  deliveries?: string | string[];
  staffHours?: string | string[];
}

export interface OfferUniPackageRouteDependencies {
  trustedActorSecret?: string;
  allowDevActorHeader: boolean;
  requireOfferOperator: (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
    trustedActorSecret?: string,
    allowDevActorHeader?: boolean
  ) => unknown | undefined;
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseRequiredPositiveNumber(value: string | string[] | undefined, fieldName: string) {
  const rawValue = firstQueryValue(value)?.trim();
  const parsed = rawValue ? Number(rawValue) : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      ok: false as const,
      message: `${fieldName} muss als positive Zahl übergeben werden.`
    };
  }

  return { ok: true as const, value: parsed };
}

function parseOptionalNonNegativeNumber(value: string | string[] | undefined, fieldName: string) {
  const rawValue = firstQueryValue(value)?.trim();
  if (!rawValue) {
    return { ok: true as const, value: 0 };
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      ok: false as const,
      message: `${fieldName} muss als nicht-negative Zahl übergeben werden.`
    };
  }

  return { ok: true as const, value: parsed };
}

function parseOptionalNonNegativeInteger(value: string | string[] | undefined, fieldName: string) {
  const result = parseOptionalNonNegativeNumber(value, fieldName);
  if (!result.ok) {
    return result;
  }

  if (!Number.isInteger(result.value)) {
    return {
      ok: false as const,
      message: `${fieldName} muss als ganze Zahl übergeben werden.`
    };
  }

  return result;
}

export function registerOfferUniPackageRoutes(
  app: FastifyInstance,
  deps: OfferUniPackageRouteDependencies
) {
  const { trustedActorSecret, allowDevActorHeader, requireOfferOperator } = deps;

  app.get<{ Querystring: UniPackageQuery }>("/v1/offers/uni-packages", async (request, reply) => {
    const forbidden = requireOfferOperator(request, reply, trustedActorSecret, allowDevActorHeader);
    if (forbidden) {
      return forbidden;
    }

    const pax = parseRequiredPositiveNumber(request.query.pax, "pax");
    if (!pax.ok) {
      return reply.code(400).send({ message: pax.message });
    }

    const deliveries = parseOptionalNonNegativeInteger(request.query.deliveries, "deliveries");
    if (!deliveries.ok) {
      return reply.code(400).send({ message: deliveries.message });
    }

    const staffHours = parseOptionalNonNegativeNumber(request.query.staffHours, "staffHours");
    if (!staffHours.ok) {
      return reply.code(400).send({ message: staffHours.message });
    }

    const eventType = firstQueryValue(request.query.eventType)?.trim() || undefined;
    const items = selectUniPackages({
      eventType,
      pax: pax.value
    });
    const sideCosts = estimateUniSideCosts({
      deliveries: deliveries.value,
      staffHours: staffHours.value
    });

    return reply.send({
      input: {
        eventType,
        pax: pax.value,
        deliveries: deliveries.value,
        staffHours: staffHours.value
      },
      items,
      sideCosts
    });
  });
}
