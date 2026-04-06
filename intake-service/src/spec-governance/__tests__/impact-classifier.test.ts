import { describe, expect, it } from "vitest";
import { finalizeClassifiedChangeSet, classifyImpact, type JsonObject } from "../impact-classifier.js";

function buildSpecDocument(overrides: JsonObject = {}): JsonObject {
  const base: JsonObject = {
    schemaVersion: "1.0.0",
    specId: "spec-1",
    ownershipContext: "customer",
    lifecycle: {
      commercialState: "manual"
    },
    readiness: {
      status: "partial",
      reasons: []
    },
    sourceLineage: [
      {
        sourceType: "manual_input",
        reference: "manual-1"
      }
    ],
    event: {
      type: "buffet",
      date: "2026-06-18",
      serviceForm: "buffet"
    },
    attendees: {
      expected: 100,
      productionPax: 100
    },
    servicePlan: {
      eventType: "buffet",
      serviceForm: "buffet",
      modules: []
    },
    menuPlan: [
      {
        componentId: "hauptgang-1",
        label: "Pasta",
        course: "main",
        menuCategory: "vegetarian",
        serviceStyle: "buffet",
        desiredRecipeTags: ["buffet"],
        servings: 100,
        dietaryTags: [],
        productionDecision: {
          mode: "scratch",
          purchasedElements: [],
          notes: "alte Notiz"
        }
      }
    ],
    productionConstraints: ["nuts"],
    budgetContext: {
      pricingSummary: {
        subtotal: {
          amount: 1000,
          currency: "EUR"
        },
        perPerson: {
          amount: 10,
          currency: "EUR"
        }
      }
    },
    assumptions: []
  };

  return {
    ...base,
    ...overrides
  };
}

describe("ImpactClassifier", () => {
  it("classifies a prepared yield change after ShoppingCompleted as L3 with confirmation", () => {
    const result = classifyImpact({
      currentDocument: buildSpecDocument({
        yieldProfile: {
          yieldFactor: 0.9
        }
      }),
      nextDocument: buildSpecDocument({
        yieldProfile: {
          yieldFactor: 0.85
        }
      }),
      lastHardApprovedDocument: buildSpecDocument({
        yieldProfile: {
          yieldFactor: 0.9
        }
      }),
      milestones: {
        shoppingCompleted: true,
        productionStarted: false
      }
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].fieldGroupKey).toBe("yield");
    expect(result.items[0].impactLevel).toBe("L3");
    expect(result.items[0].pointOfNoReturnResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          milestone: "ShoppingCompleted",
          severity: "confirm",
          active: true
        })
      ])
    );
  });

  it("classifies a production constraint change after ProductionStarted as STOP", () => {
    const result = classifyImpact({
      currentDocument: buildSpecDocument({
        productionConstraints: ["nuts"]
      }),
      nextDocument: buildSpecDocument({
        productionConstraints: ["nuts", "gluten"]
      }),
      lastHardApprovedDocument: buildSpecDocument({
        productionConstraints: ["nuts"]
      }),
      milestones: {
        shoppingCompleted: false,
        productionStarted: true
      }
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((item) => item.fieldGroupKey === "allergens")).toBe(true);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldGroupKey: "allergens",
          impactLevel: "L3",
          pointOfNoReturnResults: expect.arrayContaining([
            expect.objectContaining({
              milestone: "ProductionStarted",
              severity: "stop",
              active: true
            })
          ])
        })
      ])
    );
  });

  it("detects salami tactic against last hard approved baseline for attendee count", () => {
    const result = classifyImpact({
      currentDocument: buildSpecDocument({
        attendees: {
          expected: 104,
          productionPax: 104
        },
        menuPlan: [
          {
            componentId: "hauptgang-1",
            label: "Pasta",
            servings: 104
          }
        ]
      }),
      nextDocument: buildSpecDocument({
        attendees: {
          expected: 106,
          productionPax: 106
        },
        menuPlan: [
          {
            componentId: "hauptgang-1",
            label: "Pasta",
            servings: 106
          }
        ]
      }),
      lastHardApprovedDocument: buildSpecDocument({
        attendees: {
          expected: 100,
          productionPax: 100
        },
        menuPlan: [
          {
            componentId: "hauptgang-1",
            label: "Pasta",
            servings: 100
          }
        ]
      }),
      milestones: {
        shoppingCompleted: false,
        productionStarted: false
      }
    });

    expect(result.items.some((item) => item.fieldGroupKey === "guest_count")).toBe(true);
    expect(result.items[0].oldValuePreview).toBe("100");
    expect(result.items[0].newValuePreview).toBe("106");
    expect(result.items[0].semanticMessage).toContain("+6.00% vs last hard approved");
  });

  it("keeps L2 pricing change without reapproval", () => {
    const classified = classifyImpact({
      currentDocument: buildSpecDocument({
        budgetContext: {
          pricingSummary: {
            perPerson: {
              amount: 10,
              currency: "EUR"
            }
          }
        }
      }),
      nextDocument: buildSpecDocument({
        budgetContext: {
          pricingSummary: {
            perPerson: {
              amount: 10.7,
              currency: "EUR"
            }
          }
        }
      }),
      lastHardApprovedDocument: buildSpecDocument({
        budgetContext: {
          pricingSummary: {
            perPerson: {
              amount: 10,
              currency: "EUR"
            }
          }
        }
      }),
      milestones: {
        shoppingCompleted: false,
        productionStarted: false
      }
    });

    expect(classified.items).toHaveLength(1);
    expect(classified.items[0].fieldGroupKey).toBe("prices");
    expect(classified.items[0].impactLevel).toBe("L2");
    expect(classified.requiresReapproval).toBe(false);
    expect(classified.hasPointOfNoReturnConflict).toBe(false);
  });

  it("supports explicit classification finalization with multiple repo-compatible items", () => {
    const classified = classifyImpact({
      currentDocument: buildSpecDocument(),
      nextDocument: buildSpecDocument({
        attendees: {
          expected: 105,
          productionPax: 105
        },
        menuPlan: [
          {
            componentId: "hauptgang-1",
            label: "Pasta",
            course: "main",
            menuCategory: "vegetarian",
            serviceStyle: "buffet",
            desiredRecipeTags: ["buffet"],
            servings: 105,
            dietaryTags: [],
            productionDecision: {
              mode: "scratch",
              purchasedElements: [],
              notes: "neue Notiz"
            }
          }
        ]
      }),
      lastHardApprovedDocument: buildSpecDocument(),
      milestones: {
        shoppingCompleted: false,
        productionStarted: false
      }
    });

    expect(classified.items.length).toBeGreaterThanOrEqual(2);
    expect(classified.items.some((item) => item.fieldGroupKey === "guest_count")).toBe(true);
    expect(classified.items.some((item) => item.fieldGroupKey === "notes")).toBe(true);

    const finalized = finalizeClassifiedChangeSet(classified.items);
    expect(finalized.highestImpactLevel).toBe("L3");
    expect(finalized.requiresReapproval).toBe(true);
    expect(finalized.summary).toBeTruthy();
    expect(finalized.summary).toMatch(/Mengen geaendert|Mengen verfeinert/);
  });
});
