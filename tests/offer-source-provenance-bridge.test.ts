import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOfferApp } from "@catering/offer-service";
import { AuditLogStore } from "@catering/shared-core";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { createSourceDocumentStore } from "../intake-service/src/source-document-store.js";
import { HttpSourceDocumentMetadataReader } from "../offer-service/src/gateways/http-source-document-metadata-reader.js";
import { OfferStore } from "../offer-service/src/store.js";
import type {
  SourceDocumentMetadataReader,
  StoredSourceDocument
} from "../offer-service/src/ports/source-document-reader.js";

const trustedSecret = "offer-provenance-secret";
const headers = {
  "x-catering-trusted-secret": trustedSecret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "alpha"
};
const roots: string[] = [];

const serverMetadata: StoredSourceDocument = {
  businessId: "alpha",
  documentId: "source-server-1",
  filename: "server-authoritative.pdf",
  mimeType: "application/pdf",
  sizeBytes: 42,
  sha256: "a".repeat(64),
  dataClass: "personal_confidential",
  createdAt: "2026-08-13T10:00:00.000Z"
};

function buildHarness(reader: SourceDocumentMetadataReader) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-offer-provenance-"));
  roots.push(rootDir);
  const store = new OfferStore({ rootDir });
  const app = buildOfferApp({
    rootDir,
    store,
    auditLog: new AuditLogStore({ rootDir }),
    sourceDocumentReader: reader,
    trustedActorSecret: trustedSecret,
    env: {
      CATERING_DEFAULT_BUSINESS_ID: "alpha",
      CATERING_TRUSTED_ACTOR_SECRET: trustedSecret
    }
  });
  return { app, store };
}

async function createCase(app: ReturnType<typeof buildOfferApp>) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/offers/cases",
    headers,
    payload: { customerName: "Provenienz", eventTypeLabel: "Empfang" }
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ case: { caseId: string } }>().case.caseId;
}

function eventRequest(documentId: string, sourceMetadata: Record<string, unknown>) {
  return {
    schemaVersion: "1.0.0",
    requestId: `request-${documentId}`,
    source: { channel: "pdf_upload", receivedAt: "2026-08-13T10:00:00.000Z" },
    rawInputs: [{
      kind: "pdf",
      content: "server-validated content",
      documentId,
      sourceMetadata
    }]
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("serverseitige Angebots-Provenienzbrücke", () => {
  it("uses only server-verified source metadata for the case history", async () => {
    const reader: SourceDocumentMetadataReader = {
      getMetadata: vi.fn(async (_context, documentId) =>
        documentId === "source-server-1" ? serverMetadata : undefined
      )
    };
    const harness = buildHarness(reader);
    const caseId = await createCase(harness.app);
    const response = await harness.app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers,
      payload: {
        caseId,
        ...eventRequest("source-server-1", {
          filename: "client-forged.pdf",
          mimeType: "text/plain",
          sizeBytes: 1,
          sha256: "b".repeat(64),
          ingestedAt: "2020-01-01T00:00:00.000Z",
          uploadContext: "offer"
        })
      }
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(reader.getMetadata).toHaveBeenCalledWith({ businessId: "alpha" }, "source-server-1");
    const events = await harness.store.listEvents({ businessId: "alpha" }, caseId);
    const sourceEvent = events.find((event) => event.kind === "source_added");
    expect(sourceEvent?.sourceRef).toEqual({
      sourceId: serverMetadata.documentId,
      documentId: serverMetadata.documentId,
      filename: serverMetadata.filename,
      mimeType: serverMetadata.mimeType,
      sha256: serverMetadata.sha256,
      dataClass: serverMetadata.dataClass,
      addedAt: serverMetadata.createdAt
    });
    expect(JSON.stringify(sourceEvent)).not.toContain("client-forged.pdf");
  });

  it("rejects an unregistered document before any draft or source event is written", async () => {
    const reader: SourceDocumentMetadataReader = {
      getMetadata: vi.fn(async () => undefined)
    };
    const harness = buildHarness(reader);
    const caseId = await createCase(harness.app);
    const response = await harness.app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers,
      payload: {
        caseId,
        ...eventRequest("source-unknown", {
          filename: "client-forged.pdf",
          mimeType: "application/pdf",
          sizeBytes: 42,
          sha256: "b".repeat(64),
          ingestedAt: "2026-08-13T10:00:00.000Z",
          uploadContext: "offer"
        })
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ message: "Quelldokument konnte nicht verifiziert werden." });
    expect(await harness.store.listEvents({ businessId: "alpha" }, caseId)).toHaveLength(1);
  });

  it("does not promote client-only source metadata without a registered document identity", async () => {
    const reader: SourceDocumentMetadataReader = {
      getMetadata: vi.fn()
    };
    const harness = buildHarness(reader);
    const caseId = await createCase(harness.app);
    const response = await harness.app.inject({
      method: "POST",
      url: "/v1/offers/drafts",
      headers,
      payload: {
        caseId,
        schemaVersion: "1.0.0",
        requestId: "request-client-only-metadata",
        source: { channel: "pdf_upload", receivedAt: "2026-08-13T10:00:00.000Z" },
        rawInputs: [{
          kind: "pdf",
          content: "document without registered identity",
          sourceMetadata: {
            filename: "client-only.pdf",
            mimeType: "application/pdf",
            sizeBytes: 42,
            sha256: "b".repeat(64),
            ingestedAt: "2026-08-13T10:00:00.000Z",
            uploadContext: "offer"
          }
        }]
      }
    });

    expect(response.statusCode, response.body).toBe(201);
    expect(reader.getMetadata).not.toHaveBeenCalled();
    expect((await harness.store.listEvents({ businessId: "alpha" }, caseId))
      .some((event) => event.kind === "source_added")).toBe(false);
  });

  it("uses the authenticated Offer-Service boundary to read registered metadata", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-offer-provenance-intake-"));
    roots.push(rootDir);
    const sourceDocumentStore = createSourceDocumentStore({ rootDir });
    const content = new Uint8Array(42);
    const registeredMetadata = {
      ...serverMetadata,
      sha256: createHash("sha256").update(content).digest("hex")
    } satisfies StoredSourceDocument;
    await sourceDocumentStore.insert({ businessId: "alpha" }, registeredMetadata, content);
    const intakeApp = buildIntakeApp({
      rootDir,
      sourceDocumentStore,
      trustedActorSecret: trustedSecret,
      env: {
        CATERING_DEFAULT_BUSINESS_ID: "alpha",
        CATERING_TRUSTED_ACTOR_SECRET: trustedSecret
      }
    });
    const reader = new HttpSourceDocumentMetadataReader({
      intakeServiceUrl: "http://intake.internal",
      trustedServiceSecret: trustedSecret,
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const response = await intakeApp.inject({
          method: "GET",
          url: `${url.pathname}${url.search}`,
          headers: Object.fromEntries(new Headers(init?.headers).entries())
        });
        return new Response(Uint8Array.from(response.rawPayload).buffer, {
          status: response.statusCode,
          headers: response.headers as HeadersInit
        });
      }
    });

    await expect(reader.getMetadata({ businessId: "alpha" }, registeredMetadata.documentId))
      .resolves.toEqual(registeredMetadata);
    await expect(reader.getMetadata({ businessId: "beta" }, registeredMetadata.documentId))
      .rejects.toThrow("Quelldokument");
    await intakeApp.close();
  });
});
