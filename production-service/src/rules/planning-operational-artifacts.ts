import type {
  ProductionPlan,
  PurchaseItem
} from "@catering/shared-core";

export type PlanningArtifactDraft = {
  productionBatches: ProductionPlan["productionBatches"];
  timeline: ProductionPlan["timeline"];
  kitchenSheets: ProductionPlan["kitchenSheets"];
  procurementItems: PurchaseItem[];
};

export type OperationalPlanningArtifacts = PlanningArtifactDraft;

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function blockedComponentIds(
  kitchenSheets: PlanningArtifactDraft["kitchenSheets"],
  blockingIssues: string[]
): Set<string> {
  const normalizedBlockingIssues = blockingIssues.map(normalized);
  return new Set(
    kitchenSheets
      .filter((sheet) =>
        (sheet.blockingNotes ?? []).some((note) =>
          normalizedBlockingIssues.includes(normalized(note))
        )
      )
      .map((sheet) => sheet.componentId)
  );
}

function procurementItemBelongsToBlockedComponent(
  item: PurchaseItem,
  blockedIds: Set<string>
): boolean {
  return (item.sourceRecipes ?? []).some((sourceRecipe) => {
    const match = sourceRecipe.match(/^procurement:(.+)$/);
    return match?.[1] ? blockedIds.has(match[1]) : false;
  });
}

export function selectOperationalPlanningArtifacts(
  draft: PlanningArtifactDraft,
  blockingIssues: string[]
): OperationalPlanningArtifacts {
  if (blockingIssues.length === 0) {
    return draft;
  }

  const blockedIds = blockedComponentIds(draft.kitchenSheets, blockingIssues);

  return {
    productionBatches: draft.productionBatches.filter((batch) => !blockedIds.has(batch.componentId)),
    timeline: [],
    kitchenSheets: draft.kitchenSheets,
    procurementItems: draft.procurementItems.filter((item) =>
      !procurementItemBelongsToBlockedComponent(item, blockedIds)
    )
  };
}
