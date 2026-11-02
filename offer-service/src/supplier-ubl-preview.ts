import type { FastifyInstance } from "fastify";
import { AUTHENTICATED_SESSION_APPROVAL_ACTOR_SOURCE, hasMinimalMvpCapability, type TrustedActor } from "@catering/shared-core";
import { parseSupplierUblInvoice } from "@catering/shared-core/supplier-ubl-invoice";

// This synchronous preview uses a smaller limit than the standalone parser to bound request work.
const MAX_BODY_BYTES = 64_000;

export function registerSupplierUblPreview(app: FastifyInstance, actorForRequest: (request: { headers: Record<string, string | string[] | undefined> }) => TrustedActor): void {
  // One fixed-size service-instance budget avoids per-user state and bounds repeated parser work.
  let windowStarted = 0;
  let used = 0;
  app.post<{ Body: unknown }>("/v1/offers/supplier-invoices/preview", { bodyLimit: MAX_BODY_BYTES }, async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    const actor = actorForRequest(request);
    if (!actor.trusted || actor.source !== AUTHENTICATED_SESSION_APPROVAL_ACTOR_SOURCE || !hasMinimalMvpCapability(actor, "commercial")) return reply.code(403).send({ message: "Kaufmännische Berechtigung erforderlich." });
    const now = performance.now();
    if (now - windowStarted >= 60_000) { windowStarted = now; used = 0; }
    if (used >= 10) return reply.code(429).send({ message: "Zu viele Rechnungsprüfungen. Bitte später erneut versuchen." });
    used++;
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("xml" in body) || typeof body.xml !== "string") return reply.code(400).send({ message: "Eine UBL-XML-Rechnung erforderlich." });
    try { return reply.send({ candidates: parseSupplierUblInvoice(body.xml) }); }
    catch { return reply.code(422).send({ message: "Rechnung nicht unterstützt oder nicht eindeutig. Bitte manuell prüfen." }); }
  });
}
