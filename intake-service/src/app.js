import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { actorNameFromHeaders, AuditLogStore, createEventRequestFromManualForm, getDemoIntakeRequests, normalizeEventRequestToSpec, resolveMinimalMvpRoleFromActorName, withEvaluatedReadiness, validateAcceptedEventSpec, validateEventRequest } from "@catering/shared-core";
import { buildEventRequestFromText, extractTextFromDocument } from "./extraction.js";
import { IntakeStore } from "./store.js";
function rawInputKindForMimeType(mimeType) {
    if (mimeType.includes("pdf")) {
        return "pdf";
    }
    if (mimeType.includes("message/rfc822")) {
        return "email";
    }
    if (mimeType.includes("json")) {
        return "json";
    }
    return "text";
}
function normalizeMenuItems(input) {
    if (!input) {
        return undefined;
    }
    const items = input.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : [];
}
function dietaryTagsForCategory(category) {
    if (category === "vegan") {
        return ["vegan"];
    }
    if (category === "vegetarian") {
        return ["vegetarian"];
    }
    return [];
}
function applySpecUpdates(spec, body) {
    const nextEventType = body.eventType?.trim() || spec.event.type || spec.servicePlan.eventType;
    const nextServiceForm = body.serviceForm?.trim() || spec.event.serviceForm || spec.servicePlan.serviceForm;
    const nextAttendeeCount = body.attendeeCount ?? spec.attendees.expected;
    const nextMenuItems = normalizeMenuItems(body.menuItems);
    const componentUpdates = new Map((body.componentUpdates ?? []).map((item) => [item.componentId, item]));
    const nextRecipeOverrideId = (componentId, currentRecipeOverrideId) => {
        const componentUpdate = componentUpdates.get(componentId);
        if (!componentUpdate) {
            return currentRecipeOverrideId;
        }
        if (!Object.prototype.hasOwnProperty.call(componentUpdate, "recipeOverrideId")) {
            return currentRecipeOverrideId;
        }
        return componentUpdate.recipeOverrideId?.trim() || undefined;
    };
    const nextSpec = {
        ...spec,
        event: {
            ...spec.event,
            type: nextEventType,
            date: body.eventDate?.trim() || spec.event.date,
            serviceForm: nextServiceForm
        },
        attendees: {
            ...spec.attendees,
            expected: nextAttendeeCount
        },
        servicePlan: {
            ...spec.servicePlan,
            eventType: nextEventType ?? spec.servicePlan.eventType,
            serviceForm: nextServiceForm
        },
        menuPlan: nextMenuItems === undefined
            ? spec.menuPlan.map((item) => ({
                ...item,
                serviceStyle: nextServiceForm,
                servings: nextAttendeeCount,
                menuCategory: componentUpdates.get(item.componentId)?.menuCategory ?? item.menuCategory,
                dietaryTags: componentUpdates.get(item.componentId)?.menuCategory
                    ? dietaryTagsForCategory(componentUpdates.get(item.componentId)?.menuCategory)
                    : item.dietaryTags,
                recipeOverrideId: nextRecipeOverrideId(item.componentId, item.recipeOverrideId),
                productionDecision: componentUpdates.get(item.componentId)
                    ? {
                        mode: componentUpdates.get(item.componentId)?.productionMode,
                        purchasedElements: componentUpdates.get(item.componentId)?.purchasedElements,
                        notes: componentUpdates.get(item.componentId)?.notes
                    }
                    : item.productionDecision
            }))
            : nextMenuItems.map((label, index) => ({
                componentId: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "menu"}-${index + 1}`,
                label,
                course: spec.menuPlan[index]?.course ?? "main",
                menuCategory: componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.menuCategory ??
                    spec.menuPlan[index]?.menuCategory,
                serviceStyle: nextServiceForm,
                desiredRecipeTags: spec.menuPlan[index]?.desiredRecipeTags ?? (nextEventType ? [nextEventType] : []),
                servings: nextAttendeeCount,
                dietaryTags: componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.menuCategory
                    ? dietaryTagsForCategory(componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.menuCategory)
                    : spec.menuPlan[index]?.dietaryTags ?? [],
                recipeOverrideId: nextRecipeOverrideId(spec.menuPlan[index]?.componentId ?? "", spec.menuPlan[index]?.recipeOverrideId),
                productionDecision: componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")
                    ? {
                        mode: componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.productionMode,
                        purchasedElements: componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.purchasedElements,
                        notes: componentUpdates.get(spec.menuPlan[index]?.componentId ?? "")?.notes
                    }
                    : spec.menuPlan[index]?.productionDecision
            }))
    };
    return withEvaluatedReadiness(nextSpec);
}
function isIntakeStore(value) {
    return value instanceof IntakeStore;
}
function actorForRequest(request) {
    return {
        name: actorNameFromHeaders(request.headers, "Intake-Mitarbeiter"),
        source: request.headers["x-actor-name"] ? "header:x-actor-name" : "service-default"
    };
}
function isOperationsAuditOperator(request) {
    return resolveMinimalMvpRoleFromActorName(actorForRequest(request).name) === "operations_audit_operator";
}
function multipartFieldValue(fields, fieldName) {
    const field = fields[fieldName];
    if (Array.isArray(field)) {
        return field[0]?.value;
    }
    return field?.value;
}
async function extractMultipartDocuments(request) {
    const multipartRequest = request;
    if (!multipartRequest.isMultipart()) {
        throw new Error("Es wurde kein Multipart-Upload gesendet.");
    }
    const documents = [];
    let channel;
    let requestId;
    for await (const part of multipartRequest.parts()) {
        if (part.type === "file") {
            if (!part.toBuffer || !part.filename) {
                continue;
            }
            documents.push({
                filename: part.filename,
                mimeType: part.mimetype ?? "application/octet-stream",
                content: await part.toBuffer()
            });
            continue;
        }
        if (part.fieldname === "channel" && typeof part.value === "string") {
            channel = part.value;
        }
        if (part.fieldname === "requestId" && typeof part.value === "string") {
            requestId = part.value;
        }
    }
    if (documents.length === 0) {
        throw new Error("Es wurde keine Dokumentdatei mitgesendet.");
    }
    return {
        requestId,
        channel,
        documents
    };
}
async function normalizeUploadedDocuments(payload) {
    const extracted = await Promise.all(payload.documents.map(async (document, index) => ({
        documentId: `${payload.requestId ?? "document"}-${index + 1}`,
        mimeType: document.mimeType,
        text: await extractTextFromDocument(document)
    })));
    const eventRequest = {
        schemaVersion: "1.0.0",
        requestId: payload.requestId ?? `request-${Date.now()}`,
        source: {
            channel: payload.channel ?? "pdf_upload",
            receivedAt: new Date().toISOString()
        },
        rawInputs: extracted.map((item) => ({
            kind: rawInputKindForMimeType(item.mimeType),
            content: item.text,
            mimeType: item.mimeType,
            documentId: item.documentId
        }))
    };
    const validatedRequest = validateEventRequest(eventRequest);
    const spec = validateAcceptedEventSpec(normalizeEventRequestToSpec(validatedRequest, {
        sourceType: validatedRequest.source.channel === "email"
            ? "email"
            : validatedRequest.source.channel === "pdf_upload"
                ? "pdf"
                : "manual_input",
        reference: validatedRequest.requestId,
        commercialState: "manual"
    }));
    return {
        eventRequest: validatedRequest,
        acceptedEventSpec: spec
    };
}
export function buildIntakeApp(input = {}) {
    const options = isIntakeStore(input) ? { store: input } : input;
    const storageOptions = isIntakeStore(input) ? input.storageOptions : options;
    const store = options.store ??
        new IntakeStore({
            rootDir: options.rootDir,
            databaseUrl: options.databaseUrl,
            pgPool: options.pgPool
        });
    const auditLog = options.auditLog ??
        new AuditLogStore({
            rootDir: storageOptions?.rootDir,
            databaseUrl: storageOptions?.databaseUrl,
            pgPool: storageOptions?.pgPool
        });
    const app = Fastify({
        logger: false,
        bodyLimit: 25 * 1024 * 1024
    });
    app.register(multipart);
    app.get("/health", async (_request, reply) => {
        const [requests, specs, auditEvents] = await Promise.all([
            store.listRequests(),
            store.listSpecs(),
            auditLog.count()
        ]);
        return reply.send({
            service: "intake-service",
            status: "ok",
            timestamp: new Date().toISOString(),
            counts: {
                requests: requests.length,
                acceptedSpecs: specs.length,
                auditEvents
            }
        });
    });
    app.post("/v1/intake/normalize", async (request, reply) => {
        const body = request.body;
        const eventRequest = "rawInputs" in body
            ? validateEventRequest(body)
            : buildEventRequestFromText({
                requestId: body.requestId ?? `request-${Date.now()}`,
                channel: body.channel ?? "text",
                rawText: body.text
            });
        await store.saveRequest(eventRequest);
        const spec = validateAcceptedEventSpec(normalizeEventRequestToSpec(eventRequest, {
            sourceType: eventRequest.source.channel === "pdf_upload"
                ? "pdf"
                : eventRequest.source.channel === "email"
                    ? "email"
                    : "manual_input",
            reference: eventRequest.requestId,
            commercialState: "manual"
        }));
        await store.saveSpec(spec);
        await auditLog.log({
            action: "intake.normalized",
            entityType: "AcceptedEventSpec",
            entityId: spec.specId,
            actor: actorForRequest(request),
            summary: `Intake aus ${eventRequest.source.channel} in AcceptedEventSpec normalisiert.`,
            details: {
                requestId: eventRequest.requestId,
                channel: eventRequest.source.channel,
                readiness: spec.readiness.status
            }
        });
        return reply.code(201).send({
            eventRequest,
            acceptedEventSpec: spec
        });
    });
    app.post("/v1/intake/documents", async (request, reply) => {
        const body = request.body;
        const documents = body.documents.map((document) => ({
            filename: document.filename,
            mimeType: document.mimeType,
            content: Buffer.from(document.contentBase64, "base64")
        }));
        const normalized = await normalizeUploadedDocuments({
            documents,
            requestId: body.requestId,
            channel: body.channel
        });
        await store.saveRequest(normalized.eventRequest);
        await store.saveSpec(normalized.acceptedEventSpec);
        await auditLog.log({
            action: "intake.documents_normalized",
            entityType: "AcceptedEventSpec",
            entityId: normalized.acceptedEventSpec.specId,
            actor: actorForRequest(request),
            summary: `${documents.length} hochgeladene(s) Dokument(e) in AcceptedEventSpec normalisiert.`,
            details: {
                requestId: normalized.eventRequest.requestId,
                documentCount: documents.length,
                readiness: normalized.acceptedEventSpec.readiness.status,
                uploadMode: "json_base64"
            }
        });
        return reply.code(201).send(normalized);
    });
    app.post("/v1/intake/documents/upload", async (request, reply) => {
        const upload = await extractMultipartDocuments(request);
        const normalized = await normalizeUploadedDocuments(upload);
        await store.saveRequest(normalized.eventRequest);
        await store.saveSpec(normalized.acceptedEventSpec);
        await auditLog.log({
            action: "intake.documents_normalized",
            entityType: "AcceptedEventSpec",
            entityId: normalized.acceptedEventSpec.specId,
            actor: actorForRequest(request),
            summary: `${upload.documents.length} hochgeladene(s) Dokument(e) per Direkt-Upload in AcceptedEventSpec normalisiert.`,
            details: {
                requestId: normalized.eventRequest.requestId,
                documentCount: upload.documents.length,
                readiness: normalized.acceptedEventSpec.readiness.status,
                uploadMode: "multipart"
            }
        });
        return reply.code(201).send(normalized);
    });
    app.post("/v1/intake/specs/manual", async (request, reply) => {
        const eventRequest = validateEventRequest(createEventRequestFromManualForm({
            requestId: `manual-${Date.now()}`,
            ...request.body
        }));
        const spec = validateAcceptedEventSpec(normalizeEventRequestToSpec(eventRequest, {
            sourceType: "manual_input",
            reference: eventRequest.requestId,
            commercialState: "manual"
        }));
        await store.saveRequest(eventRequest);
        await store.saveSpec(spec);
        await auditLog.log({
            action: "intake.manual_spec_created",
            entityType: "AcceptedEventSpec",
            entityId: spec.specId,
            actor: actorForRequest(request),
            summary: "AcceptedEventSpec aus manuellem Formular erstellt.",
            details: {
                requestId: eventRequest.requestId,
                readiness: spec.readiness.status,
                attendeeCount: spec.attendees.expected
            }
        });
        return reply.code(201).send({
            eventRequest,
            acceptedEventSpec: spec
        });
    });
    app.post("/v1/intake/seed-demo", async (_request, reply) => {
        const seeded = [];
        for (const eventRequest of getDemoIntakeRequests()) {
            await store.saveRequest(eventRequest);
            const spec = validateAcceptedEventSpec(normalizeEventRequestToSpec(eventRequest, {
                sourceType: eventRequest.source.channel === "pdf_upload"
                    ? "pdf"
                    : eventRequest.source.channel === "email"
                        ? "email"
                        : "manual_input",
                reference: eventRequest.requestId,
                commercialState: "manual"
            }));
            await store.saveSpec(spec);
            seeded.push({
                requestId: eventRequest.requestId,
                specId: spec.specId
            });
        }
        await auditLog.log({
            action: "intake.seed_demo",
            entityType: "SeedBatch",
            entityId: `intake-demo-${Date.now()}`,
            actor: actorForRequest(_request),
            summary: `${seeded.length} Intake-Demodatensaetze angelegt.`,
            details: {
                seededCount: seeded.length
            }
        });
        return reply.code(201).send({
            seeded,
            counts: {
                requests: (await store.listRequests()).length,
                acceptedSpecs: (await store.listSpecs()).length
            }
        });
    });
    app.get("/v1/intake/requests", async (_request, reply) => {
        return reply.send({
            items: await store.listRequests()
        });
    });
    app.get("/v1/intake/specs", async (_request, reply) => {
        return reply.send({
            items: await store.listSpecs()
        });
    });
    app.get("/v1/intake/specs/:specId", async (request, reply) => {
        const spec = await store.getSpec(request.params.specId);
        if (!spec) {
            return reply.code(404).send({ message: "AcceptedEventSpec nicht gefunden." });
        }
        return reply.send(spec);
    });
    app.patch("/v1/intake/specs/:specId", async (request, reply) => {
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
            actor: actorForRequest(request),
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
    });
    app.post("/v1/intake/spec-governance/finalize", async (request, reply) => {
        if (!isOperationsAuditOperator(request)) {
            return reply.code(403).send({
                message: "Betriebs-/Audit-Operator erforderlich."
            });
        }
        const specId = request.body.specId?.trim();
        const changeSetId = request.body.changeSetId?.trim();
        if (!specId && !changeSetId) {
            return reply.code(400).send({
                message: "Es muss eine specId oder changeSetId uebergeben werden."
            });
        }
        return reply.send({
            ok: true,
            specId,
            changeSetId,
            confirmCriticalFinalize: request.body.confirmCriticalFinalize === true
        });
    });
    return app;
}
