import {
  checkPurchaseCoverage,
  mergeReadiness,
  validateProductionPlan,
  type AcceptedEventSpec,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";

export function isBlockingPlanningIssue(message: string): boolean {
  return /Harte Intake-Restriktion|Harte Menükategorie|Herstellungsentscheidung fehlt|Gerichtsklassifikation fehlt|Zugekaufte Bestandteile.*fehlen|Rezeptzuweisung .* ist ungültig\.|technischer Fehler|Timeout|fehlgeschlagen/i.test(
    message
  );
}

export function summarizeFallbackReason(blockingIssues: string[], warnings: string[]): string {
  return blockingIssues[0] ?? warnings[0] ?? "Die Produktionsplanung musste in einen deterministischen Fallback wechseln.";
}

export function uniquePlanningMessages(messages: string[]): string[] {
  return [...new Set(messages)];
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
  const blockingIssues = uniquePlanningMessages([...(productionPlan.blockingIssues ?? []), ...issues]);
  const unresolvedItems = uniquePlanningMessages([...productionPlan.unresolvedItems, ...issues]);
  const warnings = productionPlan.warnings ?? [];
  const blockingNotes = issues;

  return validateProductionPlan({
    ...productionPlan,
    readiness: mergeReadiness(eventSpec.readiness, unresolvedItems, blockingIssues),
    unresolvedItems,
    componentReadiness: productionPlan.componentReadiness?.map((component) => {
      const componentIssue = issues.find((issue) =>
        issue.includes(`(${component.componentId}/`) || issue.includes(`/${component.componentId}/`)
      );
      if (!componentIssue) {
        return component;
      }

      return {
        ...component,
        status: "blocked" as const,
        reason: componentIssue,
        includedInPurchaseList: false,
        blocksProduction: true
      };
    }),
    kitchenSheets: productionPlan.kitchenSheets.map((sheet) => ({
      ...sheet,
      blockingNotes: uniquePlanningMessages([...(sheet.blockingNotes ?? []), ...blockingNotes])
    })),
    isFallback: true,
    fallbackReason: summarizeFallbackReason(blockingIssues, warnings),
    warnings,
    blockingIssues
  });
}
