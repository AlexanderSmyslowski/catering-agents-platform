export type ImpactLevel = "L1" | "L2" | "L3";
export type Milestone = "ShoppingCompleted" | "ProductionStarted";

export type ThresholdRule =
  | { kind: "ANY_CHANGE" }
  | { kind: "PERCENT_DELTA_GT"; value: number; compareTo: "lastHardApproved" | "previous" }
  | { kind: "ABSOLUTE_DELTA_GT"; value: number; compareTo: "lastHardApproved" | "previous" }
  | { kind: "SEMANTIC_CHANGE" };

export type PointOfNoReturnRule = {
  milestone: Milestone;
  severity: "warn" | "confirm" | "stop";
  prompt: string;
};

export type RuleStage = "active" | "prepared";

export type ChangeRule = {
  key: string;
  stage: RuleStage;
  fieldPaths: string[];
  impactLevel: ImpactLevel;
  threshold: ThresholdRule;
  triggers: string[];
  pointOfNoReturn: PointOfNoReturnRule[];
  semanticLabel: string;
  affectedAggregates: string[];
  repoNote?: string;
};

/*
 * Stufe 2 nutzt nur Feldpfade, die im aktuellen Repo-Bestand sicher anschlussfaehig sind.
 * Regeln mit stage="prepared" referenzieren existierende Repo-Vokabeln, sind aber noch nicht
 * an das heutige AcceptedEventSpec-Modell angehaengt.
 */
export const SPEC_CHANGE_RULES: readonly ChangeRule[] = [
  {
    key: "guest_count",
    stage: "active",
    fieldPaths: ["attendees.expected", "attendees.guaranteed", "attendees.productionPax", "menuPlan.servings"],
    impactLevel: "L3",
    threshold: { kind: "ANY_CHANGE" },
    triggers: ["RecalcShopping", "RecalcProduction", "RefreshShoppingList", "RequireReapproval"],
    pointOfNoReturn: [
      {
        milestone: "ShoppingCompleted",
        severity: "confirm",
        prompt: "Achtung: Einkauf bereits abgeschlossen. Wurde die physische Bestellung korrigiert?"
      },
      {
        milestone: "ProductionStarted",
        severity: "confirm",
        prompt: "Achtung: Produktion bereits gestartet. Wurde die Mengenaenderung operativ abgestimmt?"
      }
    ],
    semanticLabel: "Mengen geaendert",
    affectedAggregates: ["AcceptedEventSpec", "ShoppingList", "ProductionPlan"]
  },
  {
    key: "allergens",
    stage: "active",
    fieldPaths: ["productionConstraints"],
    impactLevel: "L3",
    threshold: { kind: "ANY_CHANGE" },
    triggers: ["WarnKitchen", "RequireReapproval"],
    pointOfNoReturn: [
      {
        milestone: "ShoppingCompleted",
        severity: "warn",
        prompt: "Einschraenkungen oder Allergenlage geaendert. Einkauf und Kennzeichnung pruefen."
      },
      {
        milestone: "ProductionStarted",
        severity: "stop",
        prompt: "Kritisch: Einschraenkungen oder Allergenlage nach Produktionsstart geaendert. Kueche muss sofort bestaetigen."
      }
    ],
    semanticLabel: "Allergen-/Einschraenkungslage geaendert",
    affectedAggregates: ["AcceptedEventSpec", "KitchenBriefing", "MenuLabels"],
    repoNote: "Aktuell haengen allergenrelevante Signale im AcceptedEventSpec vor allem an productionConstraints."
  },
  {
    key: "yield",
    stage: "prepared",
    fieldPaths: ["yieldProfile.yieldFactor", "yieldProfile.wasteFactor", "yieldProfile.trimLossFactor"],
    impactLevel: "L3",
    threshold: { kind: "ANY_CHANGE" },
    triggers: ["RecalcShopping", "RecalcProduction", "RequireReapproval"],
    pointOfNoReturn: [
      {
        milestone: "ShoppingCompleted",
        severity: "confirm",
        prompt: "Achtung: Einkauf bereits abgeschlossen. Wurde die korrigierte Rohwarenmenge nachgezogen?"
      },
      {
        milestone: "ProductionStarted",
        severity: "confirm",
        prompt: "Achtung: Produktion bereits gestartet. Wurde die geaenderte Ausbeute operativ uebernommen?"
      }
    ],
    semanticLabel: "Ausbeute/Verschnitt geaendert",
    affectedAggregates: ["AcceptedEventSpec", "ShoppingList", "ProductionPlan"],
    repoNote: "Yield lebt heute im Repo bereits strukturiert, aber noch nicht direkt am AcceptedEventSpec."
  },
  {
    key: "procurement_units_equivalent",
    stage: "prepared",
    fieldPaths: ["purchasingUnitProfile.unitLabel", "purchasingUnitProfile.unitSize", "purchasingUnitProfile.baseUnit"],
    impactLevel: "L2",
    threshold: { kind: "SEMANTIC_CHANGE" },
    triggers: ["WarnPurchasing"],
    pointOfNoReturn: [],
    semanticLabel: "Gebinde/Bestelleinheit geaendert",
    affectedAggregates: ["AcceptedEventSpec", "ShoppingList"],
    repoNote: "Einkaufseinheiten sind bereits als eigener Fachblock vorhanden, aber noch nicht im AcceptedEventSpec modelliert."
  },
  {
    key: "unit_conversion_with_qty_effect",
    stage: "prepared",
    fieldPaths: ["unitTransform.normalizedQty", "unitTransform.normalizedUnit", "productionToPurchaseRatio"],
    impactLevel: "L3",
    threshold: { kind: "ANY_CHANGE" },
    triggers: ["RecalcShopping", "RefreshShoppingList", "RequireReapproval"],
    pointOfNoReturn: [
      {
        milestone: "ShoppingCompleted",
        severity: "confirm",
        prompt: "Achtung: reale Bestellmenge hat sich geaendert. Wurde die Bestellung korrigiert?"
      }
    ],
    semanticLabel: "Einheitenkonversion mit Mengenwirkung",
    affectedAggregates: ["AcceptedEventSpec", "ShoppingList"],
    repoNote: "Einheitentransformation ist im Repo vorhanden, aber noch nicht direkt spec-seitig gespeichert."
  },
  {
    key: "event_timing",
    stage: "active",
    fieldPaths: [
      "event.date",
      "event.type",
      "event.serviceForm",
      "servicePlan.eventType",
      "servicePlan.serviceForm"
    ],
    impactLevel: "L3",
    threshold: { kind: "ANY_CHANGE" },
    triggers: ["ReplanProduction", "WarnDispatch", "RequireReapproval"],
    pointOfNoReturn: [
      {
        milestone: "ShoppingCompleted",
        severity: "warn",
        prompt: "Zeitfenster geaendert. Einkaufstermine pruefen."
      },
      {
        milestone: "ProductionStarted",
        severity: "confirm",
        prompt: "Achtung: Produktion bereits gestartet. Wurde die Zeitaenderung operativ abgestimmt?"
      }
    ],
    semanticLabel: "Zeitfenster geaendert",
    affectedAggregates: ["AcceptedEventSpec", "ProductionPlan", "DispatchPlan"]
  },
  {
    key: "recipe_swap",
    stage: "active",
    fieldPaths: [
      "menuPlan.label",
      "menuPlan.menuCategory",
      "menuPlan.recipeOverrideId",
      "menuPlan.productionDecision.mode",
      "menuPlan.productionDecision.purchasedElements"
    ],
    impactLevel: "L3",
    threshold: { kind: "ANY_CHANGE" },
    triggers: ["RecalcShopping", "RecalcProduction", "RecheckAllergens", "RequireReapproval"],
    pointOfNoReturn: [
      {
        milestone: "ShoppingCompleted",
        severity: "warn",
        prompt: "Gericht oder Herstellungsart geaendert. Einkauf pruefen."
      },
      {
        milestone: "ProductionStarted",
        severity: "stop",
        prompt: "Kritisch: Gericht oder Herstellungsart nach Produktionsstart geaendert. Kuechenfreigabe erforderlich."
      }
    ],
    semanticLabel: "Gericht/Rezept geaendert",
    affectedAggregates: ["AcceptedEventSpec", "ShoppingList", "ProductionPlan", "MenuLabels"]
  },
  {
    key: "prices",
    stage: "active",
    fieldPaths: ["budgetContext.pricingSummary.subtotal.amount", "budgetContext.pricingSummary.perPerson.amount"],
    impactLevel: "L2",
    threshold: { kind: "PERCENT_DELTA_GT", value: 5, compareTo: "lastHardApproved" },
    triggers: ["WarnSales", "RecalcMargin"],
    pointOfNoReturn: [],
    semanticLabel: "Kalkulation geaendert",
    affectedAggregates: ["AcceptedEventSpec", "Pricing"]
  },
  {
    key: "notes",
    stage: "active",
    fieldPaths: ["assumptions", "menuPlan.productionDecision.notes", "event.style", "event.atmosphere"],
    impactLevel: "L1",
    threshold: { kind: "ANY_CHANGE" },
    triggers: ["LogOnly"],
    pointOfNoReturn: [],
    semanticLabel: "Hinweise/Texte aktualisiert",
    affectedAggregates: ["AcceptedEventSpec"]
  }
] as const;
