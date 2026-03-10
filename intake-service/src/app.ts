import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
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
