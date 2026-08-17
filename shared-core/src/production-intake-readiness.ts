import type { AcceptedEventSpec, RawInput } from "./types.js";

export type ProductionIntakeRequirementClass =
  | "required_for_quantity_planning"
  | "required_for_production"
  | "commercial_context"
  | "explicit_assumption_allowed";

export type ProductionIntakeRequirementState =
  | "known"
  | "missing"
  | "assumption_applied"
  | "source_verification_required";

export type ProductionIntakeBlockingScope = "quantity_planning" | "production";

export interface ProductionIntakeRequirementFinding {
  fieldKey: string;
  requirementClass: ProductionIntakeRequirementClass;
  state: ProductionIntakeRequirementState;
  reason: string;
  blockingScopes: ProductionIntakeBlockingScope[];
  suggestedClarificationKey?: string;
}

export interface ProductionIntakeReadinessResult {
  status: "clarification_required" | "ready_for_quantity_planning" | "ready_for_production_planning";
  quantityPlanningReady: boolean;
  productionPlanningReady: boolean;
  commercialPlausibilityReady: boolean;
  findings: ProductionIntakeRequirementFinding[];
  blockingFieldKeys: string[];
}

export interface EvaluateProductionIntakeReadinessInput {
  spec: AcceptedEventSpec;
  sourceInputs?: RawInput[];
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function addFinding(
  findings: ProductionIntakeRequirementFinding[],
  finding: ProductionIntakeRequirementFinding
): void {
  findings.push(finding);
}

function sourceId(source: RawInput, index: number): string {
  return nonBlank(source.documentId) ? source.documentId.trim() : `source-${index + 1}`;
}

function relevantDeclaredMissingField(field: string): boolean {
  const normalized = field.trim();
  if (!normalized) return false;
  if (normalized.startsWith("budgetContext")) return false;
  if (["attendees.expected", "attendees.guaranteed", "event.type", "event.title", "menuPlan"].includes(normalized)) {
    return false;
  }
  return true;
}

export function evaluateProductionIntakeReadiness(
  input: EvaluateProductionIntakeReadinessInput
): ProductionIntakeReadinessResult {
  const { spec } = input;
  const findings: ProductionIntakeRequirementFinding[] = [];

  const attendeeCountKnown = positiveFinite(spec.attendees.guaranteed) || positiveFinite(spec.attendees.expected);
  addFinding(findings, {
    fieldKey: "attendees.count",
    requirementClass: "required_for_quantity_planning",
    state: attendeeCountKnown ? "known" : "missing",
    reason: attendeeCountKnown
      ? "Eine positive Personenzahl ist vorhanden."
      : "Für Mengen- und Produktionsplanung fehlt eine positive Personenzahl.",
    blockingScopes: attendeeCountKnown ? [] : ["quantity_planning", "production"],
    ...(!attendeeCountKnown ? { suggestedClarificationKey: "attendees.expected" } : {})
  });

  const eventContextKnown =
    nonBlank(spec.event.type) ||
    nonBlank(spec.event.title) ||
    nonBlank(spec.servicePlan.eventType);
  addFinding(findings, {
    fieldKey: "event.occasion",
    requirementClass: "required_for_quantity_planning",
    state: eventContextKnown ? "known" : "missing",
    reason: eventContextKnown
      ? "Anlass-/Veranstaltungskontext ist vorhanden."
      : "Für eine belastbare Mengenlogik fehlt der Anlass-/Veranstaltungskontext.",
    blockingScopes: eventContextKnown ? [] : ["quantity_planning", "production"],
    ...(!eventContextKnown ? { suggestedClarificationKey: "event.type" } : {})
  });

  const menuKnown = Array.isArray(spec.menuPlan) && spec.menuPlan.length > 0;
  addFinding(findings, {
    fieldKey: "menuPlan",
    requirementClass: "required_for_quantity_planning",
    state: menuKnown ? "known" : "missing",
    reason: menuKnown
      ? "Mindestens eine Speisenkomponente ist vorhanden."
      : "Ohne Speisenkomponenten kann keine Mengen- oder Produktionsplanung beginnen.",
    blockingScopes: menuKnown ? [] : ["quantity_planning", "production"],
    ...(!menuKnown ? { suggestedClarificationKey: "menuPlan" } : {})
  });

  for (const component of spec.menuPlan ?? []) {
    const mode = component.productionDecision?.mode;
    const modeKnown = mode === "scratch" || mode === "hybrid" || mode === "convenience_purchase" || mode === "external_finished";
    addFinding(findings, {
      fieldKey: `menuPlan.${component.componentId}.productionDecision.mode`,
      requirementClass: "required_for_production",
      state: modeKnown ? "known" : "missing",
      reason: modeKnown
        ? `Produktionsweg für ${component.label} ist festgelegt.`
        : `Für ${component.label} fehlt die Entscheidung Eigenproduktion, Hybrid oder Zukauf.`,
      blockingScopes: modeKnown ? [] : ["production"],
      ...(!modeKnown ? { suggestedClarificationKey: `menuPlan.${component.componentId}.productionDecision.mode` } : {})
    });

    if (mode === "hybrid") {
      const purchasedElementsKnown =
        Array.isArray(component.productionDecision?.purchasedElements) &&
        component.productionDecision.purchasedElements.some((element) => nonBlank(element));
      addFinding(findings, {
        fieldKey: `menuPlan.${component.componentId}.productionDecision.purchasedElements`,
        requirementClass: "required_for_production",
        state: purchasedElementsKnown ? "known" : "missing",
        reason: purchasedElementsKnown
          ? `Zugekaufte Hybrid-Komponenten für ${component.label} sind benannt.`
          : `Bei Hybrid-Produktion müssen die zugekauften Bestandteile von ${component.label} benannt sein.`,
        blockingScopes: purchasedElementsKnown ? [] : ["production"],
        ...(!purchasedElementsKnown
          ? { suggestedClarificationKey: `menuPlan.${component.componentId}.productionDecision.purchasedElements` }
          : {})
      });
    }
  }

  (input.sourceInputs ?? []).forEach((source, index) => {
    const status = source.documentIngestion?.status;
    if (status !== "fallback" && status !== "failed") return;
    const id = sourceId(source, index);
    addFinding(findings, {
      fieldKey: `source.${id}.verification`,
      requirementClass: "required_for_quantity_planning",
      state: "source_verification_required",
      reason: "Die Quelle wurde nicht zuverlässig extrahiert und muss vor weiterer Planung geprüft werden.",
      blockingScopes: ["quantity_planning", "production"],
      suggestedClarificationKey: "documentIngestion.status"
    });
  });

  for (const field of spec.missingFields ?? []) {
    if (!relevantDeclaredMissingField(field)) continue;
    addFinding(findings, {
      fieldKey: `declaredMissing.${field.trim()}`,
      requirementClass: "required_for_production",
      state: "missing",
      reason: `Der Event-Spec markiert ${field.trim()} als fehlend.`,
      blockingScopes: ["production"],
      suggestedClarificationKey: field.trim()
    });
  }

  const priceContextKnown = Boolean(spec.budgetContext?.targetBudget || spec.budgetContext?.pricingSummary);
  addFinding(findings, {
    fieldKey: "budgetContext",
    requirementClass: "commercial_context",
    state: priceContextKnown ? "known" : "missing",
    reason: priceContextKnown
      ? "Preis-/Budgetkontext für wirtschaftliche Plausibilisierung ist vorhanden."
      : "Preis-/Budgetkontext fehlt; Produktion bleibt möglich, wirtschaftliche Plausibilisierung ist eingeschränkt.",
    blockingScopes: []
  });

  const portionAssumptionApplied = (spec.assumptions ?? []).some(
    (assumption) => assumption.applied && assumption.code.trim().toLowerCase() === "portion_logic"
  );
  addFinding(findings, {
    fieldKey: "portioning.specialLogic",
    requirementClass: "explicit_assumption_allowed",
    state: portionAssumptionApplied ? "assumption_applied" : "missing",
    reason: portionAssumptionApplied
      ? "Eine explizite Portions-/Mengenlogik-Annahme ist dokumentiert."
      : "Keine besondere Portionslogik ist dokumentiert; der Evaluator erzeugt dafür keine stille Annahme.",
    blockingScopes: []
  });

  const stableFindings = [...findings].sort((left, right) => left.fieldKey.localeCompare(right.fieldKey, "de"));
  const quantityPlanningReady = stableFindings.every(
    (finding) => !finding.blockingScopes.includes("quantity_planning")
  );
  const productionPlanningReady = quantityPlanningReady && stableFindings.every(
    (finding) => !finding.blockingScopes.includes("production")
  );
  const blockingFieldKeys = stableFindings
    .filter((finding) => finding.blockingScopes.length > 0)
    .map((finding) => finding.fieldKey)
    .sort((left, right) => left.localeCompare(right, "de"));

  return {
    status: productionPlanningReady
      ? "ready_for_production_planning"
      : quantityPlanningReady
        ? "ready_for_quantity_planning"
        : "clarification_required",
    quantityPlanningReady,
    productionPlanningReady,
    commercialPlausibilityReady: priceContextKnown,
    findings: stableFindings,
    blockingFieldKeys
  };
}
