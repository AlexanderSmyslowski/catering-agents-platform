import { mkdtempSync, rmSync } from "node:fs";
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
  createEventRequestFromText,
  createOfferDraft,
  hostedMultiBusinessReady,
  internalRecipes,
  normalizeEventRequestToSpec,
  RecipeLibrary,
  SCHEMA_VERSION,
  type ProductionPlan,
  type PurchaseList,
  validateOfferDraft
} from "@catering/shared-core";

const secret = "stage-a-business-isolation-secret";
const alpha = {
  "x-catering-trusted-secret": secret,
  "x-catering-actor-name": "Angebots-Mitarbeiter",
  "x-catering-business-id": "alpha"
};
const beta = { ...alpha, "x-catering-business-id": "beta" };
const roots: string[] = [];

function root(): string {
  const value = mkdtempSync(path.join(tmpdir(), "catering-stage-a-isolation-"));
  roots.push(value);
  return value;
}

describe("Stage A profile-independent business isolation", () => {
  afterEach(() => {
    for (const dataRoot of roots.splice(0)) rmSync(dataRoot, { recursive: true, force: true });
  });

  it("opens hosted mode only after the code-owned gate and never crosses identical case IDs", async () => {
    // The readiness flag is code-owned; this route-level proof keeps hosted startup
    // tied to the same trusted-business contract as the matrix below.
    expect(hostedMultiBusinessReady).toBe(true);
    const dataRoot = root();
    const offerStore = new OfferStore({ rootDir: dataRoot });
    const offerAlpha = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const offerBeta = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const productionStore = new ProductionStore({ rootDir: dataRoot });
    const productionAlpha = buildProductionApp({
      dataRoot,
      store: productionStore,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const productionBeta = buildProductionApp({
      dataRoot,
      store: productionStore,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });

    try {
      const alphaCase = await offerAlpha.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: alpha,
        payload: { customerName: "Alpha", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 10 }
      });
      const betaCase = await offerBeta.inject({
        method: "POST",
        url: "/v1/offers/cases",
        headers: beta,
        payload: { customerName: "Beta", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 10 }
      });
      expect(alphaCase.statusCode).toBe(201);
      expect(betaCase.statusCode).toBe(201);
      const alphaCaseId = alphaCase.json<{ case: { caseId: string } }>().case.caseId;
      const betaCaseId = betaCase.json<{ case: { caseId: string } }>().case.caseId;
      expect([403, 404]).toContain((await offerBeta.inject({ method: "GET", url: `/v1/offers/cases/${alphaCaseId}`, headers: beta })).statusCode);
      expect([403, 404]).toContain((await offerAlpha.inject({ method: "GET", url: `/v1/offers/cases/${betaCaseId}`, headers: alpha })).statusCode);

      const alphaProduction = await productionAlpha.inject({
        method: "POST",
        url: "/v1/production/cases",
        headers: { ...alpha, "x-catering-actor-name": "Produktions-Mitarbeiter" },
        payload: { customerName: "Alpha", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 10 }
      });
      const betaProduction = await productionBeta.inject({
        method: "POST",
        url: "/v1/production/cases",
        headers: { ...beta, "x-catering-actor-name": "Produktions-Mitarbeiter" },
        payload: { customerName: "Beta", eventTypeLabel: "Empfang", eventDate: "2026-06-14", attendeeCount: 10 }
      });
      expect(alphaProduction.statusCode).toBe(201);
      expect(betaProduction.statusCode).toBe(201);
      const alphaProductionCaseId = alphaProduction.json<{ case: { caseId: string } }>().case.caseId;
      expect([403, 404]).toContain((await productionBeta.inject({
        method: "GET",
        url: `/v1/production/cases/${alphaProductionCaseId}`,
        headers: { ...beta, "x-catering-actor-name": "Produktions-Mitarbeiter" }
      })).statusCode);
      expect((await productionAlpha.inject({
        method: "GET",
        url: "/v1/production/cases",
        headers: { ...alpha, "x-catering-actor-name": "Produktions-Mitarbeiter" }
      })).json().items).toHaveLength(1);
    } finally {
      await Promise.all([offerAlpha.close(), offerBeta.close(), productionAlpha.close(), productionBeta.close()]);
    }
  });

  it("keeps intake, artifacts, recipes, audits and every export bound to its trusted business", async () => {
    const dataRoot = root();
    const offerStore = new OfferStore({ rootDir: dataRoot });
    const productionStore = new ProductionStore({ rootDir: dataRoot });
    const intakeStore = new IntakeStore({ rootDir: dataRoot });
    const offerAlpha = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const offerBeta = buildOfferApp({
      rootDir: dataRoot,
      store: offerStore,
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const productionAlpha = buildProductionApp({
      dataRoot,
      store: productionStore,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const productionBeta = buildProductionApp({
      dataRoot,
      store: productionStore,
      intakeRecords: new InMemoryIntakeRecordsPort(),
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const intakeAlpha = buildIntakeApp({
      rootDir: dataRoot,
      store: intakeStore,
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const intakeBeta = buildIntakeApp({
      rootDir: dataRoot,
      store: intakeStore,
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const exports = buildPrintExportApp({
      rootDir: dataRoot,
      trustedActorSecret: secret,
      env: { CATERING_DEPLOYMENT_PROFILE: "hosted", CATERING_TRUSTED_ACTOR_SECRET: secret }
    });
    const alphaContext = { businessId: "alpha" } as const;
    const betaContext = { businessId: "beta" } as const;
    const intakeHeaders = { ...alpha, "x-catering-actor-name": "Intake-Mitarbeiter" };
    const betaIntakeHeaders = { ...beta, "x-catering-actor-name": "Intake-Mitarbeiter" };
    const productionAlphaHeaders = { ...alpha, "x-catering-actor-name": "Produktions-Mitarbeiter" };
    const productionBetaHeaders = { ...beta, "x-catering-actor-name": "Produktions-Mitarbeiter" };

    try {
      const offerCases = await Promise.all([
        offerAlpha.inject({ method: "POST", url: "/v1/offers/cases", headers: alpha, payload: { customerName: "Alpha", eventTypeLabel: "Matrix", eventDate: "2026-06-14", attendeeCount: 10 } }),
        offerBeta.inject({ method: "POST", url: "/v1/offers/cases", headers: beta, payload: { customerName: "Beta", eventTypeLabel: "Matrix", eventDate: "2026-06-14", attendeeCount: 20 } })
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
      const alphaOfferExport = await exports.inject({ method: "GET", url: `/v1/exports/offers/${alphaOfferDraftId}/html`, headers: alpha });
      const betaOfferExport = await exports.inject({ method: "GET", url: `/v1/exports/offers/${alphaOfferDraftId}/html`, headers: beta });
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
      const alphaPlanExport = await exports.inject({ method: "GET", url: "/v1/exports/production-plans/matrix-plan/html", headers: productionAlphaHeaders });
      const betaPlanExport = await exports.inject({ method: "GET", url: "/v1/exports/production-plans/matrix-plan/html", headers: productionBetaHeaders });
      expect(alphaPlanExport.statusCode).toBe(200);
      expect(betaPlanExport.statusCode).toBe(200);
      expect(alphaPlanExport.body).toContain("ALPHA-PLAN-MARKER");
      expect(alphaPlanExport.body).not.toContain("BETA-PLAN-MARKER");
      expect(betaPlanExport.body).toContain("BETA-PLAN-MARKER");
      expect(betaPlanExport.body).not.toContain("ALPHA-PLAN-MARKER");

      const alphaPurchaseExport = await exports.inject({ method: "GET", url: "/v1/exports/purchase-lists/matrix-purchase/csv", headers: productionAlphaHeaders });
      const betaPurchaseExport = await exports.inject({ method: "GET", url: "/v1/exports/purchase-lists/matrix-purchase/csv", headers: productionBetaHeaders });
      expect(alphaPurchaseExport.statusCode).toBe(200);
      expect(betaPurchaseExport.statusCode).toBe(200);
      expect(alphaPurchaseExport.body).toContain("ALPHA-PURCHASE-MARKER");
      expect(alphaPurchaseExport.body).not.toContain("BETA-PURCHASE-MARKER");
      expect(betaPurchaseExport.body).toContain("BETA-PURCHASE-MARKER");
      expect(betaPurchaseExport.body).not.toContain("ALPHA-PURCHASE-MARKER");

      const alphaFolderExport = await exports.inject({ method: "GET", url: "/v1/exports/production-folders/matrix-plan/html", headers: productionAlphaHeaders });
      const betaFolderExport = await exports.inject({ method: "GET", url: "/v1/exports/production-folders/matrix-plan/html", headers: productionBetaHeaders });
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
        intakeAlpha.close(), intakeBeta.close(), exports.close()
      ]);
    }
  });
});
