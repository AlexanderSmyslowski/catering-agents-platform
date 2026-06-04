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
          recipeSelections: [
            {
              componentId: "starter",
              selectionReason: "Internes Rezept passt am besten.",
              qualityScore: 0.91,
              fitScore: 0.87,
              searchTrace: ["Interner Treffer", "kein Fallback"]
            }
          ],
          kitchenSheets: [
            {
              title: "Küchenblatt Vorspeise",
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
          componentDetailLabel: "Kategorie: klassisch · Herstellungsart: Eigenproduktion",
          scoreLabel: "Qualität 91 % · Passung 87 %",
          searchTrace: ["Interner Treffer", "kein Fallback"]
        }
      ],
      showKitchenSheetsSection: true,
      kitchenSheets: [
        {
          key: "Küchenblatt Vorspeise-0",
          title: "Küchenblatt Vorspeise",
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
          scoreLabel: undefined,
          searchTrace: []
        }
      ],
      showKitchenSheetsSection: false,
      kitchenSheets: []
    });
  });
});
