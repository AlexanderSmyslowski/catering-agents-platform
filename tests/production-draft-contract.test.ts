import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProductionDraft,
  type AcceptedEventSpec,
  type ProductionDraft,
  type ProductionPlan,
  type PurchaseList,
  type Recipe
} from "@catering/shared-core";

function eventSpec(): AcceptedEventSpec {
  return {
    schemaVersion: SCHEMA_VERSION,
    specId: "spec-ai-draft-1",
    lifecycle: {
      commercialState: "accepted"
    },
    readiness: {
      status: "partial",
      reasons: ["KI-Produktionsentwurf wartet auf menschliche Review."]
    },
    sourceLineage: [
      {
        sourceType: "pdf",
        reference: "upload:sha256:source-pdf"
      }
    ],
    customer: {
      name: "Köpff Beispielkunde"
    },
    event: {
      title: "Exklusives Buffet",
      type: "reception",
      date: "2026-06-14",
      serviceForm: "buffet",
      schedule: [
        {
          label: "Welcome Drink",
          start: "16:30"
        },
        {
          label: "Buffet",
          start: "19:00"
        }
      ]
    },
    attendees: {
      expected: 45
    },
    servicePlan: {
      eventType: "reception",
      serviceForm: "buffet",
      modules: []
    },
    menuPlan: [
      {
        componentId: "component-vitello",
        label: "Vitello tonnato | Riesenkapern | weißer Thunfisch",
        course: "Buffet",
        menuCategory: "classic",
        servings: 45,
        productionDecision: {
          mode: "scratch"
        }
      }
    ],
    uncertainties: [
      {
        field: "event.schedule",
        message: "Endzeit der Veranstaltung fehlt.",
        severity: "medium",
        suggestedQuestion: "Bis wann soll das Buffet betreut werden?"
      }
    ]
  };
}

function recipe(): Recipe {
  return {
    schemaVersion: SCHEMA_VERSION,
    recipeId: "recipe-vitello",
    name: "Vitello tonnato",
    source: {
      tier: "internal_approved",
      originType: "approved_import",
      reference: "KI-Entwurf aus Upload, noch nicht freigegeben",
      retrievedAt: "2026-07-01T12:00:00.000Z",
      approvalState: "review_required",
      qualityScore: 0.82,
      fitScore: 0.78,
      extractionCompleteness: 0.9
    },
    baseYield: {
      servings: 45,
      unit: "Portionen"
    },
    ingredients: [
      {
        ingredientId: "ingredient-kalbsnuss",
        name: "Kalbsnuss, roh",
        quantity: {
          amount: 3200,
          unit: "g"
        },
        group: "fleisch"
      }
    ],
    steps: [
      {
        index: 1,
        instruction: "Kalbsnuss garen, auskühlen lassen und dünn aufschneiden."
      }
    ],
    scalingRules: {
      defaultLossFactor: 1.29
    },
    allergens: ["fisch", "ei"],
    dietTags: []
  };
}

function productionPlan(): ProductionPlan {
  return {
    schemaVersion: SCHEMA_VERSION,
    planId: "plan-ai-draft-1",
    eventSpecId: "spec-ai-draft-1",
    readiness: {
      status: "partial",
      reasons: ["Mengen und Garparameter müssen freigegeben werden."]
    },
    productionBatches: [
      {
        batchId: "batch-vitello",
        componentId: "component-vitello",
        recipeId: "recipe-vitello",
        scaledYield: {
          amount: 45,
          unit: "servings"
        },
        batchCount: 1,
        lossFactor: 1.29,
        gnPlan: [
          {
            container: "GN 1/1",
            count: 1
          }
        ],
        station: "Kalte Küche",
        prepWindow: "Vortag",
        ingredients: recipe().ingredients,
        steps: recipe().steps
      }
    ],
    timeline: [
      {
        label: "Vitello vorbereiten",
        at: "2026-06-13T14:00:00.000Z"
      }
    ],
    kitchenSheets: [
      {
        title: "Vitello tonnato",
        instructions: ["Rezeptkarte vor Produktion prüfen."],
        componentId: "component-vitello",
        productionQty: {
          amount: 45,
          unit: "servings"
        },
        station: "Kalte Küche",
        prepWindow: "Vortag",
        ingredients: recipe().ingredients,
        steps: recipe().steps,
        recipeId: "recipe-vitello"
      }
    ],
    recipeSelections: [
      {
        componentId: "component-vitello",
        recipeId: "recipe-vitello",
        selectionReason: "KI-Entwurf anhand Angebotsposition.",
        autoUsedInternetRecipe: false,
        sourceTier: "internal_approved",
        qualityScore: 0.82,
        fitScore: 0.78
      }
    ],
    unresolvedItems: ["Kerntemperatur prüfen"],
    warnings: ["KI-Entwurf: nicht ohne Review produktiv verwenden."]
  };
}

function purchaseList(): PurchaseList {
  return {
    schemaVersion: SCHEMA_VERSION,
    purchaseListId: "purchase-ai-draft-1",
    eventSpecId: "spec-ai-draft-1",
    items: [
      {
        ingredientId: "ingredient-kalbsnuss",
        displayName: "Kalbsnuss, roh",
        normalizedQty: 3.2,
        normalizedUnit: "kg",
        purchaseQty: 3.2,
        purchaseUnit: "kg",
        group: "fleisch",
        supplierHint: "Metro Fresh",
        sourceRecipes: ["Vitello tonnato"],
        mappingConfidence: 0.9
      }
    ],
    groupingMode: "group",
    totals: {
      itemCount: 1,
      groups: ["fleisch"]
    }
  };
}

function productionDraft(): ProductionDraft {
  return {
    schemaVersion: SCHEMA_VERSION,
    draftId: "production-draft-1",
    status: "pending_review",
    createdAt: "2026-07-01T12:00:00.000Z",
    source: {
      kind: "agent_cli",
      receivedAt: "2026-07-01T12:00:00.000Z",
      providerId: "local-operator-cli",
      modelId: "operator-selected-model",
      sourceRef: "upload:angebot-koepff.pdf",
      inputHash: "sha256:input-redacted",
      outputHash: "sha256:output-structured",
      runId: "run-1"
    },
    guardrails: {
      draftOnly: true,
      humanApprovalRequired: true,
      writesProductObjects: false,
      rawProviderPayloadStored: false,
      knowledgeWritePolicy: "reviewed_only"
    },
    reviewCards: [
      {
        cardId: "card-menu-vitello",
        kind: "menu_component",
        title: "Vitello tonnato",
        summary: "Menükomponente aus dem Angebots-PDF erkannt.",
        decision: "pending",
        targetPath: "$.draftArtifacts.eventSpec.menuPlan[0]",
        targetId: "component-vitello",
        requiredApproval: true
      },
      {
        cardId: "card-temperature-risk",
        kind: "risk",
        title: "Garparameter offen",
        summary: "Kerntemperatur und Konvektomat-Einstellung sind fachlich zu prüfen.",
        decision: "pending",
        targetPath: "$.draftArtifacts.productionPlan",
        riskLevel: "blocking",
        requiredApproval: true
      },
      {
        cardId: "card-purchase-list",
        kind: "purchase_item",
        title: "Einkaufsliste prüfen",
        summary: "Mengen und Warengruppen aus dem KI-Entwurf fachlich prüfen.",
        decision: "pending",
        targetPath: "$.draftArtifacts.purchaseList",
        targetId: "purchase-ai-draft-1",
        requiredApproval: true
      },
      {
        cardId: "card-recipe-vitello",
        kind: "recipe",
        title: "Rezeptkarte Vitello prüfen",
        summary: "Rezept, Allergene und Garparameter vor Übernahme prüfen.",
        decision: "pending",
        targetPath: "$.draftArtifacts.recipes[0]",
        targetId: "recipe-vitello",
        requiredApproval: true
      }
    ],
    draftArtifacts: {
      eventSpec: eventSpec(),
      productionPlan: productionPlan(),
      purchaseList: purchaseList(),
      recipes: [recipe()],
      openQuestions: [
        {
          field: "recipe.recipe-vitello.temperature",
          message: "Kerntemperatur fehlt.",
          severity: "high",
          suggestedQuestion: "Welche Kerntemperatur soll für die Kalbsnuss gelten?"
        }
      ],
      notes: ["KI-Entwurf wartet vollständig auf Review."]
    }
  };
}

function expectInvalid(value: unknown, expectedMessage: RegExp) {
  expect(() => validateProductionDraft(value as ProductionDraft)).toThrow(expectedMessage);
}

describe("ProductionDraft contract", () => {
  it("accepts a structured draft-only production packet with review cards", () => {
    const draft = productionDraft();

    expect(validateProductionDraft(draft)).toEqual(draft);
  });

  it("requires at least one draft artifact", () => {
    expectInvalid(
      {
        ...productionDraft(),
        draftArtifacts: {}
      },
      /must match a schema in anyOf/
    );
  });

  it("rejects forbidden payload keys at any depth", () => {
    const leakedSpec = eventSpec();
    leakedSpec.attendees = {
      ...leakedSpec.attendees,
      dietaryMix: {
        prompt: 1
      }
    };

    expectInvalid(
      {
        ...productionDraft(),
        draftArtifacts: {
          ...productionDraft().draftArtifacts,
          eventSpec: leakedSpec
        }
      },
      /prompt is not allowed in ProductionDraft/
    );
  });

  it("rejects oversized free-text payloads instead of accepting raw dumps as notes", () => {
    expectInvalid(
      {
        ...productionDraft(),
        draftArtifacts: {
          ...productionDraft().draftArtifacts,
          notes: ["x".repeat(1001)]
        }
      },
      /must NOT have more than 1000 characters/
    );
  });

  it("does not allow a notes-only draft artifact", () => {
    expectInvalid(
      {
        ...productionDraft(),
        draftArtifacts: {
          notes: ["Notiz ohne fachliches Draft-Artefakt."]
        }
      },
      /must match a schema in anyOf/
    );
  });

  it("requires model and hash provenance for AI or CLI sourced drafts", () => {
    expectInvalid(
      {
        ...productionDraft(),
        source: {
          kind: "ai_provider",
          receivedAt: "2026-07-01T12:00:00.000Z",
          providerId: "provider-1"
        }
      },
      /must have required property 'modelId'/
    );
  });

  it("keeps AI output draft-only and forbids product writes", () => {
    expectInvalid(
      {
        ...productionDraft(),
        guardrails: {
          ...productionDraft().guardrails,
          writesProductObjects: true
        }
      },
      /must be equal to constant/
    );
  });

  it("requires review coverage for each materializable draft artifact", () => {
    expectInvalid(
      {
        ...productionDraft(),
        reviewCards: [
          {
            cardId: "card-event-only",
            kind: "event_data",
            title: "Eventdaten",
            summary: "Nur die Eventdaten wurden als Pruefpunkt sichtbar gemacht.",
            decision: "pending",
            targetPath: "$.draftArtifacts.eventSpec",
            targetId: "spec-ai-draft-1",
            requiredApproval: true
          }
        ]
      },
      /review coverage missing for draftArtifacts.productionPlan/
    );
  });

  it("requires review coverage for every drafted recipe card", () => {
    expectInvalid(
      {
        ...productionDraft(),
        draftArtifacts: {
          ...productionDraft().draftArtifacts,
          recipes: [
            recipe(),
            {
              ...recipe(),
              recipeId: "recipe-roastbeef",
              name: "Roastbeef"
            }
          ]
        }
      },
      /review coverage missing for draftArtifacts\.recipes\[1\]/
    );
  });

  it("limits review decisions to the simple operator card states", () => {
    expectInvalid(
      {
        ...productionDraft(),
        reviewCards: [
          {
            ...productionDraft().reviewCards[0],
            decision: "approved"
          }
        ]
      },
      /must be equal to one of the allowed values/
    );
  });

  it("requires decision metadata for non-pending review cards", () => {
    expectInvalid(
      {
        ...productionDraft(),
        reviewCards: [
          {
            ...productionDraft().reviewCards[0],
            decision: "fits"
          }
        ]
      },
      /needs decidedBy and decidedAt/
    );
  });

  it("rejects approved drafts with unresolved or blocking review cards", () => {
    expectInvalid(
      {
        ...productionDraft(),
        status: "approved",
        approvedBy: "Alexander",
        approvedAt: "2026-07-01T13:00:00.000Z"
      },
      /approved ProductionDraft must have only fits review card decisions/
    );
  });

  it("accepts approved drafts only after all review cards are positively decided", () => {
    const draft: ProductionDraft = {
      ...productionDraft(),
      status: "approved",
      approvedBy: "Alexander",
      approvedAt: "2026-07-01T13:00:00.000Z",
      reviewCards: productionDraft().reviewCards.map((card) => ({
        ...card,
        decision: "fits",
        riskLevel: card.riskLevel === "blocking" ? "high" : card.riskLevel,
        decidedBy: "Alexander",
        decidedAt: "2026-07-01T13:00:00.000Z"
      }))
    };

    expect(validateProductionDraft(draft)).toEqual(draft);
  });
});
