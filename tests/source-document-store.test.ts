import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";
import {
  createSourceDocumentStore,
  SourceDocumentConflictError,
  type SourceDocumentStoreOptions,
  type StoredSourceDocument
} from "../intake-service/src/source-document-store.js";

type StorageMode = "file" | "postgres";

const alpha = { businessId: "alpha" };
const beta = { businessId: "beta" };

function sourceMetadata(input: {
  businessId?: string;
  documentId?: string;
  content?: Uint8Array;
  sizeBytes?: number;
  sha256?: string;
} = {}): StoredSourceDocument {
  const content = input.content ?? Buffer.from("pdf-bytes", "utf8");
  return {
    businessId: input.businessId ?? alpha.businessId,
    documentId: input.documentId ?? "document-1",
    filename: "angebot.pdf",
    mimeType: "application/pdf",
    sizeBytes: input.sizeBytes ?? content.byteLength,
    sha256: input.sha256 ?? createHash("sha256").update(content).digest("hex"),
    dataClass: "personal_confidential",
    createdAt: "2026-08-10T10:00:00.000Z"
  };
}

function storageOptions(mode: StorageMode): SourceDocumentStoreOptions {
  if (mode === "file") {
    return {
      rootDir: mkdtempSync(path.join(tmpdir(), "catering-source-documents-"))
    };
  }

  const database = newDb();
  const { Pool } = database.adapters.createPg();
  return {
    pgPool: new Pool()
  };
}

describe("persistent source document store", () => {
  it.each(["file", "postgres"] as const)(
    "persists metadata and exact source bytes across a %s store reload",
    async (mode) => {
      const options = storageOptions(mode);
      const firstStore = createSourceDocumentStore(options);
      const content = Buffer.from("%PDF-1.7\nsource document\n%%EOF", "utf8");
      const metadata = sourceMetadata({ content });

      await expect(firstStore.insert(alpha, metadata, content)).resolves.toBe("created");

      const reloadedStore = createSourceDocumentStore(options);
      await expect(reloadedStore.getMetadata(alpha, metadata.documentId)).resolves.toEqual(metadata);
      await expect(reloadedStore.getContent(alpha, metadata.documentId)).resolves.toEqual(content);
    }
  );

  it.each(["file", "postgres"] as const)(
    "isolates identical document IDs between businesses in %s storage",
    async (mode) => {
      const store = createSourceDocumentStore(storageOptions(mode));
      const alphaContent = Buffer.from("alpha-secret", "utf8");
      const betaContent = Buffer.from("beta-secret", "utf8");
      const alphaMetadata = sourceMetadata({ content: alphaContent });
      const betaMetadata = sourceMetadata({
        businessId: beta.businessId,
        content: betaContent
      });

      await store.insert(alpha, alphaMetadata, alphaContent);
      await store.insert(beta, betaMetadata, betaContent);

      await expect(store.getContent(alpha, alphaMetadata.documentId)).resolves.toEqual(alphaContent);
      await expect(store.getContent(beta, betaMetadata.documentId)).resolves.toEqual(betaContent);
      await expect(store.getMetadata({ businessId: "gamma" }, alphaMetadata.documentId)).resolves.toBeUndefined();
    }
  );

  it.each(["file", "postgres"] as const)(
    "treats a repeated ID with identical content as idempotent in %s storage",
    async (mode) => {
      const store = createSourceDocumentStore(storageOptions(mode));
      const content = Buffer.from("same-source", "utf8");
      const metadata = sourceMetadata({ content });

      await expect(store.insert(alpha, metadata, content)).resolves.toBe("created");
      await expect(store.insert(alpha, metadata, content)).resolves.toBe("same_content");
      await expect(store.getContent(alpha, metadata.documentId)).resolves.toEqual(content);
    }
  );

  it.each(["file", "postgres"] as const)(
    "rejects a repeated ID with divergent content in %s storage",
    async (mode) => {
      const store = createSourceDocumentStore(storageOptions(mode));
      const firstContent = Buffer.from("first-source", "utf8");
      const secondContent = Buffer.from("second-source", "utf8");
      const firstMetadata = sourceMetadata({ content: firstContent });
      const secondMetadata = sourceMetadata({ content: secondContent });

      await store.insert(alpha, firstMetadata, firstContent);

      const insertion = store.insert(alpha, secondMetadata, secondContent);
      await expect(insertion).rejects.toBeInstanceOf(SourceDocumentConflictError);
      await expect(insertion).rejects.toMatchObject({ statusCode: 409 });
      await expect(store.getContent(alpha, firstMetadata.documentId)).resolves.toEqual(firstContent);
    }
  );

  it.each(["file", "postgres"] as const)(
    "rejects metadata whose byte count does not match the source in %s storage",
    async (mode) => {
      const store = createSourceDocumentStore(storageOptions(mode));
      const content = Buffer.from("source", "utf8");
      const metadata = sourceMetadata({ content, sizeBytes: content.byteLength + 1 });

      await expect(store.insert(alpha, metadata, content)).rejects.toThrow(/sizeBytes/i);
      await expect(store.getMetadata(alpha, metadata.documentId)).resolves.toBeUndefined();
    }
  );

  it.each(["file", "postgres"] as const)(
    "rejects metadata whose hash does not match the source in %s storage",
    async (mode) => {
      const store = createSourceDocumentStore(storageOptions(mode));
      const content = Buffer.from("source", "utf8");
      const metadata = sourceMetadata({ content, sha256: "0".repeat(64) });

      await expect(store.insert(alpha, metadata, content)).rejects.toThrow(/sha256/i);
      await expect(store.getMetadata(alpha, metadata.documentId)).resolves.toBeUndefined();
    }
  );

  it.each(["file", "postgres"] as const)(
    "rejects metadata owned by a different business in %s storage",
    async (mode) => {
      const store = createSourceDocumentStore(storageOptions(mode));
      const content = Buffer.from("source", "utf8");
      const metadata = sourceMetadata({ businessId: beta.businessId, content });

      await expect(store.insert(alpha, metadata, content)).rejects.toThrow(/Betriebskontext/i);
      await expect(store.getMetadata(alpha, metadata.documentId)).resolves.toBeUndefined();
    }
  );

  it("does not expose a partial file document when publication fails", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-source-documents-crash-"));
    const content = Buffer.from("atomic-source", "utf8");
    const metadata = sourceMetadata({ content });
    const failingStore = createSourceDocumentStore({
      rootDir,
      fileFaultInjector: (phase) => {
        if (phase === "before_publish") throw new Error("simulated crash");
      }
    });

    await expect(failingStore.insert(alpha, metadata, content)).rejects.toThrow("simulated crash");
    const reloadedStore = createSourceDocumentStore({ rootDir });
    await expect(reloadedStore.getMetadata(alpha, metadata.documentId)).resolves.toBeUndefined();
    await expect(reloadedStore.getContent(alpha, metadata.documentId)).resolves.toBeUndefined();
    await expect(reloadedStore.insert(alpha, metadata, content)).resolves.toBe("created");
  });

  it("recovers idempotently when a file document was published before a crash", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-source-documents-retry-"));
    const content = Buffer.from("published-source", "utf8");
    const metadata = sourceMetadata({ content });
    const failingStore = createSourceDocumentStore({
      rootDir,
      fileFaultInjector: (phase) => {
        if (phase === "after_publish") throw new Error("simulated crash");
      }
    });

    await expect(failingStore.insert(alpha, metadata, content)).rejects.toThrow("simulated crash");
    const reloadedStore = createSourceDocumentStore({ rootDir });
    await expect(reloadedStore.insert(alpha, metadata, content)).resolves.toBe("same_content");
    await expect(reloadedStore.getContent(alpha, metadata.documentId)).resolves.toEqual(content);
  });

  it("rejects a symbolic-link escape beneath the business source root", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-source-documents-symlink-"));
    const outside = mkdtempSync(path.join(tmpdir(), "catering-source-documents-outside-"));
    const intakeDirectory = path.join(rootDir, "businesses", alpha.businessId, "intake");
    mkdirSync(intakeDirectory, { recursive: true });
    symlinkSync(outside, path.join(intakeDirectory, "source-documents"));
    const content = Buffer.from("must-stay-contained", "utf8");
    const metadata = sourceMetadata({ content });
    const store = createSourceDocumentStore({ rootDir });

    await expect(store.insert(alpha, metadata, content)).rejects.toThrow(/symbolic link/i);
    await expect(store.getContent(alpha, metadata.documentId)).rejects.toThrow(/symbolic link/i);
  });
});
