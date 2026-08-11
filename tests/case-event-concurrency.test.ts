import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import { OfferStore } from "../offer-service/src/store.js";
import type { CollectionStorageOptions, OfferCase } from "@catering/shared-core";

const roots: string[] = [];
const context = { businessId: "alpha" };

function storage(mode: "file" | "postgres"): CollectionStorageOptions {
  if (mode === "postgres") {
    const { Pool } = newDb().adapters.createPg();
    return { pgPool: new Pool() };
  }
  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-case-events-"));
  roots.push(rootDir);
  return { rootDir };
}

function initialCase(): OfferCase {
  return {
    schemaVersion: "1.0",
    businessId: "alpha",
    caseId: "offer-case-concurrent",
    product: "offer",
    displayName: "Paralleltest",
    status: "open",
    version: 1,
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-08-10T10:00:00.000Z"
  };
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("append-only CaseEvent chronology", () => {
  it.each(["file", "postgres"] as const)(
    "creates one initial event under concurrent %s creation",
    async (mode) => {
      const options = storage(mode);
      const first = new OfferStore(options);
      const second = new OfferStore(options);

      const outcomes = await Promise.all([
        first.createCase(context, initialCase()),
        second.createCase(context, structuredClone(initialCase()))
      ]);

      expect(outcomes.sort()).toEqual(["created", "exists"]);
      await expect(first.listEvents(context, initialCase().caseId)).resolves.toMatchObject([{
        sequence: 1,
        kind: "case_created"
      }]);
    }
  );

  it.each(["file", "postgres"] as const)("assigns unique gap-free sequences in %s mode", async (mode) => {
    const store = new OfferStore(storage(mode));
    await store.insertCase(context, initialCase());

    await Promise.all([
      store.appendEvent(context, initialCase().caseId, {
        at: "2026-08-10T10:01:00.000Z",
        role: "user",
        kind: "instruction",
        text: "Bitte Dessert entfernen."
      }),
      store.appendEvent(context, initialCase().caseId, {
        at: "2026-08-10T10:01:00.000Z",
        role: "assistant",
        kind: "revision_created",
        text: "Revision 2 erstellt.",
        artifactId: "offer-draft-2",
        revisionRef: {
          artifactType: "OfferDraft",
          artifactId: "offer-draft-2",
          revision: 2,
          createdAt: "2026-08-10T10:01:00.000Z"
        }
      })
    ]);

    const events = await store.listEvents(context, initialCase().caseId);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(events.map((event) => event.kind).sort()).toEqual([
      "case_created",
      "instruction",
      "revision_created"
    ]);
    expect(new Set(events.map((event) => event.eventId)).size).toBe(3);
  });

  it("rejects events for a case owned by another business", async () => {
    const store = new OfferStore(storage("file"));
    await store.insertCase(context, initialCase());

    await expect(store.appendEvent({ businessId: "beta" }, initialCase().caseId, {
      at: "2026-08-10T10:01:00.000Z",
      role: "user",
      kind: "instruction",
      text: "Fremder Zugriff"
    })).rejects.toThrow(/nicht gefunden/i);
  });
});
