import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";
import type { ProductionCase } from "@catering/shared-core";

const roots: string[] = [];
const alpha = { businessId: "alpha" };

function dataRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "catering-production-cases-"));
  roots.push(root);
  return root;
}

function productionCase(): ProductionCase {
  return {
    schemaVersion: "1.0",
    businessId: "alpha",
    caseId: "production-case-1",
    product: "production",
    displayName: "CommCats - Empfang - 14.06.2026 - 45 Personen",
    status: "open",
    version: 1,
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-08-10T10:00:00.000Z",
    productionHandoffId: "handoff-1"
  };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ProductionCase persistence", () => {
  it("persists production result references without mutable history arrays", async () => {
    const rootDir = dataRoot();
    const store = new ProductionStore({ rootDir });
    const initial = productionCase();
    await store.createCase(alpha, initial);
    await expect(store.updateCase(alpha, initial.caseId, 1, {
      ...initial,
      version: 2,
      updatedAt: "2026-08-10T10:05:00.000Z",
      currentPlanId: "plan-1",
      currentPurchaseListId: "purchase-1"
    })).resolves.toBe("updated");

    const restarted = new ProductionStore({ rootDir });
    await expect(restarted.getCase(alpha, initial.caseId)).resolves.toMatchObject({
      currentPlanId: "plan-1",
      currentPurchaseListId: "purchase-1",
      version: 2
    });
    expect(await restarted.getCase(alpha, initial.caseId)).not.toHaveProperty("events");
  });

  it("keeps source and revision history append-only across reload", async () => {
    const rootDir = dataRoot();
    const store = new ProductionStore({ rootDir });
    await store.createCase(alpha, productionCase());
    await store.appendEvent(alpha, "production-case-1", {
      at: "2026-08-10T10:01:00.000Z",
      role: "system",
      kind: "revision_created",
      text: "Produktionsentwurf Revision 2 erstellt.",
      artifactId: "production-draft-2",
      revisionRef: {
        artifactType: "ProductionDraft",
        artifactId: "production-draft-2",
        revision: 2,
        createdAt: "2026-08-10T10:01:00.000Z",
        supersedesArtifactId: "production-draft-1"
      }
    });

    const events = await new ProductionStore({ rootDir }).listEvents(alpha, "production-case-1");
    expect(events).toMatchObject([
      { sequence: 1, kind: "case_created" },
      {
        sequence: 2,
        kind: "revision_created",
        revisionRef: { revision: 2, artifactId: "production-draft-2" }
      }
    ]);
  });

  it("rejects offer revisions and semantically incompatible event roles in production history", async () => {
    const store = new ProductionStore({ rootDir: dataRoot() });
    await store.createCase(alpha, productionCase());

    await expect(store.appendEvent(alpha, "production-case-1", {
      at: "2026-08-10T10:01:00.000Z",
      role: "assistant",
      kind: "revision_created",
      text: "Falscher Produkttyp.",
      revisionRef: {
        artifactType: "OfferDraft",
        artifactId: "offer-draft-1",
        revision: 1,
        createdAt: "2026-08-10T10:01:00.000Z"
      }
    })).rejects.toThrow(/ProductionDraft|production/i);

    await expect(store.appendEvent(alpha, "production-case-1", {
      at: "2026-08-10T10:02:00.000Z",
      role: "assistant",
      kind: "instruction",
      text: "Als Nutzeranweisung getarnter Assistententext."
    })).rejects.toThrow(/role|Rolle|user/i);
    await expect(store.listEvents(alpha, "production-case-1")).resolves.toHaveLength(1);
  });
});
