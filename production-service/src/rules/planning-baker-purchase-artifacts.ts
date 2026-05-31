import type { AcceptedEventSpec } from "@catering/shared-core";
import {
  bakerPurchaseComponent,
  bakerPurchaseConstraintConflictReason
} from "./procurement-rules.js";
import {
  buildProcurementPlanningArtifacts,
  type ProcurementPlanningArtifacts
} from "./planning-procurement-artifacts.js";
import {
  buildUnresolvedComponentArtifacts,
  type UnresolvedComponentArtifacts
} from "./planning-unresolved-component-artifacts.js";

type MenuPlanComponent = AcceptedEventSpec["menuPlan"][number];

export type BakerPurchasePlanningArtifacts =
  | {
      kind: "procurement";
      artifacts: ProcurementPlanningArtifacts;
    }
  | {
      kind: "unresolved";
      artifacts: UnresolvedComponentArtifacts;
    };

export function buildImplicitBakerPurchasePlanningArtifacts(input: {
  eventSpec: AcceptedEventSpec;
  component: MenuPlanComponent;
  servings: number;
}): BakerPurchasePlanningArtifacts | undefined {
  const {
    eventSpec,
    component,
    servings
  } = input;
  const implicitBakerPurchase = component.productionDecision
    ? undefined
    : bakerPurchaseComponent(component);

  if (!implicitBakerPurchase) {
    return undefined;
  }

  const constraintConflict = bakerPurchaseConstraintConflictReason(
    implicitBakerPurchase,
    eventSpec.productionConstraints
  );
  if (constraintConflict) {
    return {
      kind: "unresolved",
      artifacts: buildUnresolvedComponentArtifacts({
        component,
        eventSpec,
        servings,
        reason: constraintConflict,
        timelineLabel: `${component.label} Bäcker-Zukauf klären`
      })
    };
  }

  return {
    kind: "procurement",
    artifacts: buildProcurementPlanningArtifacts({
      eventSpec,
      component: implicitBakerPurchase,
      servings,
      kind: "baker_purchase"
    })
  };
}
