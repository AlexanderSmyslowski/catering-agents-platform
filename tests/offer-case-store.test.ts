import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OfferStore } from "../offer-service/src/store.js";
import { copyCaseForNewEvent, type OfferCase } from "@catering/shared-core";

const roots: string[] = [];
const alpha = { businessId: "alpha" };
const beta = { businessId: "beta" };

function dataRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "catering-offer-cases-"));
  roots.push(root);
  return root;
}

function offerCase(
  businessId: string,
  displayName: string,
  overrides: Partial<OfferCase> = {}
): OfferCase {
  return {
    schemaVersion: "1.0",
    businessId,
    caseId: "offer-case-shared",
    product: "offer",
    displayName,
    status: "open",
    version: 1,
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-08-10T10:00:00.000Z",
    ...overrides
  };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("OfferCase persistence", () => {
  it("survives reload and isolates equal case ids between businesses", async () => {
    const rootDir = dataRoot();
    const first = new OfferStore({ rootDir });
    await expect(first.insertCase(alpha, offerCase("alpha", "CommCats - Empfang"))).resolves.toBe("created");
    await expect(first.insertCase(beta, offerCase("beta", "Andere Firma - Lunch"))).resolves.toBe("created");

    const restarted = new OfferStore({ rootDir });
    await expect(restarted.getCase(alpha, "offer-case-shared")).resolves.toMatchObject({
      businessId: "alpha",
      displayName: "CommCats - Empfang"
    });
    await expect(restarted.getCase(beta, "offer-case-shared")).resolves.toMatchObject({
      businessId: "beta",
      displayName: "Andere Firma - Lunch"
    });
    await expect(restarted.listEvents(alpha, "offer-case-shared")).resolves.toMatchObject([{
      sequence: 1,
      kind: "case_created",
      role: "system"
    }]);
  });

  it("persists a copied case with one case_copied event and no inherited result references", async () => {
    const store = new OfferStore({ rootDir: dataRoot() });
    const source = offerCase("alpha", "CommCats - Empfang", {
      status: "completed",
      version: 3,
      approvedOfferId: "approved-offer-1",
      productionHandoffId: "handoff-1"
    });
    const copy = copyCaseForNewEvent(source, {
      caseId: "offer-case-copy",
      now: "2026-08-11T09:00:00.000Z"
    });

    await expect(store.createCase(alpha, copy.case)).resolves.toBe("created");
    await expect(store.listEvents(alpha, copy.case.caseId)).resolves.toMatchObject([{
      sequence: 1,
      kind: "case_copied",
      artifactId: source.caseId
    }]);
    await expect(store.getCase(alpha, copy.case.caseId)).resolves.not.toHaveProperty("approvedOfferId");
  });

  it("treats an identical case idempotently and rejects a differing same-id payload as 409", async () => {
    const store = new OfferStore({ rootDir: dataRoot() });
    const original = offerCase("alpha", "CommCats - Empfang");

    await expect(store.createCase(alpha, original)).resolves.toBe("created");
    await expect(store.createCase(alpha, structuredClone(original))).resolves.toBe("exists");
    await expect(store.createCase(alpha, {
      ...original,
      displayName: "Anderer Auftrag"
    })).rejects.toMatchObject({
      code: "CASE_STORE_CONFLICT",
      statusCode: 409
    });
    await expect(store.listEvents(alpha, original.caseId)).resolves.toHaveLength(1);
  });

  it("orders by the latest real activity instant, including appended events", async () => {
    const store = new OfferStore({ rootDir: dataRoot() });
    const older = offerCase("alpha", "Älterer Auftrag", {
      caseId: "offer-case-older",
      createdAt: "2026-08-10T10:00:00.000Z",
      updatedAt: "2026-08-10T10:30:00.000Z"
    });
    const newer = offerCase("alpha", "Neuerer Auftrag", {
      caseId: "offer-case-newer",
      createdAt: "2026-08-10T10:00:00.000Z",
      updatedAt: "2026-08-10T12:00:00+02:00"
    });
    await store.createCase(alpha, older);
    await store.createCase(alpha, newer);

    expect((await store.listCases(alpha)).map((item) => item.caseId)).toEqual([
      "offer-case-older",
      "offer-case-newer"
    ]);

    await store.appendEvent(alpha, newer.caseId, {
      at: "2026-08-10T11:00:00.000Z",
      role: "user",
      kind: "instruction",
      text: "Bitte Dessert ergänzen."
    });
    expect((await store.listCases(alpha)).map((item) => item.caseId)).toEqual([
      "offer-case-newer",
      "offer-case-older"
    ]);
  });

  it("rejects production revisions in offer history", async () => {
    const store = new OfferStore({ rootDir: dataRoot() });
    await store.createCase(alpha, offerCase("alpha", "CommCats - Empfang"));

    await expect(store.appendEvent(alpha, "offer-case-shared", {
      at: "2026-08-10T10:01:00.000Z",
      role: "assistant",
      kind: "revision_created",
      text: "Falscher Produkttyp.",
      revisionRef: {
        artifactType: "ProductionDraft",
        artifactId: "production-draft-1",
        revision: 1,
        createdAt: "2026-08-10T10:01:00.000Z"
      }
    })).rejects.toThrow(/OfferDraft|offer/i);
    await expect(store.listEvents(alpha, "offer-case-shared")).resolves.toHaveLength(1);
  });

  it("searches only business-owned display names and source filenames", async () => {
    const store = new OfferStore({ rootDir: dataRoot() });
    await store.insertCase(alpha, offerCase("alpha", "CommCats - Empfang - 45 Personen"));
    await store.insertCase(beta, offerCase("beta", "CommCats - Empfang - 45 Personen"));
    await store.appendEvent(alpha, "offer-case-shared", {
      at: "2026-08-10T10:01:00.000Z",
      role: "system",
      kind: "source_added",
      text: "Originalquelle gespeichert.",
      sourceRef: {
        sourceId: "source-alpha",
        documentId: "document-alpha",
        filename: "Angebot_Koepff.pdf",
        mimeType: "application/pdf",
        sha256: "a".repeat(64),
        dataClass: "personal_confidential",
        addedAt: "2026-08-10T10:01:00.000Z"
      }
    });

    await expect(store.searchCases(alpha, "empfang")).resolves.toHaveLength(1);
    await expect(store.searchCases(alpha, "koepff")).resolves.toHaveLength(1);
    await expect(store.searchCases(beta, "koepff")).resolves.toHaveLength(0);
  });

  it("rejects stale metadata updates and immutable identity changes", async () => {
    const store = new OfferStore({ rootDir: dataRoot() });
    const original = offerCase("alpha", "CommCats - Empfang");
    await store.insertCase(alpha, original);

    await expect(store.updateCase(alpha, original.caseId, 1, {
      ...original,
      displayName: "CommCats - Empfang - 45 Personen",
      version: 2,
      updatedAt: "2026-08-10T10:05:00.000Z"
    })).resolves.toBe("updated");
    await expect(store.updateCase(alpha, original.caseId, 1, {
      ...original,
      displayName: "Veraltete Änderung",
      version: 2,
      updatedAt: "2026-08-10T10:06:00.000Z"
    })).resolves.toBe("conflict");
    await expect(store.updateCase(alpha, original.caseId, 2, {
      ...original,
      caseId: "offer-case-other",
      version: 3,
      updatedAt: "2026-08-10T10:07:00.000Z"
    })).rejects.toThrow(/Identität|caseId/);
  });
});
