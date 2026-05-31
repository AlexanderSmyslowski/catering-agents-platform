import {
  checkPurchaseCoverage,
  mergeReadiness,
  validateProductionPlan,
  type AcceptedEventSpec,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";

export function isBlockingPlanningIssue(message: string): boolean {
  return /Harte Intake-Restriktion|Herstellungsentscheidung fehlt|Gerichtsklassifikation fehlt|Zugekaufte Bestandteile.*fehlen|Rezeptzuweisung .* ist ungültig\.|technischer Fehler|Timeout|fehlgeschlagen/i.test(
    message
  );
}

export function summarizeFallbackReason(blockingIssues: string[], warnings: string[]): string {
  return blockingIssues[0] ?? warnings[0] ?? "Die Produktionsplanung musste in einen deterministischen Fallback wechseln.";
}

export function purchaseCoverageBlockingIssues(
  productionPlan: ProductionPlan,
  purchaseList: PurchaseList
): string[] {
  const coverageCheck = checkPurchaseCoverage(productionPlan, purchaseList);
  if (coverageCheck.status === "passed") {
    return [];
  }

  return [
    `Einkaufsabdeckung fehlt für produktionsrelevante Zutaten: ${coverageCheck.missingIngredients
      .map((ingredient) => `${ingredient.name} (${ingredient.componentId}/${ingredient.recipeId}/${ingredient.batchId})`)
      .join(", ")}.`
  ];
}

export function withPurchaseCoverageBlockingIssues(
  eventSpec: AcceptedEventSpec,
  productionPlan: ProductionPlan,
  issues: string[]
): ProductionPlan {
  const blockingIssues = [...new Set([...(productionPlan.blockingIssues ?? []), ...issues])];
  const unresolvedItems = [...new Set([...productionPlan.unresolvedItems, ...issues])];
  const warnings = productionPlan.warnings ?? [];
  const blockingNotes = issues;

  return validateProductionPlan({
    ...productionPlan,
    readiness: mergeReadiness(eventSpec.readiness, unresolvedItems, blockingIssues),
    unresolvedItems,
    kitchenSheets: productionPlan.kitchenSheets.map((sheet) => ({
      ...sheet,
      blockingNotes: [...new Set([...(sheet.blockingNotes ?? []), ...blockingNotes])]
    })),
    isFallback: true,
    fallbackReason: summarizeFallbackReason(blockingIssues, warnings),
    warnings,
    blockingIssues
  });
}
