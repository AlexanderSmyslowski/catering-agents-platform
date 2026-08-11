import { describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { IntakeStore } from "../intake-service/src/store.js";
import {
  createSourceDocumentStore,
  type SourceDocumentStore
} from "../intake-service/src/source-document-store.js";
import {
  AuditLogStore,
  buildProductionConversationProjection
} from "@catering/shared-core";
import { renderProductionPlanHtml } from "@catering/print-export";

function createDataRoot(): string {
  return `${process.cwd()}/tmp/pa11-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function multipartDocumentPayload(input: {
  requestId: string;
  channel: string;
  filename: string;
  mimeType: string;
  content: Buffer;
}) {
  const boundary = `pa11-${Math.random().toString(16).slice(2)}`;
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="requestId"\r\n\r\n${input.requestId}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="channel"\r\n\r\n${input.channel}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.filename}"\r\n` +
        `Content-Type: ${input.mimeType}\r\n\r\n`,
        "utf8"
      ),
      input.content,
      Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")
    ])
  };
}

describe("PA11 intake DocumentIngestion bridge", () => {
  it("rejects an invalid request envelope before original source bytes are stored", async () => {
    let insertCount = 0;
    const sourceDocumentStore: SourceDocumentStore = {
      insert: async () => {
        insertCount += 1;
        return "created";
      },
      getMetadata: async () => undefined,
      getContent: async () => undefined
    };
    const app = buildIntakeApp({
      rootDir: createDataRoot(),
      sourceDocumentStore
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-invalid-envelope",
        channel: "not-an-intake-channel",
        documents: [
          {
            filename: "angebot.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from("Vertrauliches Angebot", "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(insertCount).toBe(0);
    await app.close();
  });

  it("does not expose internal source-storage paths in an upload error", async () => {
    const sourceDocumentStore: SourceDocumentStore = {
      insert: async () => {
        throw new Error("Source document path contains a symbolic link: /private/var/catering/businesses");
      },
      getMetadata: async () => undefined,
      getContent: async () => undefined
    };
    const app = buildIntakeApp({
      rootDir: createDataRoot(),
      sourceDocumentStore
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-storage-error",
        channel: "text",
        documents: [
          {
            filename: "angebot.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from("Lunch für 20 Personen", "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "Dokument konnte nicht verarbeitet werden."
    });
    expect(response.body).not.toContain("/private/var");
    await app.close();
  });

  it("audits a stored original before a later intake persistence failure", async () => {
    const rootDir = createDataRoot();
    const auditLog = new AuditLogStore({ rootDir });
    const sourceDocumentStore = createSourceDocumentStore({ rootDir });
    const store = new IntakeStore({ rootDir });
    store.saveRequest = async () => {
      throw new Error("simulated intake persistence failure");
    };
    const app = buildIntakeApp({ rootDir, auditLog, sourceDocumentStore, store });
    const confidentialText = "Vertrauliches Angebot für 20 Personen";

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-downstream-failure",
        channel: "text",
        documents: [
          {
            filename: "angebot.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from(confidentialText, "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(500);
    const events = await auditLog.listRecentFor({ businessId: "local" }, 10);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "intake.source_document_storage_registered",
      entityType: "SourceDocument",
      details: {
        documentId: expect.any(String),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        sizeBytes: Buffer.byteLength(confidentialText),
        mimeType: "text/plain"
      }
    });
    expect(JSON.stringify(events)).not.toContain(confidentialText);
    expect(JSON.stringify(events)).not.toContain("angebot.txt");
    await app.close();
  });

  it("does not store an integrated original when its write-ahead audit cannot be registered", async () => {
    const rootDir = createDataRoot();
    let insertCount = 0;
    const sourceDocumentStore: SourceDocumentStore = {
      insert: async () => {
        insertCount += 1;
        return "created";
      },
      getMetadata: async () => undefined,
      getContent: async () => undefined
    };
    const auditLog = new AuditLogStore({ rootDir });
    auditLog.logFor = async () => {
      throw new Error("audit storage unavailable at /private/var/audit.db");
    };
    const app = buildIntakeApp({ rootDir, auditLog, sourceDocumentStore });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-audit-compensation",
        channel: "text",
        documents: [
          {
            filename: "angebot.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from("Vertrauliches Angebot", "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ message: "Dokument konnte nicht verarbeitet werden." });
    expect(response.body).not.toContain("/private/var");
    expect(insertCount).toBe(0);
    await app.close();
  });

  it("transports safe ingestion status for the JSON/base64 text document path", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-json-text",
        channel: "text",
        documents: [
          {
            filename: "angebot.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from(
              "Lunch am 2026-05-14 fuer 42 Teilnehmer mit Buffet und Dessert.",
              "utf8"
            ).toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.acceptedEventSpec.attendees.expected).toBe(42);
    expect(body.documentIngestion.documents).toHaveLength(1);
    expect(body.documentIngestion.documents[0]).toMatchObject({
      ingestionStatus: "extracted",
      warnings: [],
      sourceMetadata: {
        filename: "angebot.txt",
        mimeType: "text/plain",
        uploadContext: "intake"
      }
    });
    expect(body.documentIngestion.documents[0].documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(body.documentIngestion.documents[0].sourceMetadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body.documentIngestion)).not.toContain("Lunch am 2026-05-14");

    await app.close();
  });

  it("persists the original upload under an unpredictable source ID across app reloads", async () => {
    const rootDir = createDataRoot();
    const original = Buffer.from(
      "Originalangebot: Lunch am 2026-05-14 für 42 Personen.",
      "utf8"
    );
    const app = buildIntakeApp({ rootDir });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-persistent-source",
        channel: "text",
        documents: [
          {
            filename: "angebot.txt",
            mimeType: "text/plain",
            contentBase64: original.toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const documentId = response.json().documentIngestion.documents[0].documentId;
    expect(documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(documentId).not.toContain("pa11-persistent-source");
    await app.close();

    const reloadedApp = buildIntakeApp({ rootDir });
    const contentResponse = await reloadedApp.inject({
      method: "GET",
      url: `/v1/intake/source-documents/${documentId}/content`
    });

    expect(contentResponse.statusCode).toBe(200);
    expect(contentResponse.rawPayload).toEqual(original);
    expect(contentResponse.headers["content-type"]).toBe("text/plain");
    await reloadedApp.close();
  });

  it("persists multipart originals as personal-confidential evidence across app reloads", async () => {
    const rootDir = createDataRoot();
    const original = Buffer.from(
      "Multipart-Originalangebot: Empfang für 45 Personen.",
      "utf8"
    );
    const upload = multipartDocumentPayload({
      requestId: "pa11-multipart-persistent-source",
      channel: "pdf_upload",
      filename: "angebot.txt",
      mimeType: "text/plain",
      content: original
    });
    const app = buildIntakeApp({ rootDir });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents/upload",
      headers: upload.headers,
      payload: upload.body
    });

    expect(response.statusCode).toBe(201);
    const documentId = response.json().documentIngestion.documents[0].documentId;
    expect(documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    await app.close();

    const reloadedStore = createSourceDocumentStore({ rootDir });
    await expect(reloadedStore.getMetadata({ businessId: "local" }, documentId)).resolves.toMatchObject({
      documentId,
      filename: "angebot.txt",
      mimeType: "text/plain",
      dataClass: "personal_confidential",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    await expect(reloadedStore.getContent({ businessId: "local" }, documentId)).resolves.toEqual(original);

    const reloadedApp = buildIntakeApp({ rootDir });
    const contentResponse = await reloadedApp.inject({
      method: "GET",
      url: `/v1/intake/source-documents/${documentId}/content`
    });
    expect(contentResponse.statusCode).toBe(200);
    expect(contentResponse.rawPayload).toEqual(original);
    expect(contentResponse.headers["cache-control"]).toBe("private, no-store");
    await reloadedApp.close();
  });

  it("returns an ingestion warning for PDF fallback instead of claiming extracted success", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-pdf-fallback",
        channel: "pdf_upload",
        documents: [
          {
            filename: "angebot.pdf",
            mimeType: "application/pdf",
            contentBase64: Buffer.from("%PDF-1.7\n%%EOF", "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.documentIngestion.documents[0]).toMatchObject({
      ingestionStatus: "fallback",
      warnings: ["document_text_extraction_fallback"],
      sourceMetadata: {
        filename: "angebot.pdf",
        mimeType: "application/pdf",
        uploadContext: "intake"
      }
    });
    expect(body.documentIngestion.documents[0].documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(body.eventRequest.rawInputs[0].documentIngestion).toEqual({
      status: "fallback",
      warnings: ["document_text_extraction_fallback"]
    });
    expect(body.acceptedEventSpec.readiness.status).not.toBe("complete");
    expect(JSON.stringify(body.documentIngestion)).not.toContain("%PDF");
    expect(JSON.stringify(body.eventRequest.rawInputs[0].documentIngestion)).not.toContain("%PDF");

    await app.close();
  });

  it("keeps raw extracted text out of conversation and export provenance anchors", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });
    const rawText = "Geheimer PA11 Rohtext: Lunch am 2026-05-14 fuer 33 Teilnehmer.";

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        requestId: "pa11-anchor-safety",
        channel: "text",
        documents: [
          {
            filename: "anchor.txt",
            mimeType: "text/plain",
            contentBase64: Buffer.from(rawText, "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    const projection = buildProductionConversationProjection({
      spec: body.acceptedEventSpec,
      questions: [],
      sourceInputs: body.eventRequest.rawInputs,
      productionPlans: [
        {
          planId: "plan-pa11",
          specId: body.acceptedEventSpec.specId
        }
      ],
      purchaseLists: [
        {
          purchaseListId: "purchase-pa11",
          planId: "plan-pa11"
        }
      ]
    });
    const exportHtml = renderProductionPlanHtml({
      schemaVersion: "1.0.0",
      planId: "plan-pa11",
      eventSpecId: body.acceptedEventSpec.specId,
      readiness: { status: "draft", reasons: [] },
      productionBatches: [],
      timeline: [],
      kitchenSheets: [],
      recipeSelections: [],
      unresolvedItems: [],
      sourceAnchors: projection.messages.find((message) => message.type === "production_output_anchor")?.sourceAnchors
    } as never);

    expect(JSON.stringify(projection.messages.filter((message: { type: string }) => message.type.includes("anchor")))).not.toContain(rawText);
    expect(exportHtml).not.toContain(rawText);
    expect(JSON.stringify(body.documentIngestion)).not.toContain(rawText);

    await app.close();
  });
});
