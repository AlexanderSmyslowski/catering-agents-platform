import type {
  AcceptedEventSpec,
  ComponentReadiness,
  ProductionPlan,
  PurchaseItem
} from "@catering/shared-core";

type ComponentSource = {
  componentId: string;
  label: string;
};

export type ComponentReadinessGateInput = {
  eventSpec: AcceptedEventSpec;
  productionBatches: ProductionPlan["productionBatches"];
  kitchenSheets: ProductionPlan["kitchenSheets"];
  procurementItems: PurchaseItem[];
  recipeSelections: ProductionPlan["recipeSelections"];
  unresolvedItems: string[];
  blockingIssues: string[];
};

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function sourceFromSheetTitle(sheet: ProductionPlan["kitchenSheets"][number]): ComponentSource {
  const label = sheet.title.split(" - ")[0]?.trim() || sheet.title;
  return {
    componentId: sheet.componentId,
    label
  };
}

function collectComponentSources(input: ComponentReadinessGateInput): ComponentSource[] {
  const sources = new Map<string, ComponentSource>();
  for (const component of input.eventSpec.menuPlan) {
    sources.set(component.componentId, {
      componentId: component.componentId,
      label: component.label
    });
  }
  for (const sheet of input.kitchenSheets) {
    if (!sources.has(sheet.componentId)) {
      sources.set(sheet.componentId, sourceFromSheetTitle(sheet));
    }
  }
  for (const batch of input.productionBatches) {
    if (!sources.has(batch.componentId)) {
      sources.set(batch.componentId, {
        componentId: batch.componentId,
        label: batch.componentId
      });
    }
  }
  for (const selection of input.recipeSelections) {
    if (!sources.has(selection.componentId)) {
      sources.set(selection.componentId, {
        componentId: selection.componentId,
        label: selection.componentId
      });
    }
  }

  return [...sources.values()];
}

function procurementComponentIds(items: PurchaseItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    for (const sourceRecipe of item.sourceRecipes) {
      const match = sourceRecipe.match(/^procurement:(.+)$/);
      if (match?.[1]) {
        ids.add(match[1]);
      }
    }
  }
  return ids;
}

function issueMatchesComponent(
  issue: string,
  component: ComponentSource,
  sheet: ProductionPlan["kitchenSheets"][number] | undefined
): boolean {
  const issueText = normalized(issue);
  const componentId = normalized(component.componentId);
  const label = normalized(component.label);
  const sheetNotes = sheet?.blockingNotes ?? [];

  return (
    issueText.includes(componentId) ||
    issueText.includes(label) ||
    sheetNotes.some((note) => normalized(note) === issueText)
  );
}

function unresolvedReason(
  component: ComponentSource,
  unresolvedItems: string[],
  sheet: ProductionPlan["kitchenSheets"][number] | undefined
): string | undefined {
  const byComponent = unresolvedItems.find((issue) =>
    issueMatchesComponent(issue, component, sheet)
  );
  if (byComponent) {
    return byComponent;
  }

  return sheet?.blockingNotes?.[0];
}

export function buildComponentReadinessGate(
  input: ComponentReadinessGateInput
): ComponentReadiness[] {
  const batchComponentIds = new Set(input.productionBatches.map((batch) => batch.componentId));
  const procurementIds = procurementComponentIds(input.procurementItems);

  return collectComponentSources(input).map((component) => {
    const sheet = input.kitchenSheets.find((candidate) => candidate.componentId === component.componentId);
    const blockingReason = input.blockingIssues.find((issue) =>
      issueMatchesComponent(issue, component, sheet)
    );
    const hasProductionBatch = batchComponentIds.has(component.componentId);
    const includedInPurchaseList = hasProductionBatch || procurementIds.has(component.componentId);
    const hasKitchenSheet = sheet !== undefined;

    if (blockingReason) {
      return {
        componentId: component.componentId,
        label: component.label,
        status: "blocked",
        reason: blockingReason,
        hasProductionBatch,
        hasKitchenSheet,
        includedInPurchaseList: false,
        blocksProduction: true
      };
    }

    if (hasProductionBatch || procurementIds.has(component.componentId)) {
      return {
        componentId: component.componentId,
        label: component.label,
        status: "operational",
        reason: hasProductionBatch
          ? "Produktionsfähige Komponente mit freigegebenem Batch."
          : "Produktionsfähige Komponente als freigegebener Zukauf.",
        hasProductionBatch,
        hasKitchenSheet,
        includedInPurchaseList,
        blocksProduction: false
      };
    }

    return {
      componentId: component.componentId,
      label: component.label,
      status: "needs_clarification",
      reason: unresolvedReason(component, input.unresolvedItems, sheet) ??
        "Keine produktionsfähigen Küchen- oder Einkaufsartefakte vorhanden.",
      hasProductionBatch: false,
      hasKitchenSheet,
      includedInPurchaseList: false,
      blocksProduction: false
    };
  });
}
