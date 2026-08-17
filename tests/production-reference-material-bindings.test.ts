import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  createEventRequestFromManualForm,
  internalRecipes,
  normalizeEventRequestToSpec
} from "@catering/shared-core";
import {
  buildProductionArtifacts,
  InMemoryRecipeRepository,
  RecipeDiscoveryService
} from "@catering/production-service";
import {
  evaluateProductionReferenceAcceptance,
  type ProductionReferenceAcceptanceInput
} from "../shared-core/src/production-reference-acceptance.js";

const syntheticSourceHash = "sha256:" + "b".repeat(64);

async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "catering-reference-bindings-"));
  const repository = new InMemoryRecipeRepository({ rootDir: root });
  await repository.save({ businessId: "local" }, internalRecipes[0]!);
  const request = createEventRequestFromManualForm({
    requestId: "reference-material-bindings",
    eventType: "internes Probe-Catering",
    eventDate: "2099-10-15",
    attendeeCount: 42,
    serviceForm: "buffet",
    menuItems: ["Filterkaffee Station"]
  });
  const spec = normalizeEventRequestToSpec(request, {
    sourceType: "manual_input",
    reference: request.requestId,
    commercialState: "manual"
  });
  const plannedSpec = {
    ...spec,
    menuPlan: spec.menuPlan.map((component) => ({
      ...component,
      menuCategory: "classic" as const,
      recipeOverrideId: "recipe-filter-coffee",
      productionDecision: { mode: "scratch" as const }
    }))
  };
  const artifacts = await buildProductionArtifacts(
    plannedSpec,
    new RecipeDiscoveryService(repository, { searchRecipes: async () => [] }),
    { context: { businessId: "local" } }
  );
  return { root, artifacts };
}

function inputFor(
  artifacts: Awaited<ReturnType<typeof fixture>>["artifacts"]
): ProductionReferenceAcceptanceInput {
  return {
    caseId: "reference-material-bindings",
    source: {
      expectedCaseId: "reference-material-bindings",
      expectedSha256: syntheticSourceHash,
      observedSha256: syntheticSourceHash,
      lineageReferences: ["audit:reference-material-bindings"]
    },
    offer: {
      offerId: "offer-reference-material-bindings",
      pricingSummary: {
        subtotal: { amount: 420, currency: "EUR" },
        perPerson: { amount: 10, currency: "EUR" }
      },
      pricingBasis: "module_catalog_estimate",
      approved: true,
      reviewStatus: {
        priceReviewStatus: "verified",
        taxReviewStatus: "verified",
        allergenReviewStatus: "verified",
        hygieneTemperatureReviewStatus: "verified",
        sourceSecured: true,
        publishApproved: true
      }
    },
    production: {
      plan: artifacts.productionPlan,
      purchaseList: artifacts.purchaseList,
      recipes: [internalRecipes[0]!]
    },
    operatorAcceptance: {
      accepted: true,
      acceptedBy: "synthetic-kitchen-reviewer",
      acceptedAt: "2099-10-15T12:00:00.000Z",
      rescueChatUsed: false
    }
  };
}

function blockerCodes(input: ProductionReferenceAcceptanceInput): string[] {
  return evaluateProductionReferenceAcceptance(input).blockers.map((blocker) => blocker.code);
}

describe("production reference material bindings", () => {
  it("blocks a kitchen sheet whose production quantity does not equal its batch yield", async () => {
    const { root, artifacts } = await fixture();
    try {
      const batch = artifacts.productionPlan.productionBatches[0]!;
      const plan = {
        ...artifacts.productionPlan,
        kitchenSheets: artifacts.productionPlan.kitchenSheets.map((sheet) =>
          sheet.componentId === batch.componentId
            ? { ...sheet, productionQty: { amount: 1, unit: batch.scaledYield.unit } }
            : sheet
        )
      };
      expect(blockerCodes({ ...inputFor(artifacts), production: { ...inputFor(artifacts).production, plan } }))
        .toContain("kitchen_sheet_quantity_mismatch");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks a kitchen sheet whose allergen or diet metadata differs from the selected approved recipe", async () => {
    const { root, artifacts } = await fixture();
    try {
      const batch = artifacts.productionPlan.productionBatches[0]!;
      const plan = {
        ...artifacts.productionPlan,
        kitchenSheets: artifacts.productionPlan.kitchenSheets.map((sheet) =>
          sheet.componentId === batch.componentId
            ? { ...sheet, allergens: [], dietTags: [] }
            : sheet
        )
      };
      expect(blockerCodes({ ...inputFor(artifacts), production: { ...inputFor(artifacts).production, plan } }))
        .toContain("kitchen_sheet_recipe_metadata_mismatch");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks an under-sized normalized purchase quantity even when the ingredient name and recipe id match", async () => {
    const { root, artifacts } = await fixture();
    try {
      const firstItem = artifacts.purchaseList.items[0]!;
      const purchaseList = {
        ...artifacts.purchaseList,
        items: artifacts.purchaseList.items.map((item, index) =>
          index === 0 ? { ...item, normalizedQty: Math.max(0.001, firstItem.normalizedQty / 100) } : item
        )
      };
      expect(blockerCodes({ ...inputFor(artifacts), production: { ...inputFor(artifacts).production, purchaseList } }))
        .toContain("purchase_quantity_insufficient");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
