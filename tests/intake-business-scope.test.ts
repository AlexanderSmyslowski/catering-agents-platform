import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";
import { IntakeStore, type IntakeShadowRun } from "@catering/intake-service";
import {
  createEventRequestFromText,
  normalizeEventRequestToSpec,
  withBusinessTargetCriticalSection,
  type AcceptedEventSpec,
  type BusinessContext,
  type CollectionStorageOptions,
  type EventRequest,
  type Queryable
} from "@catering/shared-core";

const alpha: BusinessContext = { businessId: "alpha" };
const beta: BusinessContext = { businessId: "beta" };
const dataRoots: string[] = [];

afterEach(() => {
  for (const rootDir of dataRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

function requestFor(label: string): EventRequest {
  return createEventRequestFromText({
    requestId: "shared-request",
    channel: "text",
    rawText: `Konferenz am 2026-09-18 fuer ${label === "alpha" ? 45 : 90} Personen mit Buffet. ${label}`
  });
}

function specFor(request: EventRequest): AcceptedEventSpec {
  return {
    ...normalizeEventRequestToSpec(request, {
      sourceType: "manual_input",
      reference: request.requestId,
      commercialState: "manual"
    }),
    specId: "shared-spec"
  };
}

function summary(numericValue: number): IntakeShadowRun["baseline"]["summary"] {
  return {
    eventType: { present: true, valueHash: `event-${numericValue}` },
    serviceForm: { present: true, valueHash: `service-${numericValue}` },
    eventDate: { present: true, valueHash: `date-${numericValue}` },
    attendeeCount: { present: true, numericValue },
    menuItems: { present: true, valueHash: `menu-${numericValue}` }
  };
}

function shadowRunFor(label: string, numericValue: number): IntakeShadowRun {
  return {
    shadowRunId: "shared-shadow-run",
    createdAt: "2026-08-11T10:00:00.000Z",
    status: "pending_review",
    safetyMode: "synthetic_demo",
    source: {
      channel: "text",
      inputHash: `input-${label}`
    },
    baseline: {
      requestId: "shared-request",
      specId: "shared-spec",
      summary: summary(numericValue)
    },
    llm: {
      inputId: `input-${label}`,
      outputId: `output-${label}`,
      outputHash: `output-hash-${label}`,
      providerId: "fixture",
      providerRequestId: `provider-${label}`,
      adapterId: "fixture-adapter",
      adapterMode: "fixture",
      promptSchemaId: "intake-shadow-v1",
      summary: summary(numericValue)
    },
    differences: [
      {
        field: "attendeeCount",
        matches: true,
        baseline: { present: true, numericValue },
        llm: { present: true, numericValue }
      }
    ],
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawPayloadStored: false,
      dataMode: "synthetic_or_demo_only"
    }
  };
}

function createStorage(mode: "file" | "postgres"): {
  options: CollectionStorageOptions;
  close: () => Promise<void>;
} {
  if (mode === "postgres") {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool = new Pool();
    return {
      options: { pgPool: pool },
      close: () => pool.end()
    };
  }

  const rootDir = mkdtempSync(path.join(tmpdir(), "catering-intake-business-scope-"));
  dataRoots.push(rootDir);
  return {
    options: { rootDir },
    close: async () => undefined
  };
}

describe("IntakeStore business scope", () => {
  it.each(["file", "postgres"] as const)(
    "isolates requests, specs, shadow runs, and archives after a %s reload",
    async (mode) => {
      const storage = createStorage(mode);
      try {
        const alphaRequest = requestFor("alpha");
        const betaRequest = requestFor("beta");
        const store = new IntakeStore(storage.options);

        await store.saveRequest(alpha, alphaRequest);
        await store.saveRequest(beta, betaRequest);
        await store.saveSpec(alpha, specFor(alphaRequest));
        await store.saveSpec(beta, specFor(betaRequest));
        await store.saveShadowRun(alpha, shadowRunFor("alpha", 45));
        await store.saveShadowRun(beta, shadowRunFor("beta", 90));

        const reloaded = new IntakeStore(storage.options);
        expect((await reloaded.getRequest(alpha, "shared-request"))?.rawInputs[0]?.content).toContain("alpha");
        expect((await reloaded.getRequest(beta, "shared-request"))?.rawInputs[0]?.content).toContain("beta");
        expect((await reloaded.getSpec(alpha, "shared-spec"))?.attendees.expected).toBe(45);
        expect((await reloaded.getSpec(beta, "shared-spec"))?.attendees.expected).toBe(90);
        expect((await reloaded.listShadowRuns(alpha))[0]?.source.inputHash).toBe("input-alpha");
        expect((await reloaded.listShadowRuns(beta))[0]?.source.inputHash).toBe("input-beta");
        expect(await reloaded.listRequests(alpha)).toHaveLength(1);
        expect(await reloaded.listRequests(beta)).toHaveLength(1);
        expect(await reloaded.listSpecs(alpha)).toHaveLength(1);
        expect(await reloaded.listSpecs(beta)).toHaveLength(1);

        await reloaded.archiveRequestContext(alpha, {
          requestId: "shared-request",
          reasonCode: "wrong_upload",
          archivedAt: "2026-08-11T11:00:00.000Z",
          archivedBy: "alpha-operator"
        });

        const afterArchiveReload = new IntakeStore(storage.options);
        expect(await afterArchiveReload.listRequests(alpha)).toEqual([]);
        expect(await afterArchiveReload.listSpecs(alpha)).toEqual([]);
        expect(await afterArchiveReload.listRequests(beta)).toHaveLength(1);
        expect(await afterArchiveReload.listSpecs(beta)).toHaveLength(1);
        expect(
          (await afterArchiveReload.getRequest(alpha, "shared-request"))?.operationalArchive
        ).toMatchObject({ archivedBy: "alpha-operator" });
        expect(
          (await afterArchiveReload.getSpec(alpha, "shared-spec"))?.operationalArchive
        ).toMatchObject({ archivedBy: "alpha-operator" });
        expect(
          (await afterArchiveReload.getRequest(beta, "shared-request"))?.operationalArchive
        ).toBeUndefined();
        expect(
          (await afterArchiveReload.getSpec(beta, "shared-spec"))?.operationalArchive
        ).toBeUndefined();
      } finally {
        await storage.close();
      }
    }
  );

  it.each(["file", "postgres"] as const)(
    "rejects malformed shadow runs before writing to %s storage",
    async (mode) => {
      const storage = createStorage(mode);
      try {
        const store = new IntakeStore(storage.options);
        const invalid = structuredClone(shadowRunFor("invalid", 45)) as unknown as {
          guardrails: Record<string, unknown>;
        };
        invalid.guardrails.rawPayloadStored = true;

        await expect(
          store.saveShadowRun(alpha, invalid as unknown as IntakeShadowRun)
        ).rejects.toThrow(/shadow/i);
        await expect(store.listShadowRuns(alpha)).resolves.toEqual([]);
      } finally {
        await storage.close();
      }
    }
  );

  it.each(["file", "postgres"] as const)(
    "rejects forbidden or additional shadow payload fields in %s storage",
    async (mode) => {
      const storage = createStorage(mode);
      try {
        const store = new IntakeStore(storage.options);
        const withRawPayload = structuredClone(shadowRunFor("raw", 45)) as unknown as Record<string, unknown>;
        (withRawPayload.llm as Record<string, unknown>).providerResponse = {
          rawText: "vertrauliche Provider-Antwort"
        };
        const withUnknownField = structuredClone(shadowRunFor("extra", 45)) as unknown as Record<string, unknown>;
        (withUnknownField.source as Record<string, unknown>).customerName = "Nicht erlaubt";

        await expect(
          store.saveShadowRun(alpha, withRawPayload as unknown as IntakeShadowRun)
        ).rejects.toThrow(/providerResponse|rawText/i);
        await expect(
          store.saveShadowRun(alpha, withUnknownField as unknown as IntakeShadowRun)
        ).rejects.toThrow(/customerName|additional/i);
        await expect(store.listShadowRuns(alpha)).resolves.toEqual([]);
      } finally {
        await storage.close();
      }
    }
  );

  it.each(["file", "postgres"] as const)(
    "keeps an archive monotonic when a stale save arrives in %s storage",
    async (mode) => {
      const storage = createStorage(mode);
      try {
        const store = new IntakeStore(storage.options);
        const original = requestFor("alpha");
        const originalSpec = specFor(original);
        await store.saveRequest(alpha, original);
        await store.saveSpec(alpha, originalSpec);
        await store.archiveRequestContext(alpha, {
          requestId: original.requestId,
          reasonCode: "wrong_upload",
          archivedAt: "2026-08-11T11:00:00.000Z",
          archivedBy: "alpha-operator"
        });

        await expect(store.saveRequest(alpha, {
          ...original,
          constraints: ["veraltete Änderung"]
        })).rejects.toThrow(/Konflikt|archiv/i);
        await expect(store.saveSpec(alpha, {
          ...originalSpec,
          attendees: {
            ...originalSpec.attendees,
            expected: 99
          }
        })).rejects.toThrow(/Konflikt|archiv/i);

        expect((await store.getRequest(alpha, original.requestId))?.operationalArchive).toBeDefined();
        expect((await store.getSpec(alpha, originalSpec.specId))?.operationalArchive).toBeDefined();
      } finally {
        await storage.close();
      }
    }
  );

  it("rolls back file archive writes when a later related record cannot be replaced", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-intake-archive-rollback-"));
    dataRoots.push(rootDir);
    let archiveReplaceCount = 0;
    let failArchive = false;
    const store = new IntakeStore({
      rootDir,
      fileFaultInjector(phase) {
        if (!failArchive || phase !== "before_record_replace") return;
        archiveReplaceCount += 1;
        if (archiveReplaceCount === 2) throw new Error("simulierter Spec-Schreibfehler");
      }
    });
    const original = requestFor("alpha");
    const originalSpec = specFor(original);
    await store.saveRequest(alpha, original);
    await store.saveSpec(alpha, originalSpec);
    failArchive = true;

    await expect(store.archiveRequestContext(alpha, {
      requestId: original.requestId,
      reasonCode: "wrong_upload",
      archivedAt: "2026-08-11T11:00:00.000Z",
      archivedBy: "alpha-operator"
    })).rejects.toThrow(/simulierter Spec-Schreibfehler/);

    expect((await store.getRequest(alpha, original.requestId))?.operationalArchive).toBeUndefined();
    expect((await store.getSpec(alpha, originalSpec.specId))?.operationalArchive).toBeUndefined();
  });

  it("rejects an archive when a concurrent request update wins the exact compare-and-set", async () => {
    const { Pool } = newDb({ noAstCoverageCheck: true }).adapters.createPg();
    const pool = new Pool();
    const rawPool = pool as unknown as Queryable;
    let pauseNextRequestArchive = false;
    let signalEntered!: () => void;
    let releaseUpdate!: () => void;
    const entered = new Promise<void>((resolve) => { signalEntered = resolve; });
    const released = new Promise<void>((resolve) => { releaseUpdate = resolve; });
    const interceptQuery = async (queryable: Queryable, sql: string, params?: unknown[]) => {
        if (
          pauseNextRequestArchive &&
          sql.startsWith("UPDATE catering_business_records SET payload") &&
          params?.[1] === "intake/requests"
        ) {
          pauseNextRequestArchive = false;
          signalEntered();
          await released;
        }
        return queryable.query(sql, params);
    };
    const pausedPool = {
      query(sql: string, params?: unknown[]) {
        return interceptQuery(rawPool, sql, params);
      },
      async connect() {
        const client = await pool.connect();
        return {
          query(sql: string, params?: unknown[]) {
            return interceptQuery(client as unknown as Queryable, sql, params);
          },
          release() {
            client.release();
          }
        };
      }
    };

    try {
      const archivingStore = new IntakeStore({ pgPool: pausedPool as unknown as Queryable });
      const concurrentStore = new IntakeStore({ pgPool: rawPool });
      const original = requestFor("alpha");
      await archivingStore.saveRequest(alpha, original);
      await archivingStore.saveSpec(alpha, specFor(original));
      pauseNextRequestArchive = true;

      const archivePromise = archivingStore.archiveRequestContext(alpha, {
        requestId: original.requestId,
        reasonCode: "wrong_upload",
        archivedAt: "2026-08-11T11:00:00.000Z",
        archivedBy: "alpha-operator"
      });
      const archiveStage = Promise.race([
        entered.then(() => "entered" as const),
        archivePromise.then(() => "completed" as const)
      ]);
      await expect(archiveStage).resolves.toBe("entered");

      const concurrentUpdate: EventRequest = {
        ...original,
        constraints: [...(original.constraints ?? []), "concurrent update"]
      };
      await concurrentStore.saveRequest(alpha, concurrentUpdate);
      releaseUpdate();

      await expect(archivePromise).rejects.toThrow(/Konflikt/i);
      await expect(concurrentStore.getRequest(alpha, original.requestId)).resolves.toEqual(concurrentUpdate);
      expect((await concurrentStore.getSpec(alpha, "shared-spec"))?.operationalArchive).toBeUndefined();
    } finally {
      releaseUpdate();
      await pool.end();
    }
  });

  it("serializes save, replace, and archive through the shared AcceptedEventSpec fence", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "catering-intake-spec-fence-writers-"));
    dataRoots.push(rootDir);
    const storage = { rootDir };
    const store = new IntakeStore(storage);
    const request = requestFor("alpha");
    const primarySpec = { ...specFor(request), specId: "fenced-spec-primary" };
    const secondarySpec = {
      ...specFor(request),
      specId: "fenced-spec-secondary",
      sourceLineage: specFor(request).sourceLineage.map((source) => ({ ...source }))
    };
    await store.saveRequest(alpha, request);
    await store.saveSpec(alpha, primarySpec);
    await store.saveSpec(alpha, secondarySpec);

    const holdFence = async (specId: string) => {
      let release!: () => void;
      const released = new Promise<void>((resolve) => { release = resolve; });
      let entered!: () => void;
      const fenceEntered = new Promise<void>((resolve) => { entered = resolve; });
      const holder = withBusinessTargetCriticalSection({
        storage,
        context: alpha,
        target: { kind: "accepted_event_spec", artifactId: specId, revision: 0 },
        collectionNamespace: "intake/specs",
        queueFullMessage: "queue full",
        timeoutMessage: "timeout",
        legacyTimeoutMessage: "legacy timeout",
        postgresPoolMessage: "pool required",
        operation: async () => {
          entered();
          await released;
        }
      });
      await fenceEntered;
      return { holder, release };
    };

    const saveReplacement = {
      ...primarySpec,
      event: { ...primarySpec.event, title: "Gefenceter Ersatz" }
    };
    const saveFence = await holdFence(primarySpec.specId);
    let saveSettled = false;
    const savePromise = store.saveSpec(alpha, saveReplacement).then(() => {
      saveSettled = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(saveSettled).toBe(false);
    saveFence.release();
    await Promise.all([savePromise, saveFence.holder]);

    const replaceTarget = {
      ...saveReplacement,
      event: { ...saveReplacement.event, title: "Gefencete Aktualisierung" }
    };
    const replaceFence = await holdFence(primarySpec.specId);
    let replaceSettled = false;
    const replacePromise = store.replaceSpec(alpha, saveReplacement, replaceTarget).then((result) => {
      replaceSettled = true;
      return result;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(replaceSettled).toBe(false);
    replaceFence.release();
    await Promise.all([replacePromise, replaceFence.holder]);
    await expect(replacePromise).resolves.toBe("updated");

    const archiveFences = await Promise.all([
      holdFence(primarySpec.specId),
      holdFence(secondarySpec.specId)
    ]);
    let archiveSettled = false;
    const archivePromise = store.archiveRequestContext(alpha, {
      requestId: request.requestId,
      reasonCode: "wrong_upload",
      archivedAt: "2026-08-11T11:00:00.000Z",
      archivedBy: "alpha-operator"
    }).then((result) => {
      archiveSettled = true;
      return result;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(archiveSettled).toBe(false);
    for (const fence of archiveFences) fence.release();
    await Promise.all([
      archivePromise,
      ...archiveFences.map((fence) => fence.holder)
    ]);
    expect((await store.getSpec(alpha, primarySpec.specId))?.operationalArchive?.status).toBe("archived");
    expect((await store.getSpec(alpha, secondarySpec.specId))?.operationalArchive?.status).toBe("archived");
  });
});
