import type {
  AcceptedEventSpec,
  ProductionPlan,
  PurchaseItem
} from "@catering/shared-core";
import { procurementItemsForComponent } from "./procurement-rules.js";
import {
  prepWindowFor,
  procurementKitchenSheet
} from "./production-sheet-builders.js";

type MenuPlanComponent = AcceptedEventSpec["menuPlan"][number];

export type ProcurementPlanningKind = "baker_purchase" | "component_procurement";

export type ProcurementPlanningArtifacts = {
  procurementItems: PurchaseItem[];
  selection: ProductionPlan["recipeSelections"][number];
  kitchenSheet: ProductionPlan["kitchenSheets"][number];
  timelineItem: ProductionPlan["timeline"][number];
};

function selectionReasonFor(component: MenuPlanComponent, kind: ProcurementPlanningKind): string {
  if (kind === "baker_purchase") {
    return "Brot/Baguette ist als klarer Bäcker-Zukauf markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen.";
  }

  return component.productionDecision?.mode === "convenience_purchase"
    ? "Komponente ist als Convenience-Zukauf markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen."
    : "Komponente ist als Fertigprodukt markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen.";
}

function timelineLabelFor(component: MenuPlanComponent, kind: ProcurementPlanningKind): string {
  if (kind === "baker_purchase") {
    return `${component.label} beim Bäcker beschaffen`;
  }

  return component.productionDecision?.mode === "convenience_purchase"
    ? `${component.label} beschaffen`
    : `${component.label} extern disponieren`;
}

export function buildProcurementPlanningArtifacts(input: {
  eventSpec: AcceptedEventSpec;
  component: MenuPlanComponent;
  servings: number;
  kind: ProcurementPlanningKind;
}): ProcurementPlanningArtifacts {
  const {
    eventSpec,
    component,
    servings,
    kind
  } = input;

  return {
    procurementItems: procurementItemsForComponent(component, servings),
    selection: {
      componentId: component.componentId,
      selectionReason: selectionReasonFor(component, kind),
      autoUsedInternetRecipe: false
    },
    kitchenSheet: procurementKitchenSheet(component, servings, eventSpec),
    timelineItem: {
      label: timelineLabelFor(component, kind),
      at: prepWindowFor(eventSpec)
    }
  };
}
