import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  normalizeEventRequestToSpec,
  type AcceptedEventSpec,
  type EventRequest
} from "@catering/shared-core";
import {
  buildProductionApp,
  isWebRecipeSearchEnabled
} from "@catering/production-service";

function createDataRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "catering-agents-web-gate-"));
}

function baseEventRequest(text: string): EventRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: "request-web-gate",
    source: {
      channel: "text",
      receivedAt: "2026-06-01T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: text
      }
    ]
  };
}

function mysteryBowlSpec(): AcceptedEventSpec {
  const spec = normalizeEventRequestToSpec(
    baseEventRequest("Konferenz am 2026-06-01 fuer 40 Teilnehmer. Buffet mit Mystery Bowl.")
  );

  return {
    ...spec,
    menuPlan: spec.menuPlan.map((item) => ({
      ...item,
      label: "Mystery Bowl",
      menuCategory: "vegan",
      dietaryTags: ["vegan"],
      productionDecision: {
        mode: "scratch"
      }
    }))
  };
}

describe("production web recipe search gate", () => {
  it("keeps external recipe search disabled unless the operator opts in", () => {
    expect(isWebRecipeSearchEnabled({})).toBe(false);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "0" })).toBe(false);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "false" })).toBe(false);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "1" })).toBe(true);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: "true" })).toBe(true);
    expect(isWebRecipeSearchEnabled({ CATERING_ENABLE_WEB_RECIPE_SEARCH: " TRUE " })).toBe(true);
  });

  it("does not materialize internet fallback recipes in the default production app", async () => {
    const dataRoot = createDataRoot();
    const app = buildProductionApp({
      dataRoot,
      env: {}
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/production/plans",
        payload: {
          eventSpec: mysteryBowlSpec()
        }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.productionPlan.productionBatches).toHaveLength(0);
      expect(body.productionPlan.unresolvedItems.length).toBeGreaterThan(0);
      expect(body.productionPlan.recipeSelections[0].sourceTier).toBeUndefined();
      expect(body.productionPlan.recipeSelections[0].autoUsedInternetRecipe).toBe(false);

      const recipesResponse = await app.inject({
        method: "GET",
        url: "/v1/production/recipes"
      });

      expect(recipesResponse.statusCode).toBe(200);
      expect(
        recipesResponse
          .json()
          .items.some((item: { source: { tier: string } }) => item.source.tier === "internet_fallback")
      ).toBe(false);
    } finally {
      await app.close();
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
