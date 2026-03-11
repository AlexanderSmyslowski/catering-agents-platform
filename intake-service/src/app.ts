import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  getDemoIntakeRequests,
  normalizeEventRequestToSpec,
  validateAcceptedEventSpec,
  validateEventRequest,
  type DocumentInput,
  type EventRequest
} from "@catering/shared-core";
import { buildEventRequestFromText, extractTextFromDocument } from "./extraction.js";
import { IntakeStore } from "./store.js";

interface DocumentBody {
  documents: {
    filename: string;
    mimeType: string;
    contentBase64: string;
  }[];
  channel?: EventRequest["source"]["channel"];
  requestId?: string;
}

export function buildIntakeApp(store = new IntakeStore()) {
  const app = Fastify({
    logger: false
  });

  app.register(multipart);

  app.get("/health", async (_request, reply) => {
    const [requests, specs] = await Promise.all([store.listRequests(), store.listSpecs()]);
    return reply.send({
      service: "intake-service",
      status: "ok",
      timestamp: new Date().toISOString(),
      counts: {
        requests: requests.length,
        acceptedSpecs: specs.length
      }
    });
  });

  app.post<{ Body: EventRequest | { text: string; channel?: EventRequest["source"]["channel"]; requestId?: string } }>(
    "/v1/intake/normalize",
    async (request, reply) => {
      const body = request.body;
      const eventRequest =
        "rawInputs" in body
          ? validateEventRequest(body)
          : buildEventRequestFromText({
              requestId: body.requestId ?? `request-${Date.now()}`,
              channel: body.channel ?? "text",
              rawText: body.text
            });

      await store.saveRequest(eventRequest);
      const spec = validateAcceptedEventSpec(
        normalizeEventRequestToSpec(eventRequest, {
          sourceType:
            eventRequest.source.channel === "pdf_upload"
              ? "pdf"
              : eventRequest.source.channel === "email"
                ? "email"
                : "manual_input",
          reference: eventRequest.requestId,
          commercialState: "manual"
        })
      );

      await store.saveSpec(spec);
      return reply.code(201).send({
        eventRequest,
        acceptedEventSpec: spec
      });
    }
  );

  app.post<{ Body: DocumentBody }>("/v1/intake/documents", async (request, reply) => {
    const body = request.body;
    const documents: DocumentInput[] = body.documents.map((document) => ({
      filename: document.filename,
      mimeType: document.mimeType,
      content: Buffer.from(document.contentBase64, "base64")
    }));

    const extracted = await Promise.all(
      documents.map(async (document, index) => ({
        documentId: `${body.requestId ?? "document"}-${index + 1}`,
        text: await extractTextFromDocument(document)
      }))
    );

    const eventRequest: EventRequest = {
      schemaVersion: "1.0.0",
      requestId: body.requestId ?? `request-${Date.now()}`,
      source: {
        channel: body.channel ?? "pdf_upload",
        receivedAt: new Date().toISOString()
      },
      rawInputs: extracted.map((item) => ({
        kind: "pdf",
        content: item.text,
        mimeType: "application/pdf",
        documentId: item.documentId
      }))
    };

    const validatedRequest = validateEventRequest(eventRequest);
    const spec = validateAcceptedEventSpec(
      normalizeEventRequestToSpec(validatedRequest, {
        sourceType: "pdf",
        reference: validatedRequest.requestId,
        commercialState: "manual"
      })
    );

    await store.saveRequest(validatedRequest);
    await store.saveSpec(spec);

    return reply.code(201).send({
      eventRequest: validatedRequest,
      acceptedEventSpec: spec
    });
  });

  app.post("/v1/intake/seed-demo", async (_request, reply) => {
    const seeded = [];
    for (const eventRequest of getDemoIntakeRequests()) {
      await store.saveRequest(eventRequest);
      const spec = validateAcceptedEventSpec(
        normalizeEventRequestToSpec(eventRequest, {
          sourceType:
            eventRequest.source.channel === "pdf_upload"
              ? "pdf"
              : eventRequest.source.channel === "email"
                ? "email"
                : "manual_input",
          reference: eventRequest.requestId,
          commercialState: "manual"
        })
      );
      await store.saveSpec(spec);
      seeded.push({
        requestId: eventRequest.requestId,
        specId: spec.specId
      });
    }

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

  app.get<{ Params: { specId: string } }>("/v1/intake/specs/:specId", async (request, reply) => {
    const spec = await store.getSpec(request.params.specId);
    if (!spec) {
      return reply.code(404).send({ message: "AcceptedEventSpec not found." });
    }

    return reply.send(spec);
  });

  return app;
}
