import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import {
  createSourceDocumentStore,
  type StoredSourceDocument
} from "../intake-service/src/source-document-store.js";
import { HttpSourceDocumentReader } from "../production-service/src/gateways/http-source-document-reader.js";

const sharedSecret = "shared-secret";
const alpha = { businessId: "alpha" };

function injectedFetch(app: ReturnType<typeof buildIntakeApp>): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    const response = await app.inject({
      method: "GET",
      url: `${url.pathname}${url.search}`,
      headers: Object.fromEntries(new Headers(init?.headers).entries())
    });
    return new Response(Uint8Array.from(response.rawPayload).buffer, {
      status: response.statusCode,
      headers: response.headers as HeadersInit
    });
  };
}

describe("production source document reader", () => {
  it("reads metadata and bytes only through the internal tenant-scoped boundary", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "source-reader-"));
    const sourceDocumentStore = createSourceDocumentStore({ rootDir });
    const content = Buffer.from("%PDF-1.7 private source", "utf8");
    const metadata: StoredSourceDocument = {
      businessId: "alpha",
      documentId: "source-alpha",
      filename: "angebot.pdf",
      mimeType: "application/pdf",
      sizeBytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      dataClass: "personal_confidential",
      createdAt: "2026-08-10T10:00:00.000Z"
    };
    await sourceDocumentStore.insert(alpha, metadata, content);
    const app = buildIntakeApp({
      rootDir,
      sourceDocumentStore,
      trustedActorSecret: sharedSecret,
      env: {
        CATERING_DEFAULT_BUSINESS_ID: "alpha",
        CATERING_TRUSTED_ACTOR_SECRET: sharedSecret
      }
    });
    const reader = new HttpSourceDocumentReader({
      intakeServiceUrl: "http://intake.internal/",
      trustedServiceSecret: sharedSecret,
      fetch: injectedFetch(app)
    });

    await expect(reader.getMetadata(alpha, metadata.documentId)).resolves.toEqual(metadata);
    await expect(reader.getContent(alpha, metadata.documentId)).resolves.toEqual(new Uint8Array(content));
    await expect(reader.getMetadata({ businessId: "beta" }, metadata.documentId))
      .rejects.toThrow("Quelldokument");
    await expect(reader.getContent({ businessId: "beta" }, metadata.documentId))
      .rejects.toThrow("Quelldokument");
    await app.close();
  });

  it("rejects metadata whose document or business identity does not match the request", async () => {
    const reader = new HttpSourceDocumentReader({
      intakeServiceUrl: "http://intake.internal",
      fetch: async () => new Response(JSON.stringify({
        sourceDocument: {
          businessId: "other",
          documentId: "wrong-id",
          filename: "angebot.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          sha256: "a".repeat(64),
          dataClass: "personal_confidential",
          createdAt: "2026-08-10T10:00:00.000Z"
        }
      }), { status: 200, headers: { "content-type": "application/json" } })
    });

    await expect(reader.getMetadata(alpha, "source-alpha")).rejects.toThrow("Quelldokument");
  });
});
