import { describe, expect, it } from "vitest";
import type {
  AcceptedEventSpec,
  MenuComponent
} from "../shared-core/src/index.js";
import type { RecipeDiscoveryService } from "../production-service/src/recipe-discovery/service.js";
import type { PlanningArtifactAppender } from "../production-service/src/rules/planning-artifact-appender.js";
import { appendPlanningComponentBranchArtifacts } from "../production-service/src/rules/planning-component-branch.js";

function eventSpec(overrides: Partial<AcceptedEventSpec> = {}): AcceptedEventSpec {
  return {
    specId: "spec-component-branch-test",
    event: {
      date: "2026-06-24"
    },
    attendees: {
      expected: 40
    },
    menuPlan: [],
    ...overrides
  } as unknown as AcceptedEventSpec;
}

function component(label: string, overrides: Partial<MenuComponent> = {}): MenuComponent {
  return {
    componentId: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    menuCategory: "classic",
    ...overrides
  };
}

function artifactAppender(): PlanningArtifactAppender {
  const issues: string[] = [];
  return {
    productionBatches: [],
    procurementItems: [],
    kitchenSheets: [],
    timeline: [],
    recipeSelections: [],
    noteIssue: (issue) => {
      issues.push(issue);
    }
  };
}

function discoveryService(): RecipeDiscoveryService & { resolveCalls: number } {
  let resolveCalls = 0;
  return {
    get resolveCalls() {
      return resolveCalls;
    },
    async resolveRecipe() {
      resolveCalls += 1;
      throw new Error("Recipe discovery should not run for implicit baker purchases.");
    },
    async resolveRecipeOverride() {
      resolveCalls += 1;
      throw new Error("Recipe override discovery should not run for implicit baker purchases.");
    }
  } as unknown as RecipeDiscoveryService & { resolveCalls: number };
}

describe("planning component branch", () => {
  it("rejects context-free direct calls before an early planning branch", async () => {
    await expect((appendPlanningComponentBranchArtifacts as unknown as (
      input: Record<string, unknown>
    ) => Promise<unknown>)({
      eventSpec: eventSpec(),
      component: component("Brot & Baguette"),
      servings: 40,
      discoveryService: discoveryService(),
      artifactAppender: artifactAppender()
    })).rejects.toThrow("Betriebskontext");
  });

  it("keeps implicit baker purchases ahead of recipe discovery", async () => {
    const appender = artifactAppender();
    const recipes = discoveryService();

    await appendPlanningComponentBranchArtifacts({
      eventSpec: eventSpec(),
      component: component("Brot & Baguette"),
      servings: 40,
      context: { businessId: "local" },
      discoveryService: recipes,
      artifactAppender: appender
    });

    expect(recipes.resolveCalls).toBe(0);
    expect(appender.procurementItems.map((item) => item.displayName)).toEqual([
      "Baguette für Brot & Baguette",
      "Brot für Brot & Baguette"
    ]);
    expect(appender.recipeSelections.at(0)?.selectionReason).toContain("Bäcker-Zukauf");
    expect(appender.productionBatches).toEqual([]);
  });
});
