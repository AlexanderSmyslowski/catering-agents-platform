import type {
  AcceptedEventSpec,
  MenuComponent,
  ProductionPlan
} from "@catering/shared-core";
import {
  prepWindowFor,
  unresolvedKitchenSheet
} from "./production-sheet-builders.js";

export type UnresolvedComponentArtifacts = {
  selection: ProductionPlan["recipeSelections"][number];
  kitchenSheet: ProductionPlan["kitchenSheets"][number];
  timelineItem: ProductionPlan["timeline"][number];
  issue: string;
  blocking: boolean;
};

export type UnresolvedComponentArtifactsInput = {
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  servings: number;
  reason: string;
  timelineLabel: string;
  issue?: string;
  blocking?: boolean;
};

export function buildUnresolvedComponentArtifacts({
  component,
  eventSpec,
  servings,
  reason,
  timelineLabel,
  issue = reason,
  blocking = true
}: UnresolvedComponentArtifactsInput): UnresolvedComponentArtifacts {
  return {
    selection: {
      componentId: component.componentId,
      selectionReason: reason,
      autoUsedInternetRecipe: false
    },
    kitchenSheet: unresolvedKitchenSheet(component, servings, reason, eventSpec),
    timelineItem: {
      label: timelineLabel,
      at: prepWindowFor(eventSpec)
    },
    issue,
    blocking
  };
}
