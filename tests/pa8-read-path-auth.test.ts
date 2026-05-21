import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIntakeApp } from "../intake-service/src/app.js";
import { buildOfferApp } from "../offer-service/src/app.js";
import { buildProductionApp } from "../production-service/src/app.js";
import { buildPrintExportApp } from "../print-export/src/index.js";

const TRUSTED_SECRET = "pa8-shared-secret";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-pa8-read-path-auth-"));
}

const trustedHeaders = (actorName: string) => ({
  "x-catering-actor-name": actorName,
  "x-catering-trusted-secret": TRUSTED_SECRET
});

const spoofedHeaders = (actorName: string) => ({
  "x-actor-name": actorName
});

async function withApp<T extends { close: () => Promise<void> }, R>(app: T, fn: (app: T) => Promise<R>): Promise<R> {
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

describe("PA8 read-path auth hardening", () => {
  const dataRoots: string[] = [];

  afterEach(() => {
    for (const dataRoot of dataRoots.splice(0)) {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  it("requires trusted intake actor for read-only request and spec detail paths when a trusted secret is configured", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);

    await withApp(buildIntakeApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET }), async (app) => {
      const seedResponse = await app.inject({
        method: "POST",
        url: "/v1/intake/seed-demo",
        headers: trustedHeaders("Betriebs-/Audit-Operator")
      });
      expect(seedResponse.statusCode).toBe(201);
      const [{ requestId, specId }] = seedResponse.json<{ seeded: Array<{ requestId: string; specId: string }> }>().seeded;

      const spoofedDetail = await app.inject({
        method: "GET",
        url: `/v1/intake/requests/${requestId}`,
        headers: spoofedHeaders("Intake-Mitarbeiter")
      });
      expect(spoofedDetail.statusCode).toBe(403);

      const wrongRole = await app.inject({
        method: "GET",
        url: `/v1/intake/specs/${specId}`,
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(wrongRole.statusCode).toBe(403);

      const trustedRequest = await app.inject({
        method: "GET",
        url: `/v1/intake/requests/${requestId}`,
        headers: trustedHeaders("Intake-Mitarbeiter")
      });
      expect(trustedRequest.statusCode).toBe(200);
      expect(trustedRequest.json()).toMatchObject({ requestId });

      const trustedSpec = await app.inject({
        method: "GET",
        url: `/v1/intake/specs/${specId}`,
        headers: trustedHeaders("Intake-Mitarbeiter")
      });
      expect(trustedSpec.statusCode).toBe(200);
      expect(trustedSpec.json()).toMatchObject({ specId });

      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
    });
  });

  it("requires trusted offer actor for offer and recipe read-only paths when a trusted secret is configured", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);

    await withApp(buildOfferApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET }), async (app) => {
      const seedResponse = await app.inject({
        method: "POST",
        url: "/v1/offers/seed-demo",
        headers: trustedHeaders("Betriebs-/Audit-Operator")
      });
      expect(seedResponse.statusCode).toBe(201);
      const [{ draftId }] = seedResponse.json<{ seeded: Array<{ draftId: string }> }>().seeded;

      const recipeResponse = await app.inject({
        method: "POST",
        url: "/v1/offers/recipes/import-text",
        headers: trustedHeaders("Angebots-Mitarbeiter"),
        payload: {
          recipeName: "PA8 Test Rezept",
          text: [
            "PA8 Test Rezept",
            "Zutaten",
            "500 g Wasser",
            "Zubereitung",
            "1. Wasser kochen."
          ].join("\n")
        }
      });
      expect(recipeResponse.statusCode).toBe(201);
      const recipeId = recipeResponse.json<{ recipe: { recipeId: string } }>().recipe.recipeId;

      const spoofedDraft = await app.inject({
        method: "GET",
        url: `/v1/offers/drafts/${draftId}`,
        headers: spoofedHeaders("Angebots-Mitarbeiter")
      });
      expect(spoofedDraft.statusCode).toBe(403);

      const wrongRole = await app.inject({
        method: "GET",
        url: `/v1/offers/recipes/${recipeId}`,
        headers: trustedHeaders("Produktions-Mitarbeiter")
      });
      expect(wrongRole.statusCode).toBe(403);

      const trustedDraft = await app.inject({
        method: "GET",
        url: `/v1/offers/drafts/${draftId}`,
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(trustedDraft.statusCode).toBe(200);
      expect(trustedDraft.json()).toMatchObject({ draftId });

      const trustedRecipe = await app.inject({
        method: "GET",
        url: `/v1/offers/recipes/${recipeId}`,
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(trustedRecipe.statusCode).toBe(200);
      expect(trustedRecipe.json()).toMatchObject({ recipeId });

      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
    });
  });

  it("requires trusted production actor for production detail and export read paths when a trusted secret is configured", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);

    let planId = "";
    let purchaseListId = "";
    await withApp(buildProductionApp({ dataRoot, trustedActorSecret: TRUSTED_SECRET }), async (app) => {
      const seedResponse = await app.inject({
        method: "POST",
        url: "/v1/production/seed-demo",
        headers: trustedHeaders("Betriebs-/Audit-Operator")
      });
      expect(seedResponse.statusCode).toBe(201);
      [{ planId, purchaseListId }] = seedResponse.json<{ seeded: Array<{ planId: string; purchaseListId: string }> }>().seeded;

      const spoofedPlan = await app.inject({
        method: "GET",
        url: `/v1/production/plans/${planId}`,
        headers: spoofedHeaders("Produktions-Mitarbeiter")
      });
      expect(spoofedPlan.statusCode).toBe(403);

      const wrongRole = await app.inject({
        method: "GET",
        url: `/v1/production/purchase-lists/${purchaseListId}`,
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(wrongRole.statusCode).toBe(403);

      const trustedPlan = await app.inject({
        method: "GET",
        url: `/v1/production/plans/${planId}`,
        headers: trustedHeaders("Produktions-Mitarbeiter")
      });
      expect(trustedPlan.statusCode).toBe(200);
      expect(trustedPlan.json()).toMatchObject({ planId });

      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
    });

    await withApp(buildPrintExportApp({ rootDir: dataRoot, trustedActorSecret: TRUSTED_SECRET }), async (app) => {
      const spoofedExport = await app.inject({
        method: "GET",
        url: `/v1/exports/production-plans/${planId}/html`,
        headers: spoofedHeaders("Produktions-Mitarbeiter")
      });
      expect(spoofedExport.statusCode).toBe(403);

      const wrongRoleExport = await app.inject({
        method: "GET",
        url: `/v1/exports/purchase-lists/${purchaseListId}/csv`,
        headers: trustedHeaders("Angebots-Mitarbeiter")
      });
      expect(wrongRoleExport.statusCode).toBe(403);

      const trustedPlanExport = await app.inject({
        method: "GET",
        url: `/v1/exports/production-plans/${planId}/html`,
        headers: trustedHeaders("Produktions-Mitarbeiter")
      });
      expect(trustedPlanExport.statusCode).toBe(200);
      expect(trustedPlanExport.headers["content-type"]).toContain("text/html");

      const trustedPurchaseExport = await app.inject({
        method: "GET",
        url: `/v1/exports/purchase-lists/${purchaseListId}/csv`,
        headers: trustedHeaders("Produktions-Mitarbeiter")
      });
      expect(trustedPurchaseExport.statusCode).toBe(200);
      expect(trustedPurchaseExport.headers["content-type"]).toContain("text/csv");

      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
    });
  });

  it("keeps dev/test read compatibility when no trusted secret is configured", async () => {
    const dataRoot = createDataRoot();
    dataRoots.push(dataRoot);

    await withApp(buildIntakeApp({ rootDir: dataRoot }), async (app) => {
      const seedResponse = await app.inject({
        method: "POST",
        url: "/v1/intake/seed-demo",
        headers: spoofedHeaders("Betriebs-/Audit-Operator")
      });
      expect(seedResponse.statusCode).toBe(201);
      const [{ requestId }] = seedResponse.json<{ seeded: Array<{ requestId: string }> }>().seeded;

      const response = await app.inject({
        method: "GET",
        url: `/v1/intake/requests/${requestId}`,
        headers: spoofedHeaders("Intake-Mitarbeiter")
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ requestId });
    });
  });
});
