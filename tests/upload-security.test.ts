import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "@catering/intake-service";
import { buildOfferApp } from "@catering/offer-service";
import { buildProductionApp } from "@catering/production-service";
import { DOCUMENT_UPLOAD_LIMITS } from "@catering/shared-core";

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
    expect((await response.json()).message).toMatch(/gross|large/i);
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
    await app.close();
  });
});
