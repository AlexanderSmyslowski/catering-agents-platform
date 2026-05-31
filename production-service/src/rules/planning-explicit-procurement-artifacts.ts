import type { AcceptedEventSpec } from "@catering/shared-core";
import {
  buildProcurementPlanningArtifacts,
  type ProcurementPlanningArtifacts
} from "./planning-procurement-artifacts.js";

type MenuPlanComponent = AcceptedEventSpec["menuPlan"][number];

export function buildExplicitProcurementPlanningArtifacts(input: {
  eventSpec: AcceptedEventSpec;
  component: MenuPlanComponent;
  servings: number;
}): ProcurementPlanningArtifacts | undefined {
  const {
    eventSpec,
    component,
    servings
  } = input;
  const productionMode = component.productionDecision?.mode;

  if (productionMode !== "convenience_purchase" && productionMode !== "external_finished") {
    return undefined;
  }

  return buildProcurementPlanningArtifacts({
    eventSpec,
    component,
    servings,
    kind: "component_procurement"
  });
}
