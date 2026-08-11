import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { afterEach, describe, expect, it } from "vitest";
import {
  AuditLogStore,
  createTrustedActorResolver,
  DOCUMENT_UPLOAD_LIMITS,
  resolveMinimalMvpRoleFromTrustedActor,
  type TrustedActor
} from "@catering/shared-core";
import { registerSourceDocumentRoutes } from "../intake-service/src/routes/source-document-routes.js";
import {
  createSourceDocumentStore,
  type SourceDocumentStore,
  type StoredSourceDocument
} from "../intake-service/src/source-document-store.js";

const trustedActorSecret = "source-route-test-secret";
const temporaryRoots: string[] = [];

function createDataRoot(): string {
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-source-route-"));
  temporaryRoots.push(rootDir);
  return rootDir;
}

function trustedHeaders(businessId: string) {
  return {
    "x-catering-trusted-secret": trustedActorSecret,
    "x-catering-actor-name": "Intake-Mitarbeiter",
    "x-catering-business-id": businessId
  };
}

function multipartPayload(input: {
  filename: string;
  mimeType: string;
  content: Buffer;
  fields?: Record<string, string>;
}) {
  const boundary = `source-route-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(input.fields ?? {})) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        "utf8"
      )
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.filename}"\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
      "utf8"
    ),
    input.content,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")
  );

  return {
    body: Buffer.concat(chunks),
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    }
  };
}

async function buildHarness(input: {
  rootDir?: string;
  sourceDocumentStore?: SourceDocumentStore;
  auditWriter?: Pick<AuditLogStore, "logFor">;
} = {}) {
  const rootDir = input.rootDir ?? createDataRoot();
  const sourceDocumentStore = input.sourceDocumentStore ?? createSourceDocumentStore({ rootDir });
  const auditLog = new AuditLogStore({ rootDir });
  const app = Fastify({
    logger: false,
    bodyLimit: DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes
  });
  const resolveActor = createTrustedActorResolver({
    fallbackActorName: "Intake-Mitarbeiter",
    fallbackBusinessId: "local",
    requireTrustedBusinessId: true,
    trustedActorSecret,
    allowDevActorHeader: false
  });
  const actorForRequest = (
    request: { headers: Record<string, string | string[] | undefined> }
  ): TrustedActor => resolveActor(request);
  const requireIntakeOperator = (
    request: { headers: Record<string, string | string[] | undefined> },
    reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ): unknown | undefined => {
    try {
      return resolveMinimalMvpRoleFromTrustedActor(actorForRequest(request)) === "intake_operator"
        ? undefined
        : reply.code(403).send({ message: "Intake-Operator erforderlich." });
    } catch {
      return reply.code(403).send({ message: "Intake-Operator erforderlich." });
    }
  };

  await app.register(multipart);
  registerSourceDocumentRoutes(app, {
    sourceDocumentStore,
    auditLog: input.auditWriter ?? auditLog,
    trustedActorSecret,
    allowDevActorHeader: false,
    requireIntakeOperator,
    actorForRequest
  });
  await app.ready();

  return { app, auditLog, sourceDocumentStore };
}

afterEach(async () => {
  for (const rootDir of temporaryRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("source document routes", () => {
  it("stores one validated multipart source under a server ID and never accepts a lower client data class", async () => {
    const { app, auditLog, sourceDocumentStore } = await buildHarness();
    const confidentialText = "CONFIDENTIAL MENU: 45 guests and a private contact";
    const upload = multipartPayload({
      filename: "angebot.txt",
      mimeType: "text/plain",
      content: Buffer.from(confidentialText, "utf8"),
      fields: {
        documentId: "client-controlled-id",
        dataClass: "synthetic_demo",
        businessId: "other-business"
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/source-documents",
      headers: { ...trustedHeaders("alpha"), ...upload.headers },
      payload: upload.body
    });

    expect(response.statusCode).toBe(201);
    const metadata = response.json();
    expect(metadata.documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(metadata.documentId).not.toBe("client-controlled-id");
    expect(metadata.businessId).toBe("alpha");
    expect(metadata.dataClass).toBe("personal_confidential");
    expect(metadata).toMatchObject({
      filename: "angebot.txt",
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(confidentialText),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    await expect(
      sourceDocumentStore.getContent({ businessId: "alpha" }, metadata.documentId)
    ).resolves.toEqual(Buffer.from(confidentialText, "utf8"));

    const auditEvents = await auditLog.listRecentFor({ businessId: "alpha" }, 10);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      action: "intake.source_document_storage_registered",
      entityType: "SourceDocument",
      entityId: metadata.documentId,
      details: {
        documentId: metadata.documentId,
        sha256: metadata.sha256,
        sizeBytes: metadata.sizeBytes,
        mimeType: "text/plain"
      }
    });
    expect(Object.keys(auditEvents[0]?.details ?? {}).sort()).toEqual([
      "documentId",
      "mimeType",
      "sha256",
      "sizeBytes"
    ]);
    const auditJson = JSON.stringify(auditEvents);
    expect(auditJson).not.toContain(confidentialText);
    expect(auditJson).not.toContain("angebot.txt");
    expect(auditJson).not.toContain("synthetic_demo");

    await app.close();
  });

  it("returns metadata and original bytes only inside the trusted business context", async () => {
    const { app } = await buildHarness();
    const original = Buffer.from("%PDF-1.7 private source bytes", "utf8");
    const upload = multipartPayload({
      filename: "Köpff Angebot.pdf",
      mimeType: "application/pdf",
      content: original
    });
    const created = await app.inject({
      method: "POST",
      url: "/v1/intake/source-documents",
      headers: { ...trustedHeaders("alpha"), ...upload.headers },
      payload: upload.body
    });
    const metadata = created.json();

    const metadataResponse = await app.inject({
      method: "GET",
      url: `/v1/intake/source-documents/${metadata.documentId}`,
      headers: trustedHeaders("alpha")
    });
    expect(metadataResponse.statusCode).toBe(200);
    expect(metadataResponse.json()).toEqual(metadata);
    expect(metadataResponse.headers["cache-control"]).toBe("private, no-store");
    expect(metadataResponse.headers["x-content-type-options"]).toBe("nosniff");

    const contentResponse = await app.inject({
      method: "GET",
      url: `/v1/intake/source-documents/${metadata.documentId}/content`,
      headers: trustedHeaders("alpha")
    });
    expect(contentResponse.statusCode).toBe(200);
    expect(contentResponse.rawPayload).toEqual(original);
    expect(contentResponse.headers["content-type"]).toBe("application/pdf");
    expect(contentResponse.headers["content-disposition"]).toContain("inline;");
    expect(contentResponse.headers["content-disposition"]).toContain(
      "filename*=UTF-8''K%C3%B6pff%20Angebot.pdf"
    );
    expect(contentResponse.headers["cache-control"]).toBe("private, no-store");
    expect(contentResponse.headers["x-content-type-options"]).toBe("nosniff");

    for (const suffix of ["", "/content"]) {
      const foreignResponse = await app.inject({
        method: "GET",
        url: `/v1/intake/source-documents/${metadata.documentId}${suffix}`,
        headers: trustedHeaders("beta")
      });
      expect(foreignResponse.statusCode).toBe(404);
      expect(foreignResponse.json()).toEqual({ message: "Quelldokument nicht gefunden." });
    }

    await app.close();
  });

  it("does not store confidential bytes when their write-ahead audit cannot be registered", async () => {
    let insertCount = 0;
    const sourceDocumentStore = {
      insert: async () => {
        insertCount += 1;
        return "created" as const;
      },
      getMetadata: async () => undefined,
      getContent: async () => undefined
    } as SourceDocumentStore;
    const { app } = await buildHarness({
      sourceDocumentStore,
      auditWriter: {
        logFor: async () => {
          throw new Error("audit database unavailable at /private/var/audit.db");
        }
      }
    });
    const upload = multipartPayload({
      filename: "vertraulich.txt",
      mimeType: "text/plain",
      content: Buffer.from("vertraulicher Inhalt", "utf8")
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/source-documents",
      headers: { ...trustedHeaders("alpha"), ...upload.headers },
      payload: upload.body
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "Quelldokument konnte nicht gespeichert werden."
    });
    expect(response.body).not.toContain("/private/var");
    expect(insertCount).toBe(0);
    await app.close();
  });

  it.each([
    ["metadata", "/v1/intake/source-documents/document-1"],
    ["content", "/v1/intake/source-documents/document-1/content"]
  ] as const)("hides storage paths when %s retrieval fails", async (kind, url) => {
    const metadata: StoredSourceDocument = {
      businessId: "alpha",
      documentId: "document-1",
      filename: "angebot.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8,
      sha256: "0".repeat(64),
      dataClass: "personal_confidential",
      createdAt: "2026-08-10T10:00:00.000Z"
    };
    const sourceDocumentStore = {
      insert: async () => "created" as const,
      getMetadata: async () => {
        if (kind === "metadata") {
          throw new Error("broken source path /private/var/catering/source");
        }
        return metadata;
      },
      getContent: async () => {
        throw new Error("broken content path /private/var/catering/content");
      }
    } satisfies SourceDocumentStore;
    const { app } = await buildHarness({ sourceDocumentStore });

    const response = await app.inject({
      method: "GET",
      url,
      headers: trustedHeaders("alpha")
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "Quelldokument konnte nicht gelesen werden."
    });
    expect(response.body).not.toContain("/private/var");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    await app.close();
  });

  it.each([
    ["POST", "/v1/intake/source-documents"],
    ["GET", "/v1/intake/source-documents/unknown"],
    ["GET", "/v1/intake/source-documents/unknown/content"]
  ] as const)("requires the intake operator for %s %s", async (method, url) => {
    const { app } = await buildHarness();
    const response = await app.inject({ method, url });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ message: "Intake-Operator erforderlich." });
    await app.close();
  });

  it("rejects unsupported MIME and extension combinations without storing or auditing", async () => {
    const { app, auditLog } = await buildHarness();
    const upload = multipartPayload({
      filename: "angebot.pdf",
      mimeType: "text/plain",
      content: Buffer.from("not really a PDF", "utf8")
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/source-documents",
      headers: { ...trustedHeaders("alpha"), ...upload.headers },
      payload: upload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("MIME-Typ");
    await expect(auditLog.listRecentFor({ businessId: "alpha" }, 10)).resolves.toEqual([]);
    await app.close();
  });

  it("keeps the existing 25 MB intake file limit on the source endpoint", async () => {
    const { app, auditLog } = await buildHarness();
    const upload = multipartPayload({
      filename: "zu-gross.txt",
      mimeType: "text/plain",
      content: Buffer.alloc(DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes + 1, 97)
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/source-documents",
      headers: { ...trustedHeaders("alpha"), ...upload.headers },
      payload: upload.body
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      message: "Die Datei ist zu groß. Maximal erlaubt sind 26214400 Bytes."
    });
    await expect(auditLog.listRecentFor({ businessId: "alpha" }, 10)).resolves.toEqual([]);
    await app.close();
  });

  it("returns 400 for a non-multipart request and 404 for an unknown source", async () => {
    const { app } = await buildHarness();

    const nonMultipart = await app.inject({
      method: "POST",
      url: "/v1/intake/source-documents",
      headers: trustedHeaders("alpha"),
      payload: { dataClass: "synthetic_demo" }
    });
    expect(nonMultipart.statusCode).toBe(400);
    expect(nonMultipart.json()).toEqual({ message: "Es wurde kein Multipart-Upload gesendet." });

    const missing = await app.inject({
      method: "GET",
      url: "/v1/intake/source-documents/not-found",
      headers: trustedHeaders("alpha")
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ message: "Quelldokument nicht gefunden." });
    await app.close();
  });
});
