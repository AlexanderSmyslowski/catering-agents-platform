import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildOfferApp } from "@catering/offer-service";
import { OfferStore } from "../offer-service/src/store.js";
import { buildProductionApp } from "@catering/production-service";
import { ProductionStore } from "../production-service/src/repositories/production-store.js";
import { buildIntakeApp, IntakeStore } from "@catering/intake-service";
import { buildPrintExportApp } from "@catering/print-export";
import { InMemoryIntakeRecordsPort } from "./support/in-memory-intake-records-port.js";
import {
  AuditLogStore,
  CateringUserStore,
  createCateringUserRecord,
  createEventRequestFromText,
  createOfferDraft,
  hostedMultiBusinessReady,
  hashCateringPin,
  internalRecipes,
  normalizeEventRequestToSpec,
  RecipeLibrary,
  SCHEMA_VERSION,
  type ProductionPlan,
  type PurchaseList,
  validateOfferDraft
} from "@catering/shared-core";

const secret = "stage-a-business-isolation-secret";
const roots: string[] = [];

function root(): string {
  const value = mkdtempSync(path.join(tmpdir(), "catering-stage-a-isolation-"));
  roots.push(value);
  return value;
}

function hostedEnv(businessId: string) {
  return {
    CATERING_DEPLOYMENT_PROFILE: "hosted",
    CATERING_TRUSTED_ACTOR_SECRET: secret,
    CATERING_DEFAULT_BUSINESS_ID: businessId
  };
}

async function businessSession(
  dataRoot: string,
  businessId: "alpha" | "beta",
  intakeStore?: IntakeStore
) {
  const userStore = new CateringUserStore({ rootDir: dataRoot });
  const loginCode = `${businessId}-admin`;
  const pin = businessId === "alpha" ? "482731" : "592731";
  expect(await userStore.create({ businessId }, createCateringUserRecord({
    businessId,
    userId: `user-${businessId}-admin`,
    loginCode,
    displayName: `${businessId} Admin`,
    pinHash: await hashCateringPin(pin),
    role: "admin",
    active: true,
    now: new Date("2026-08-28T10:00:00.000Z")
  }))).toBe("created");
  const intake = buildIntakeApp({
    rootDir: dataRoot,
    ...(intakeStore ? { store: intakeStore } : {}),
    userStore,
    env: hostedEnv(businessId)
  });
  const login = await intake.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: { host: "catering.test", origin: "https://catering.test" },
    payload: { loginCode, pin }
  });
  expect(login.statusCode, login.body).toBe(200);
  const setCookie = login.headers["set-cookie"];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof rawCookie !== "string") throw new Error("Login hat kein Cookie geliefert.");
  return {
    intake,
    userStore,
    headers: {
      cookie: rawCookie.split(";", 1)[0] ?? "",
      host: "catering.test",
      origin: "https://catering.test"
    }
  };
}

describe("Stage A profile-independent business isolation", () => {
  afterEach(() => {
    for (const dataRoot of roots.splice(0)) {
      try {
        execFileSync("/usr/bin/trash", [dataRoot], { stdio: "ignore" });
      } catch {
        // Testdaten bleiben außerhalb des Repositorys und werden niemals irreversibel gelöscht.
      }
    }
  });

  it("opens hosted mode only after the code-owned gate and never crosses identical case IDs", async () => {
    // The readiness flag is code-owned; this route-level proof keeps hosted startup
    // tied to the same trusted-business contract as the matrix below.
    expect(hostedMultiBusinessReady).toBe(true);
    const dataRoot = root();
    const alphaSession = await businessSession(dataRoot, "alpha");
    const betaSession = await businessSession(dataRoot, "beta");
    const offerStore = new OfferStore({ rootDir: dataRoot });
    const offerAlpha = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      userStore: alphaSession.userStore,
      env: hostedEnv("alpha")
    });
    const offerBeta = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      userStore: betaSession.userStore,
      env: hostedEnv("beta")
    });
    const productionStore = new ProductionStore({ rootDir: dataRoot });
    const productionAlpha = buildProductionApp({
      dataRoot,
      store: productionStore,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      userStore: alphaSession.userStore,
      env: hostedEnv("alpha")
    });
    const productionBeta = buildProductionApp({
      dataRoot,
      store: productionStore,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      userStore: betaSession.userStore,
      env: hostedEnv("beta")
    });

    try {
      const alphaCase = await offerAlpha.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: alphaSession.headers,
        payload: { customerName: "Alpha", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 10 }
      });
      const betaCase = await offerBeta.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: betaSession.headers,
        payload: { customerName: "Beta", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 10 }
      });
      expect(alphaCase.statusCode).toBe(201);
      expect(betaCase.statusCode).toBe(201);
      const alphaCaseId = alphaCase.json<{ case: { caseId: string } }>().case.caseId;
      const betaCaseId = betaCase.json<{ case: { caseId: string } }>().case.caseId;
      expect([403, 404]).toContain((await offerBeta.inject({ method: "GET", url: `/v1/offers/cases/${alphaCaseId}`, headers: betaSession.headers })).statusCode);
      expect([403, 404]).toContain((await offerAlpha.inject({ method: "GET", url: `/v1/offers/cases/${betaCaseId}`, headers: alphaSession.headers })).statusCode);

      const alphaProduction = await productionAlpha.inject({
        method: "POST",
        url: "/v1/production/cases",
        headers: alphaSession.headers,
        payload: { customerName: "Alpha", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 10 }
      });
      const betaProduction = await productionBeta.inject({
        method: "POST",
        url: "/v1/production/cases",
        headers: betaSession.headers,
        payload: { customerName: "Beta", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 10 }
      });
      expect(alphaProduction.statusCode).toBe(201);
      expect(betaProduction.statusCode).toBe(201);
      const alphaProductionCaseId = alphaProduction.json<{ case: { caseId: string } }>().case.caseId;
      expect([403, 404]).toContain((await productionBeta.inject({
        method: "GET",
        url: `/v1/production/cases/${alphaProductionCaseId}`,
        headers: betaSession.headers
      })).statusCode);
      expect((await productionAlpha.inject({
        method: "GET",
        url: "/v1/production/cases",
        headers: alphaSession.headers
      })).json().items).toHaveLength(1);
    } finally {
      await Promise.all([
        offerAlpha.close(), offerBeta.close(), productionAlpha.close(), productionBeta.close(),
        alphaSession.intake.close(), betaSession.intake.close()
      ]);
    }
  });

  it("keeps intake, artifacts, recipes, audits and every export bound to its trusted business", async () => {
    const dataRoot = root();
    const offerStore = new OfferStore({ rootDir: dataRoot });
    const productionStore = new ProductionStore({ rootDir: dataRoot });
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const alphaSession = await businessSession(dataRoot, "alpha", intakeStore);
    const betaSession = await businessSession(dataRoot, "beta", intakeStore);
    const offerAlpha = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      userStore: alphaSession.userStore,
      env: hostedEnv("alpha")
    });
    const offerBeta = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      userStore: betaSession.userStore,
      env: hostedEnv("beta")
    });
    const productionAlpha = buildProductionApp({
      dataRoot,
      store: productionStore,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      userStore: alphaSession.userStore,
      env: hostedEnv("alpha")
    });
    const productionBeta = buildProductionApp({
      dataRoot,
      store: productionStore,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      userStore: betaSession.userStore,
      env: hostedEnv("beta")
    });
    const intakeAlpha = alphaSession.intake;
    const intakeBeta = betaSession.intake;
    const exportsAlpha = buildPrintExportApp({
      rootDir: dataRoot,
      userStore: alphaSession.userStore,
      env: hostedEnv("alpha")
    });
    const exportsBeta = buildPrintExportApp({
      rootDir: dataRoot,
      userStore: betaSession.userStore,
      env: hostedEnv("beta")
    });
    const alphaContext = { businessId: "alpha" } as const;
    const betaContext = { businessId: "beta" } as const;
    const intakeHeaders = alphaSession.headers;
    const betaIntakeHeaders = betaSession.headers;
    const productionAlphaHeaders = alphaSession.headers;
    const productionBetaHeaders = betaSession.headers;

    try {
      const offerCases = await Promise.all([
        offerAlpha.inject({ method: "POST", url: "/v1/offers/cases", headers: alphaSession.headers, payload: { customerName: "Alpha", eventTypeLabel: "Matrix", eventDate: "2026-06-14", attendeeCount: 10 } }),
        offerBeta.inject({ method: "POST", url: "/v1/offers/cases", headers: betaSession.headers, payload: { customerName: "Beta", eventTypeLabel: "Matrix", eventDate: "2026-06-14", attendeeCount: 20 } })
      ]);
      const alphaOfferCaseId = offerCases[0]!.json<{ case: { caseId: string } }>().case.caseId;
      const betaOfferCaseId = offerCases[1]!.json<{ case: { caseId: string } }>().case.caseId;
      const alphaDraft = validateOfferDraft({
        ...createOfferDraft(createEventRequestFromText({
          requestId: "matrix-offer-request",
          channel: "text",
          rawText: "Alpha Buffet"
        })),
        businessId: "alpha",
        eventSummary: "ALPHA-EXPORT-MARKER",
        customerFacingText: "ALPHA-EXPORT-MARKER"
      });
      const betaDraft = validateOfferDraft({
        ...createOfferDraft(createEventRequestFromText({
          requestId: "matrix-offer-request",
          channel: "text",
          rawText: "Beta Buffet"
        })),
        businessId: "beta",
        eventSummary: "BETA-EXPORT-MARKER",
        customerFacingText: "BETA-EXPORT-MARKER"
      });
      await offerStore.saveDraftForCase(alphaContext, alphaOfferCaseId, alphaDraft);
      await offerStore.saveDraftForCase(betaContext, betaOfferCaseId, betaDraft);
      const alphaOfferDraftId = alphaDraft.draftId;
      const betaOfferDraftId = betaDraft.draftId;
      expect(alphaOfferDraftId).toBe(betaOfferDraftId);
      const alphaOfferExport = await exportsAlpha.inject({ method: "GET", url: `/v1/exports/offers/${alphaOfferDraftId}/html`, headers: alphaSession.headers });
      const betaOfferExport = await exportsBeta.inject({ method: "GET", url: `/v1/exports/offers/${alphaOfferDraftId}/html`, headers: betaSession.headers });
      expect(alphaOfferExport.statusCode).toBe(200);
      expect(betaOfferExport.statusCode).toBe(200);
      expect(alphaOfferExport.body).toContain("ALPHA-EXPORT-MARKER");
      expect(alphaOfferExport.body).not.toContain("BETA-EXPORT-MARKER");
      expect(betaOfferExport.body).toContain("BETA-EXPORT-MARKER");
      expect(betaOfferExport.body).not.toContain("ALPHA-EXPORT-MARKER");
      expect((await offerStore.getDraft(alphaContext, alphaOfferDraftId))?.businessId).toBe("alpha");
      expect((await offerStore.getDraft(betaContext, alphaOfferDraftId))?.businessId).toBe("beta");

      const alphaRequest = createEventRequestFromText({ requestId: "matrix-request", channel: "text", rawText: "Alpha intake am 2026-06-14 fuer 10 Personen" });
      const betaRequest = createEventRequestFromText({ requestId: "matrix-request", channel: "text", rawText: "Beta intake am 2026-06-14 fuer 20 Personen" });
      const alphaSpec = { ...normalizeEventRequestToSpec(alphaRequest, { sourceType: "manual_input", reference: alphaRequest.requestId, commercialState: "manual" }), specId: "matrix-spec" };
      const betaSpec = { ...normalizeEventRequestToSpec(betaRequest, { sourceType: "manual_input", reference: betaRequest.requestId, commercialState: "manual" }), specId: "matrix-spec" };
      await intakeStore.saveRequest(alphaContext, alphaRequest);
      await intakeStore.saveRequest(betaContext, betaRequest);
      await intakeStore.saveSpec(alphaContext, alphaSpec);
      await intakeStore.saveSpec(betaContext, betaSpec);
      expect((await intakeAlpha.inject({ method: "GET", url: "/v1/intake/requests", headers: intakeHeaders })).json<{ items: Array<{ rawInputs: Array<{ content: string }> }> }>().items[0]?.rawInputs[0]?.content).toContain("Alpha");
      expect((await intakeBeta.inject({ method: "GET", url: "/v1/intake/requests", headers: betaIntakeHeaders })).json<{ items: Array<{ rawInputs: Array<{ content: string }> }> }>().items[0]?.rawInputs[0]?.content).toContain("Beta");
      expect((await intakeBeta.inject({ method: "GET", url: "/v1/intake/specs/matrix-spec", headers: betaIntakeHeaders })).json().specId).toBe("matrix-spec");
      expect((await intakeAlpha.inject({ method: "GET", url: "/v1/intake/specs/matrix-spec", headers: intakeHeaders })).json().attendees).not.toEqual((await intakeBeta.inject({ method: "GET", url: "/v1/intake/specs/matrix-spec", headers: betaIntakeHeaders })).json().attendees);

      const plan = (businessId: string): ProductionPlan => ({
        schemaVersion: SCHEMA_VERSION,
        planId: "matrix-plan",
        eventSpecId: "matrix-spec",
        readiness: { status: "complete", reasons: [] },
        productionBatches: [],
        timeline: [],
        kitchenSheets: [],
        recipeSelections: [],
        unresolvedItems: [`${businessId.toUpperCase()}-PLAN-MARKER`],
        warnings: [businessId, `${businessId.toUpperCase()}-FOLDER-MARKER`]
      });
      const purchaseList = (businessId: string): PurchaseList => ({
        schemaVersion: SCHEMA_VERSION,
        purchaseListId: "matrix-purchase",
        eventSpecId: "matrix-spec",
        items: [{
          ingredientId: `${businessId}-ingredient`,
          displayName: `${businessId.toUpperCase()}-PURCHASE-MARKER`,
          normalizedQty: 1,
          normalizedUnit: "kg",
          purchaseQty: 1,
          purchaseUnit: "kg",
          group: "produce",
          sourceRecipes: [],
          mappingConfidence: 1
        }],
        groupingMode: "group",
        totals: { itemCount: 1, groups: ["produce"] }
      });
      await productionStore.savePlan(alphaContext, plan("alpha"));
      await productionStore.savePlan(betaContext, plan("beta"));
      await productionStore.savePurchaseList(alphaContext, purchaseList("alpha"));
      await productionStore.savePurchaseList(betaContext, purchaseList("beta"));
      expect((await productionAlpha.inject({ method: "GET", url: "/v1/production/plans", headers: productionAlphaHeaders })).json<{ items: ProductionPlan[] }>().items[0]?.warnings).toContain("alpha");
      expect((await productionBeta.inject({ method: "GET", url: "/v1/production/plans", headers: productionBetaHeaders })).json<{ items: ProductionPlan[] }>().items[0]?.warnings).toContain("beta");
      const alphaPlanExport = await exportsAlpha.inject({ method: "GET", url: "/v1/exports/production-plans/matrix-plan/html", headers: productionAlphaHeaders });
      const betaPlanExport = await exportsBeta.inject({ method: "GET", url: "/v1/exports/production-plans/matrix-plan/html", headers: productionBetaHeaders });
      expect(alphaPlanExport.statusCode).toBe(200);
      expect(betaPlanExport.statusCode).toBe(200);
      expect(alphaPlanExport.body).toContain("ALPHA-PLAN-MARKER");
      expect(alphaPlanExport.body).not.toContain("BETA-PLAN-MARKER");
      expect(betaPlanExport.body).toContain("BETA-PLAN-MARKER");
      expect(betaPlanExport.body).not.toContain("ALPHA-PLAN-MARKER");

      const alphaPurchaseExport = await exportsAlpha.inject({ method: "GET", url: "/v1/exports/purchase-lists/matrix-purchase/csv", headers: productionAlphaHeaders });
      const betaPurchaseExport = await exportsBeta.inject({ method: "GET", url: "/v1/exports/purchase-lists/matrix-purchase/csv", headers: productionBetaHeaders });
      expect(alphaPurchaseExport.statusCode).toBe(200);
      expect(betaPurchaseExport.statusCode).toBe(200);
      expect(alphaPurchaseExport.body).toContain("ALPHA-PURCHASE-MARKER");
      expect(alphaPurchaseExport.body).not.toContain("BETA-PURCHASE-MARKER");
      expect(betaPurchaseExport.body).toContain("BETA-PURCHASE-MARKER");
      expect(betaPurchaseExport.body).not.toContain("ALPHA-PURCHASE-MARKER");

      const alphaFolderExport = await exportsAlpha.inject({ method: "GET", url: "/v1/exports/production-folders/matrix-plan/html", headers: productionAlphaHeaders });
      const betaFolderExport = await exportsBeta.inject({ method: "GET", url: "/v1/exports/production-folders/matrix-plan/html", headers: productionBetaHeaders });
      expect(alphaFolderExport.statusCode).toBe(200);
      expect(betaFolderExport.statusCode).toBe(200);
      expect(alphaFolderExport.body).toContain("ALPHA-FOLDER-MARKER");
      expect(alphaFolderExport.body).not.toContain("BETA-FOLDER-MARKER");
      expect(alphaFolderExport.body).not.toContain("BETA-PURCHASE-MARKER");
      expect(betaFolderExport.body).toContain("BETA-FOLDER-MARKER");
      expect(betaFolderExport.body).not.toContain("ALPHA-FOLDER-MARKER");
      expect(betaFolderExport.body).not.toContain("ALPHA-PURCHASE-MARKER");

      const audit = new AuditLogStore({ rootDir: dataRoot });
      await audit.logFor(alphaContext, { action: "matrix", entityType: "case", entityId: "same-audit-id", actor: { name: "Alpha", source: "test" }, summary: "Alpha audit", at: "2026-06-14T10:00:00.000Z" });
      await audit.logFor(betaContext, { action: "matrix", entityType: "case", entityId: "same-audit-id", actor: { name: "Beta", source: "test" }, summary: "Beta audit", at: "2026-06-14T10:00:00.000Z" });
      expect((await audit.listRecentFor(alphaContext)).find((entry) => entry.action === "matrix")?.summary).toBe("Alpha audit");
      expect((await audit.listRecentFor(betaContext)).find((entry) => entry.action === "matrix")?.summary).toBe("Beta audit");

      const recipes = new RecipeLibrary({ rootDir: dataRoot });
      const recipe = internalRecipes[0]!;
      await recipes.save(alphaContext, { ...recipe, recipeId: "matrix-recipe", name: "Alpha recipe" });
      await recipes.save(betaContext, { ...recipe, recipeId: "matrix-recipe", name: "Beta recipe" });
      expect((await recipes.get(alphaContext, "matrix-recipe"))?.name).toBe("Alpha recipe");
      expect((await recipes.get(betaContext, "matrix-recipe"))?.name).toBe("Beta recipe");
    } finally {
      await Promise.all([
        offerAlpha.close(), offerBeta.close(), productionAlpha.close(), productionBeta.close(),
        intakeAlpha.close(), intakeBeta.close(), exportsAlpha.close(), exportsBeta.close()
      ]);
    }
  });
});
