import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import type { OutgoingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIntakeApp } from "../intake-service/src/index.js";
import { buildProductionApp } from "../production-service/src/app.js";
import {
  ProductionStore,
  type ProductionFeedbackDraft
} from "../production-service/src/repositories/production-store.js";
import {
  CateringUserStore,
  createCateringUserRecord,
  hashCateringPin,
  type MinimalMvpRole
} from "../shared-core/src/index.js";

const TRUSTED_SECRET = "production-feedback-confidentiality-secret";
const localBusiness = { businessId: "local" } as const;
const commercialSentinel = "production-feedback-commercial-sentinel-964874f0";
const sessionEnv = {
  CATERING_DEFAULT_BUSINESS_ID: localBusiness.businessId,
  CATERING_TRUSTED_ACTOR_SECRET: TRUSTED_SECRET,
  CATERING_DEV_AUTH: "0"
};

interface SessionUserFixture {
  userId: string;
  loginCode: string;
  pin: string;
  role: MinimalMvpRole;
}

const productionCreator: SessionUserFixture = {
  userId: "feedback-production-creator",
  loginCode: "feedback-production-creator",
  pin: "592731",
  role: "production_operator"
};
const productionReader: SessionUserFixture = {
  userId: "feedback-production-reader",
  loginCode: "feedback-production-reader",
  pin: "692731",
  role: "production_operator"
};
const administrator: SessionUserFixture = {
  userId: "feedback-administrator",
  loginCode: "feedback-administrator",
  pin: "482731",
  role: "admin"
};

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-production-feedback-confidentiality-"));
}

function cookieFrom(headers: OutgoingHttpHeaders): string {
  const setCookie = headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof raw !== "string") throw new Error("Login hat kein Sitzungscookie geliefert.");
  return raw.split(";", 1)[0] ?? "";
}

function sessionHeaders(cookie: string): Record<string, string> {
  return {
    cookie,
    host: "catering.test",
    origin: "https://catering.test"
  };
}

async function createSessionUser(
  userStore: CateringUserStore,
  fixture: SessionUserFixture
): Promise<void> {
  const user = createCateringUserRecord({
    businessId: localBusiness.businessId,
    userId: fixture.userId,
    loginCode: fixture.loginCode,
    displayName: fixture.userId,
    pinHash: await hashCateringPin(fixture.pin),
    role: fixture.role,
    active: true,
    now: new Date("2026-08-28T10:00:00.000Z")
  });
  expect(await userStore.create(localBusiness, user)).toBe("created");
}

async function loginCookie(
  intakeApp: ReturnType<typeof buildIntakeApp>,
  fixture: SessionUserFixture
): Promise<string> {
  const response = await intakeApp.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: { host: "catering.test", origin: "https://catering.test" },
    payload: { loginCode: fixture.loginCode, pin: fixture.pin }
  });
  expect(response.statusCode, response.body).toBe(200);
  return cookieFrom(response.headers);
}

async function updateSessionRole(
  userStore: CateringUserStore,
  fixture: SessionUserFixture,
  role: MinimalMvpRole
): Promise<void> {
  const current = await userStore.getById(localBusiness, fixture.userId);
  if (!current) throw new Error("Session-Benutzer wurde nicht gefunden.");
  const result = await userStore.updateSecurity(
    localBusiness,
    current,
    { role },
    new Date("2026-08-28T11:00:00.000Z")
  );
  expect(result.kind).toBe("updated");
}

async function createSessionHarness(
  dataRoot: string,
  fixtures: SessionUserFixture[]
) {
  const userStore = new CateringUserStore({ rootDir: dataRoot });
  for (const fixture of fixtures) {
    await createSessionUser(userStore, fixture);
  }
  const intakeApp = buildIntakeApp({ rootDir: dataRoot, userStore, env: sessionEnv });
  const store = new ProductionStore({ rootDir: dataRoot });
  const productionApp = buildProductionApp({ dataRoot, store, userStore, env: sessionEnv });
  return { intakeApp, productionApp, store, userStore };
}

function commercialFeedbackPayload() {
  return {
    target: { specId: "spec-feedback-commercial-boundary" },
    feedback: {
      summary: `Kommerzielle Rückmeldung ${commercialSentinel}`,
      observations: [`Beobachtung ${commercialSentinel}`],
      changeRequests: [`Änderungswunsch ${commercialSentinel}`]
    }
  };
}

function operationalFeedbackPayload() {
  return {
    target: { specId: "spec-feedback-operational-boundary" },
    feedback: {
      summary: "Produktionsablauf für das Mittagsbuffet war stabil.",
      observations: ["Die Ausgabe startete pünktlich."],
      changeRequests: ["Für die nächste Ausgabe mehr Warmhaltebehälter bereitlegen."]
    }
  };
}

function unknownApprovedFeedbackDraft(): ProductionFeedbackDraft {
  return {
    feedbackId: "production-feedback-unknown-creator-boundary",
    status: "approved",
    createdAt: "2026-08-27T10:00:00.000Z",
    updatedAt: "2026-08-27T10:01:00.000Z",
    createdBy: {
      name: "Unbekannter Produktionskontakt",
      source: "trusted-proxy:x-catering-actor-name"
    },
    target: { specId: "spec-feedback-unknown-creator" },
    feedback: commercialFeedbackPayload().feedback,
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    approvedBy: {
      name: "Administrator",
      source: "trusted-proxy:x-catering-actor-name"
    },
    approvedAt: "2026-08-27T10:01:00.000Z"
  };
}

function compatibleLegacyOperationalDraft(): ProductionFeedbackDraft {
  return {
    feedbackId: "production-feedback-compatible-proxy-legacy",
    status: "approved",
    createdAt: "2026-08-27T09:00:00.000Z",
    updatedAt: "2026-08-27T09:01:00.000Z",
    createdBy: {
      name: "Produktions-Mitarbeiter",
      source: "trusted-proxy:x-catering-actor-name"
    },
    target: { specId: "spec-feedback-compatible-proxy-legacy" },
    feedback: operationalFeedbackPayload().feedback,
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    approvedBy: {
      name: "Administrator",
      source: "trusted-proxy:x-catering-actor-name"
    },
    approvedAt: "2026-08-27T09:01:00.000Z"
  };
}

async function createFeedbackDraft(
  app: ReturnType<typeof buildProductionApp>,
  headers: Record<string, string>,
  payload: ReturnType<typeof commercialFeedbackPayload> | ReturnType<typeof operationalFeedbackPayload>
): Promise<{ response: Awaited<ReturnType<typeof app.inject>>; draft: ProductionFeedbackDraft }> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/production/feedback-drafts",
    headers,
    payload
  });

  expect(response.statusCode, response.body).toBe(201);
  return {
    response,
    draft: response.json<{ draft: ProductionFeedbackDraft }>().draft
  };
}

describe("ProductionFeedback-Vertraulichkeit", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [dataRoot], { stdio: "ignore" });
      } catch {
        // Ein fehlender Löschzugriff darf weder den Testfehler verbergen noch einen Repo-Pfad betreffen.
      }
    }
  });

  it("hält session-origin Betriebsfeedback nach einem Rollenwechsel des Erstellers für Produktion sichtbar", async () => {
    // Dieser Test schlägt fehl, wenn die Leseklasse aus der aktuellen Erstellerrolle statt aus der gespeicherten Provenienz folgt.
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const { intakeApp, productionApp, store, userStore } = await createSessionHarness(
      dataRoot,
      [productionCreator, productionReader]
    );

    try {
      const creatorCookie = await loginCookie(intakeApp, productionCreator);
      const readerCookie = await loginCookie(intakeApp, productionReader);
      const operationalPayload = operationalFeedbackPayload();
      const created = await createFeedbackDraft(
        productionApp,
        sessionHeaders(creatorCookie),
        operationalPayload
      );
      const approvedAt = "2026-08-28T10:30:00.000Z";
      await store.saveProductionFeedbackDraft(localBusiness, {
        ...created.draft,
        status: "approved",
        updatedAt: approvedAt,
        approvedBy: {
          name: productionCreator.userId,
          source: "authenticated-session"
        },
        approvedAt
      }, created.draft);

      await updateSessionRole(userStore, productionCreator, "admin");

      const productionKnowledge = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(readerCookie)
      });
      expect(productionKnowledge.statusCode, productionKnowledge.body).toBe(200);
      expect(productionKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual([
        expect.objectContaining({
          feedbackId: created.draft.feedbackId,
          visibility: "operational",
          feedback: operationalPayload.feedback
        })
      ]);
    } finally {
      await Promise.all([productionApp.close(), intakeApp.close()]);
    }
  });

  it("hält session-origin kommerzielles Feedback nach einer Administrator-Abstufung verborgen", async () => {
    // Dieser Test schlägt fehl, wenn eine Abstufung die bei Erstellung festgelegte kommerzielle Klasse verliert.
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const { intakeApp, productionApp, store, userStore } = await createSessionHarness(
      dataRoot,
      [administrator]
    );

    try {
      const adminCookie = await loginCookie(intakeApp, administrator);
      const commercialPayload = commercialFeedbackPayload();
      const created = await createFeedbackDraft(
        productionApp,
        sessionHeaders(adminCookie),
        commercialPayload
      );
      const approved = await productionApp.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${created.draft.feedbackId}/decision`,
        headers: sessionHeaders(adminCookie),
        payload: { approve: true }
      });
      expect(approved.statusCode, approved.body).toBe(200);

      await updateSessionRole(userStore, administrator, "production_operator");
      const downgradedCookie = await loginCookie(intakeApp, administrator);
      const productionKnowledge = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(downgradedCookie)
      });
      expect(productionKnowledge.statusCode, productionKnowledge.body).toBe(200);
      expect(productionKnowledge.body).not.toContain(commercialSentinel);
      expect(productionKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual([]);

      const persisted = await store.getProductionFeedbackDraft(localBusiness, created.draft.feedbackId);
      expect(persisted).toMatchObject({
        status: "approved",
        visibility: "commercial",
        feedback: commercialPayload.feedback
      });
    } finally {
      await Promise.all([productionApp.close(), intakeApp.close()]);
    }
  });

  it("bewahrt die ursprüngliche Sichtbarkeit bei einer reinen Feedback-Entscheidung exakt", async () => {
    // Dieser Test schlägt fehl, wenn die Entscheidungsprojektion Provenienz entfernt oder neu klassifiziert.
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const { intakeApp, productionApp, store } = await createSessionHarness(dataRoot, [administrator]);

    try {
      const adminCookie = await loginCookie(intakeApp, administrator);
      const created = await createFeedbackDraft(
        productionApp,
        sessionHeaders(adminCookie),
        commercialFeedbackPayload()
      );
      const decidedResponse = await productionApp.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${created.draft.feedbackId}/decision`,
        headers: sessionHeaders(adminCookie),
        payload: { approve: false }
      });
      expect(decidedResponse.statusCode, decidedResponse.body).toBe(200);

      const createdVisibility = (created.draft as ProductionFeedbackDraft & { visibility?: string }).visibility;
      const decided = decidedResponse.json<{ draft: ProductionFeedbackDraft & { visibility?: string } }>().draft;
      const persisted = await store.getProductionFeedbackDraft(localBusiness, created.draft.feedbackId) as
        | (ProductionFeedbackDraft & { visibility?: string })
        | undefined;
      expect(decided.visibility).toBe(createdVisibility);
      expect(persisted?.visibility).toBe(createdVisibility);
      expect(createdVisibility).toBe("commercial");
    } finally {
      await Promise.all([productionApp.close(), intakeApp.close()]);
    }
  });

  it("weist einen session-origin Datensatz ohne gültige Sichtbarkeit an der Schreibgrenze ab", async () => {
    // Dieser Test schlägt fehl, wenn ein neuer Session-Datensatz unklassifiziert persistiert werden kann.
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });
    const missingVisibilityDraft = {
      feedbackId: "production-feedback-session-missing-visibility",
      status: "pending_review",
      createdAt: "2026-08-28T10:00:00.000Z",
      updatedAt: "2026-08-28T10:00:00.000Z",
      createdBy: {
        name: productionCreator.userId,
        source: "authenticated-session"
      },
      target: { specId: "spec-session-missing-visibility" },
      feedback: operationalFeedbackPayload().feedback,
      guardrails: {
        draftOnly: true,
        humanApprovalRequired: true,
        rawProviderPayloadStored: false,
        knowledgeWritePolicy: "reviewed_only"
      }
    } as unknown as ProductionFeedbackDraft;

    await expect(
      store.saveProductionFeedbackDraft(localBusiness, missingVisibilityDraft)
    ).rejects.toThrow("visibility");
    expect(
      await store.getProductionFeedbackDraft(localBusiness, missingVisibilityDraft.feedbackId)
    ).toBeUndefined();
  });

  it("weist jede nachträgliche Umklassifizierung an der Speichergrenze in beide Richtungen ab", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const store = new ProductionStore({ rootDir: dataRoot });

    for (const [initialVisibility, replacementVisibility] of [
      ["operational", "commercial"],
      ["commercial", "operational"]
    ] as const) {
      const feedbackId = `production-feedback-immutable-${initialVisibility}`;
      const original: ProductionFeedbackDraft = {
        feedbackId,
        status: "pending_review",
        visibility: initialVisibility,
        createdAt: "2026-08-28T10:00:00.000Z",
        updatedAt: "2026-08-28T10:00:00.000Z",
        createdBy: {
          name: initialVisibility === "commercial" ? administrator.userId : productionCreator.userId,
          source: "authenticated-session"
        },
        target: { specId: `spec-immutable-${initialVisibility}` },
        feedback: operationalFeedbackPayload().feedback,
        guardrails: {
          draftOnly: true,
          humanApprovalRequired: true,
          rawProviderPayloadStored: false,
          knowledgeWritePolicy: "reviewed_only"
        }
      };
      await store.saveProductionFeedbackDraft(localBusiness, original);

      await expect(store.saveProductionFeedbackDraft(localBusiness, {
        ...original,
        visibility: replacementVisibility,
        updatedAt: "2026-08-28T10:01:00.000Z"
      })).rejects.toThrow("Sichtbarkeit");
      await expect(store.getProductionFeedbackDraft(localBusiness, feedbackId)).resolves.toEqual(original);
    }
  });

  it("lässt bei zwei konkurrierenden Entscheidungen nur den ersten terminalen Zustand bestehen", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const { intakeApp, productionApp, store } = await createSessionHarness(
      dataRoot,
      [administrator]
    );
    const adminCookie = await loginCookie(intakeApp, administrator);
    const created = await createFeedbackDraft(
      productionApp,
      sessionHeaders(adminCookie),
      operationalFeedbackPayload()
    );
    const originalGet = store.getProductionFeedbackDraft.bind(store);
    const originalSave = store.saveProductionFeedbackDraft.bind(store);
    let initialDecisionReads = 0;
    let releaseInitialReads!: () => void;
    const bothInitialReadsCompleted = new Promise<void>((resolve) => {
      releaseInitialReads = resolve;
    });
    let releaseApprovedWrite!: () => void;
    const approvedWriteCompleted = new Promise<void>((resolve) => {
      releaseApprovedWrite = resolve;
    });
    const getSpy = vi.spyOn(store, "getProductionFeedbackDraft").mockImplementation(async (context, feedbackId) => {
      const current = await originalGet(context, feedbackId);
      if (
        feedbackId === created.draft.feedbackId
        && current?.status === "pending_review"
        && initialDecisionReads < 2
      ) {
        initialDecisionReads += 1;
        if (initialDecisionReads === 2) releaseInitialReads();
        await bothInitialReadsCompleted;
      }
      return current;
    });
    const saveSpy = vi.spyOn(store, "saveProductionFeedbackDraft").mockImplementation(async (context, draft, expectedDraft) => {
      if (draft.feedbackId === created.draft.feedbackId && draft.status === "rejected") {
        await approvedWriteCompleted;
      }
      const result = await originalSave(context, draft, expectedDraft);
      if (draft.feedbackId === created.draft.feedbackId && draft.status === "approved") {
        releaseApprovedWrite();
      }
      return result;
    });

    try {
      const [approved, rejected] = await Promise.all([
        productionApp.inject({
          method: "POST",
          url: `/v1/production/feedback-drafts/${created.draft.feedbackId}/decision`,
          headers: sessionHeaders(adminCookie),
          payload: { approve: true }
        }),
        productionApp.inject({
          method: "POST",
          url: `/v1/production/feedback-drafts/${created.draft.feedbackId}/decision`,
          headers: sessionHeaders(adminCookie),
          payload: { approve: false }
        })
      ]);

      expect(approved.statusCode, approved.body).toBe(200);
      expect(rejected.statusCode, rejected.body).toBe(409);
      expect(await originalGet(localBusiness, created.draft.feedbackId)).toMatchObject({
        status: "approved",
        visibility: "commercial"
      });
    } finally {
      getSpy.mockRestore();
      saveSpy.mockRestore();
      await Promise.all([productionApp.close(), intakeApp.close()]);
    }
  });

  it("klassifiziert denselben Inhalt ausschließlich nach der kommerziellen Fähigkeit des Erstellers", async () => {
    // Dieser Test schlägt fehl, wenn Textmerkmale statt der Erstellerfähigkeit die gespeicherte Klasse bestimmen.
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const { intakeApp, productionApp, store } = await createSessionHarness(
      dataRoot,
      [productionCreator, administrator]
    );

    try {
      const productionCookie = await loginCookie(intakeApp, productionCreator);
      const adminCookie = await loginCookie(intakeApp, administrator);
      const identicalPayload = commercialFeedbackPayload();
      const operationalCreated = await createFeedbackDraft(
        productionApp,
        sessionHeaders(productionCookie),
        identicalPayload
      );
      const commercialCreated = await createFeedbackDraft(
        productionApp,
        sessionHeaders(adminCookie),
        identicalPayload
      );
      const approvedAt = "2026-08-28T10:45:00.000Z";
      await store.saveProductionFeedbackDraft(localBusiness, {
        ...operationalCreated.draft,
        status: "approved",
        updatedAt: approvedAt,
        approvedBy: {
          name: productionCreator.userId,
          source: "authenticated-session"
        },
        approvedAt
      }, operationalCreated.draft);
      await store.saveProductionFeedbackDraft(localBusiness, {
        ...commercialCreated.draft,
        status: "approved",
        updatedAt: approvedAt,
        approvedBy: {
          name: administrator.userId,
          source: "authenticated-session"
        },
        approvedAt
      }, commercialCreated.draft);

      const productionKnowledge = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(productionCookie)
      });
      expect(productionKnowledge.statusCode, productionKnowledge.body).toBe(200);
      expect(productionKnowledge.body).toContain(commercialSentinel);
      expect(productionKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual([
        expect.objectContaining({
          feedbackId: operationalCreated.draft.feedbackId,
          visibility: "operational",
          feedback: identicalPayload.feedback
        })
      ]);

      const adminKnowledge = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(adminCookie)
      });
      expect(adminKnowledge.statusCode, adminKnowledge.body).toBe(200);
      expect(adminKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            feedbackId: operationalCreated.draft.feedbackId,
            visibility: "operational"
          }),
          expect.objectContaining({
            feedbackId: commercialCreated.draft.feedbackId,
            visibility: "commercial"
          })
        ])
      );
    } finally {
      await Promise.all([productionApp.close(), intakeApp.close()]);
    }
  });

  it("blendet kommerzielles freigegebenes Feedback für nichtkommerzielle Produktionsrollen aus", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const { intakeApp, productionApp, store } = await createSessionHarness(
      dataRoot,
      [productionReader, administrator]
    );

    try {
      const productionCookie = await loginCookie(intakeApp, productionReader);
      const adminCookie = await loginCookie(intakeApp, administrator);
      const commercialPayload = commercialFeedbackPayload();
      const commercialCreated = await createFeedbackDraft(
        productionApp,
        sessionHeaders(adminCookie),
        commercialPayload
      );
      expect(commercialCreated.response.body).toContain(commercialSentinel);
      expect(commercialCreated.draft).toMatchObject({
        visibility: "commercial",
        createdBy: { name: administrator.userId, source: "authenticated-session" }
      });

      const commercialApproved = await productionApp.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${commercialCreated.draft.feedbackId}/decision`,
        headers: sessionHeaders(adminCookie),
        payload: { approve: true }
      });
      expect(commercialApproved.statusCode, commercialApproved.body).toBe(200);
      expect(commercialApproved.body).toContain(commercialSentinel);
      expect(await store.getProductionFeedbackDraft(localBusiness, commercialCreated.draft.feedbackId))
        .toMatchObject({
          status: "approved",
          visibility: "commercial",
          feedback: commercialPayload.feedback,
          approvedBy: { name: administrator.userId, source: "authenticated-session" }
        });

      const productionKnowledgeBeforeOwnFeedback = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(productionCookie)
      });
      expect(productionKnowledgeBeforeOwnFeedback.statusCode, productionKnowledgeBeforeOwnFeedback.body).toBe(200);
      expect(productionKnowledgeBeforeOwnFeedback.body).not.toContain(commercialSentinel);
      expect(productionKnowledgeBeforeOwnFeedback.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual([]);

      const adminKnowledge = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(adminCookie)
      });
      expect(adminKnowledge.statusCode, adminKnowledge.body).toBe(200);
      expect(adminKnowledge.body).toContain(commercialSentinel);
      expect(adminKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          feedbackId: commercialCreated.draft.feedbackId,
          visibility: "commercial",
          feedback: commercialPayload.feedback
        })
      ]));
    } finally {
      await Promise.all([productionApp.close(), intakeApp.close()]);
    }
  });

  it("verweigert Entscheidungen über kommerzielles Fremdfeedback und lässt eigenes Betriebsfeedback zu", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const { intakeApp, productionApp, store } = await createSessionHarness(
      dataRoot,
      [productionCreator, administrator]
    );

    try {
      const productionCookie = await loginCookie(intakeApp, productionCreator);
      const adminCookie = await loginCookie(intakeApp, administrator);
      const commercialPending = await createFeedbackDraft(
        productionApp,
        sessionHeaders(adminCookie),
        commercialFeedbackPayload()
      );
      const persistedPending = await store.getProductionFeedbackDraft(
        localBusiness,
        commercialPending.draft.feedbackId
      );
      const forbiddenDecision = await productionApp.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${commercialPending.draft.feedbackId}/decision`,
        headers: sessionHeaders(productionCookie),
        payload: { approve: false }
      });
      expect(forbiddenDecision.statusCode, forbiddenDecision.body).toBe(403);
      expect(forbiddenDecision.body).not.toContain(commercialSentinel);
      expect(await store.getProductionFeedbackDraft(localBusiness, commercialPending.draft.feedbackId))
        .toEqual(persistedPending);

      const operationalPayload = operationalFeedbackPayload();
      const operationalCreated = await createFeedbackDraft(
        productionApp,
        sessionHeaders(productionCookie),
        operationalPayload
      );
      expect(operationalCreated.draft).toMatchObject({
        visibility: "operational",
        feedback: operationalPayload.feedback
      });

      const operationalApproved = await productionApp.inject({
        method: "POST",
        url: `/v1/production/feedback-drafts/${operationalCreated.draft.feedbackId}/decision`,
        headers: sessionHeaders(productionCookie),
        payload: { approve: true }
      });
      expect(operationalApproved.statusCode, operationalApproved.body).toBe(200);
      expect(operationalApproved.json<{ draft: ProductionFeedbackDraft }>().draft).toMatchObject({
        status: "approved",
        visibility: "operational",
        feedback: operationalPayload.feedback,
        approvedBy: { name: productionCreator.userId, source: "authenticated-session" }
      });

      const productionKnowledge = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(productionCookie)
      });
      expect(productionKnowledge.statusCode, productionKnowledge.body).toBe(200);
      const productionItems = productionKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items;
      expect(productionItems).toHaveLength(1);
      expect(productionItems[0]).toMatchObject({
        feedbackId: operationalCreated.draft.feedbackId,
        visibility: "operational",
        feedback: operationalPayload.feedback
      });
      expect(productionKnowledge.body).not.toContain(commercialSentinel);
    } finally {
      await Promise.all([productionApp.close(), intakeApp.close()]);
    }
  });

  it("erhält nur die exakte trusted-proxy-Legacyregel und verbirgt andere unklassifizierte Datensätze", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);
    const { intakeApp, productionApp, store } = await createSessionHarness(
      dataRoot,
      [productionReader, administrator]
    );
    const unknownDraft = unknownApprovedFeedbackDraft();
    const compatibleDraft = compatibleLegacyOperationalDraft();
    await store.saveProductionFeedbackDraft(localBusiness, unknownDraft);
    await store.saveProductionFeedbackDraft(localBusiness, compatibleDraft);

    try {
      const productionCookie = await loginCookie(intakeApp, productionReader);
      const adminCookie = await loginCookie(intakeApp, administrator);
      const productionKnowledge = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(productionCookie)
      });
      expect(productionKnowledge.statusCode, productionKnowledge.body).toBe(200);
      expect(productionKnowledge.body).not.toContain(commercialSentinel);
      expect(productionKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toEqual([
        expect.objectContaining({
          feedbackId: compatibleDraft.feedbackId,
          feedback: compatibleDraft.feedback
        })
      ]);

      const adminKnowledge = await productionApp.inject({
        method: "GET",
        url: "/v1/production/knowledge/production-feedback",
        headers: sessionHeaders(adminCookie)
      });
      expect(adminKnowledge.statusCode, adminKnowledge.body).toBe(200);
      expect(adminKnowledge.body).toContain(commercialSentinel);
      expect(adminKnowledge.json<{ items: ProductionFeedbackDraft[] }>().items).toHaveLength(2);
      expect((await store.getProductionFeedbackDraft(localBusiness, compatibleDraft.feedbackId))?.visibility)
        .toBeUndefined();
    } finally {
      await Promise.all([productionApp.close(), intakeApp.close()]);
    }
  });
});
