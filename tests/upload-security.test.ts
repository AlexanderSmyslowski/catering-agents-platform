import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "@catering/intake-service";
import { buildOfferApp } from "@catering/offer-service";
import { buildProductionApp } from "@catering/production-service";
import {
  base64EncodedLength,
  createUploadSourceMetadata,
  DOCUMENT_UPLOAD_LIMITS,
  validateUploadedDocumentSize
} from "@catering/shared-core";
import { intakeDocumentJsonRouteOptions } from "../intake-service/src/routes/document-routes.js";

const dataRoots: string[] = [];

function createDataRoot(): string {
  const dataRoot = mkdtempSync(path.join(tmpdir(), "catering-upload-security-"));
  dataRoots.push(dataRoot);
  return dataRoot;
}

function recipeText(name: string): string {
  return [
    name,
    "Zutaten",
    "500 g Kichererbsen",
    "150 ml Olivenoel",
    "Zubereitung",
    "1. Zutaten vorbereiten.",
    "2. Alles mischen.",
    "3. Kalt stellen."
  ].join("\n");
}

async function postMultipart(address: string, path: string, file: Blob, filename: string): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file, filename);
  return await fetch(`${address}${path}`, {
    method: "POST",
    body: formData
  });
}

afterEach(() => {
  for (const dataRoot of dataRoots.splice(0)) {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

describe("upload security limits", () => {
  it("keeps the shared intake document limit viable for ordinary request files", () => {
    expect(DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes).toBe(25 * 1024 * 1024);
    expect(DOCUMENT_UPLOAD_LIMITS.intake.maxJsonBodyBytes).toBe(
      base64EncodedLength(DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes) + 2 * 1024 * 1024
    );
    expect(DOCUMENT_UPLOAD_LIMITS.recipe.maxFileSizeBytes).toBe(5 * 1024 * 1024);

    expect(() => {
      validateUploadedDocumentSize(DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes - 1, "intake");
    }).not.toThrow();

    expect(() => {
      validateUploadedDocumentSize(DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes + 1, "intake");
    }).toThrow(/Maximal erlaubt/);
  });

  it("keeps the JSON/base64 intake route body limit above the valid 25 MB file envelope", () => {
    const validFileBase64Length = base64EncodedLength(DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes);
    const conservativeJsonEnvelopeBytes = validFileBase64Length + 1024 * 1024;

    expect(DOCUMENT_UPLOAD_LIMITS.intake.maxJsonBodyBytes).toBeGreaterThan(conservativeJsonEnvelopeBytes);
    expect(intakeDocumentJsonRouteOptions.bodyLimit).toBe(DOCUMENT_UPLOAD_LIMITS.intake.maxJsonBodyBytes);
  });

  it("creates deterministic upload source metadata", () => {
    const metadata = createUploadSourceMetadata({
      filename: "Angebot.txt",
      mimeType: "text/plain; charset=utf-8",
      content: Buffer.from("Lunch fuer 20 Personen", "utf8"),
      uploadContext: "intake",
      ingestedAt: "2026-05-21T10:00:00.000Z"
    });

    expect(metadata).toEqual({
      filename: "Angebot.txt",
      mimeType: "text/plain",
      sizeBytes: 22,
      sha256: "44df5c6bb17828b242fa96cd873be7e535be26cc742aecadd77237b1f86db31d",
      ingestedAt: "2026-05-21T10:00:00.000Z",
      uploadContext: "intake"
    });
  });

  it("rejects oversized intake multipart files with a controlled status", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const oversizedText = "x".repeat(DOCUMENT_UPLOAD_LIMITS.intake.maxFileSizeBytes + 1);

    const response = await postMultipart(
      address,
      "/v1/intake/documents/upload",
      new Blob([oversizedText], { type: "text/plain" }),
      "angebot.txt"
    );

    expect(response.status).toBe(413);
    expect((await response.json()).message).toBe("Die Datei ist zu groß. Maximal erlaubt sind 26214400 Bytes.");
    await app.close();
  });

  it("rejects unsupported intake upload extensions and mime types", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });

    const response = await app.inject({
      method: "POST",
      url: "/v1/intake/documents",
      payload: {
        channel: "text",
        documents: [
          {
            filename: "angebot.exe",
            mimeType: "application/x-msdownload",
            contentBase64: Buffer.from("Lunch fuer 20 Personen", "utf8").toString("base64")
          }
        ]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toMatch(/nicht erlaubt/i);
    await app.close();
  });

  it("keeps allowed intake text uploads working", async () => {
    const app = buildIntakeApp({ rootDir: createDataRoot() });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await postMultipart(
      address,
      "/v1/intake/documents/upload",
      new Blob(["Lunch am 2026-05-14 fuer 120 Teilnehmer mit Buffet."], { type: "text/plain" }),
      "angebot.txt"
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.acceptedEventSpec.attendees.expected).toBe(120);
    expect(body.eventRequest.rawInputs[0].sourceMetadata).toMatchObject({
      filename: "angebot.txt",
      mimeType: "text/plain",
      sizeBytes: 51,
      uploadContext: "intake"
    });
    expect(body.eventRequest.rawInputs[0].sourceMetadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(body.documentIngestion.documents[0]).toMatchObject({
      ingestionStatus: "extracted",
      warnings: [],
      sourceMetadata: {
        filename: "angebot.txt",
        mimeType: "text/plain",
        sizeBytes: 51,
        uploadContext: "intake"
      }
    });
    expect(JSON.stringify(body.documentIngestion)).not.toContain("Lunch am 2026-05-14");
    await app.close();
  });

  it("rejects unsupported offer recipe upload mime types", async () => {
    const app = buildOfferApp({ rootDir: createDataRoot() });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await postMultipart(
      address,
      "/v1/offers/recipes/upload",
      new Blob([recipeText("Humus Bowl")], { type: "application/json" }),
      "recipe.txt"
    );

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/MIME-Typ|nicht erlaubt/);
    await app.close();
  });

  it("keeps allowed production recipe text uploads working", async () => {
    const app = buildProductionApp({ dataRoot: createDataRoot() });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await postMultipart(
      address,
      "/v1/production/recipes/upload",
      new Blob([recipeText("Tomatensalsa")], { type: "text/plain" }),
      "tomatensalsa.txt"
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.recipe.name).toBe("Tomatensalsa");
    expect(body.recipe.source.sourceMetadata).toMatchObject({
      filename: "tomatensalsa.txt",
      mimeType: "text/plain",
      uploadContext: "production"
    });
    expect(body.recipe.source.sourceMetadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    await app.close();
  });
});
