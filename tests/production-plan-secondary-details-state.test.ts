import { describe, expect, it } from "vitest";
import { buildProductionPlanSecondaryDetailsState } from "../backoffice-ui/src/production-plan-secondary-details-state.js";

describe("production plan secondary details state", () => {
  it("returns undefined when no plan is selected", () => {
    expect(
      buildProductionPlanSecondaryDetailsState({
        selectedPlan: undefined,
        selectedPlanComponentsById: new Map(),
        archivedPlans: [],
        showArchivedPlans: false
      })
    ).toBeUndefined();
  });

  it("maps archived section, recipe selections, scores, traces, and kitchen sheets into stable labels", () => {
    expect(
      buildProductionPlanSecondaryDetailsState({
        selectedPlan: {
          productionBatches: [
            {
              componentId: "starter",
              recipeSource: {
                recipeId: "recipe-starter",
                recipeName: "Vorspeise Rezept",
                sourceTier: "internal_verified",
                originType: "internal_db",
                approvalState: "approved_internal",
                reference: "internal:starter"
              }
            }
          ],
          recipeSelections: [
            {
              componentId: "starter",
              recipeId: "recipe-starter",
              selectionReason: "Internes Rezept passt am besten.",
              qualityScore: 0.91,
              fitScore: 0.87,
              searchTrace: ["Interner Treffer", "kein Fallback"]
            }
          ],
          kitchenSheets: [
            {
              title: "Küchenblatt Vorspeise",
              recipeId: "recipe-starter",
              recipeSource: {
                recipeId: "recipe-starter",
                recipeName: "Vorspeise Rezept",
                sourceTier: "internal_verified",
                originType: "internal_db",
                approvalState: "approved_internal",
                reference: "internal:starter"
              },
              instructions: ["30 Portionen vorbereiten", "Kühl lagern"]
            }
          ]
        },
        selectedPlanComponentsById: new Map([
          [
            "starter",
            {
              label: "Vorspeise",
              menuCategory: "classic",
              productionDecision: { mode: "scratch" }
            }
          ]
        ]),
        archivedPlans: [{ planId: "plan-archived-1" }],
        showArchivedPlans: true
      })
    ).toEqual({
      showArchivedPlansSection: true,
      recipeSelections: [
        {
          key: "starter-0",
          componentLabel: "Vorspeise",
          selectionReasonLabel: "Internes Rezept passt am besten.",
          componentDetailLabel: "Kategorie: Klassisch · Herstellungsart: Eigenproduktion",
          sourceLabel:
            "Vorspeise Rezept | recipe-starter | internal recipe, approved | internal_verified | approved_internal | internal:starter",
          scoreLabel: "Qualität 91 % · Passung 87 %",
          searchTrace: ["Interner Treffer", "kein Fallback"]
        }
      ],
      showKitchenSheetsSection: true,
      kitchenSheets: [
        {
          key: "Küchenblatt Vorspeise-0",
          title: "Küchenblatt Vorspeise",
          sourceLabel:
            "Vorspeise Rezept | recipe-starter | internal recipe, approved | internal_verified | approved_internal | internal:starter",
          instructions: ["30 Portionen vorbereiten", "Kühl lagern"]
        }
      ]
    });
  });

  it("keeps fallback labels explicit when component, scores, traces, or archive visibility are missing", () => {
    expect(
      buildProductionPlanSecondaryDetailsState({
        selectedPlan: {
          recipeSelections: [
            {
              componentId: "",
              selectionReason: undefined
            }
          ],
          kitchenSheets: []
        },
        selectedPlanComponentsById: new Map(),
        archivedPlans: [{ planId: "plan-archived-1" }],
        showArchivedPlans: false
      })
    ).toEqual({
      showArchivedPlansSection: false,
      recipeSelections: [
        {
          key: "selection-0",
          componentLabel: "-",
          selectionReasonLabel: "-",
          componentDetailLabel: undefined,
          sourceLabel: "source unknown",
          scoreLabel: undefined,
          searchTrace: []
        }
      ],
      showKitchenSheetsSection: false,
      kitchenSheets: []
    });
  });

  it("normalizes malformed secondary detail entries to explicit UI fallbacks", () => {
    expect(
      buildProductionPlanSecondaryDetailsState({
        selectedPlan: {
          productionBatches: ["not-a-batch"],
          recipeSelections: ["not-a-selection"],
          kitchenSheets: ["not-a-sheet"]
        },
        selectedPlanComponentsById: new Map(),
        archivedPlans: [],
        showArchivedPlans: false
      })
    ).toEqual({
      showArchivedPlansSection: false,
      recipeSelections: [
        {
          key: "selection-0",
          componentLabel: "-",
          selectionReasonLabel: "-",
          componentDetailLabel: undefined,
          sourceLabel: "source unknown",
          scoreLabel: undefined,
          searchTrace: []
        }
      ],
      showKitchenSheetsSection: true,
      kitchenSheets: [
        {
          key: "Arbeitsblatt-0",
          title: "Arbeitsblatt",
          sourceLabel: "source unknown",
          instructions: []
        }
      ]
    });
  });

  it("keeps reviewed web recipe source evidence visible without treating it as final truth", () => {
    const state = buildProductionPlanSecondaryDetailsState({
      selectedPlan: {
        productionBatches: [
          {
            componentId: "starter",
            recipeSource: {
              recipeId: "recipe-web-starter",
              recipeName: "Web Starter",
              sourceTier: "internal_approved",
              originType: "web",
              approvalState: "approved_internal",
              reference: "web:starter",
              publisher: "Example Recipes",
              url: "https://example.test/starter"
            }
          }
        ],
        recipeSelections: [
          {
            componentId: "starter",
            recipeId: "recipe-web-starter"
          }
        ],
        kitchenSheets: [
          {
            title: "Küchenblatt Web Starter",
            recipeId: "recipe-web-starter",
            recipeSource: {
              recipeId: "recipe-web-starter",
              recipeName: "Web Starter",
              sourceTier: "internal_approved",
              originType: "web",
              approvalState: "approved_internal",
              reference: "web:starter",
              publisher: "Example Recipes",
              url: "https://example.test/starter"
            },
            instructions: []
          }
        ]
      },
      selectedPlanComponentsById: new Map([
        [
          "starter",
          {
            label: "Starter",
            menuCategory: "classic",
            productionDecision: { mode: "scratch" }
          }
        ]
      ]),
      archivedPlans: [],
      showArchivedPlans: false
    });

    expect(state?.recipeSelections[0]?.sourceLabel).toContain("web recipe, reviewed");
    expect(state?.recipeSelections[0]?.sourceLabel).toContain("Example Recipes");
    expect(state?.recipeSelections[0]?.sourceLabel).toContain("https://example.test/starter");
    expect(state?.kitchenSheets[0]?.sourceLabel).toContain("web recipe, reviewed");
  });
});
