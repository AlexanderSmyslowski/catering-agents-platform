import {
  hasMinimalMvpCapability,
  type TrustedActor
} from "./access-control.js";
import type { AcceptedEventSpec } from "./types.js";

export interface AcceptedEventSpecProjectionOptions {
  includeTargetBudgetForNonCommercial?: boolean;
}

/**
 * Commercial fields remain part of the canonical persisted specification.
 * This projection is only for API responses to actors without that capability.
 */
export function canReadAcceptedEventSpecCommercials(actor: TrustedActor): boolean {
  return hasMinimalMvpCapability(actor, "commercial");
}

export function projectAcceptedEventSpecForActor(
  actor: TrustedActor,
  eventSpec: AcceptedEventSpec,
  options: AcceptedEventSpecProjectionOptions = {}
): AcceptedEventSpec {
  const snapshot = structuredClone(eventSpec);
  if (canReadAcceptedEventSpecCommercials(actor)) return snapshot;

  const { budgetContext, ...withoutBudgetContext } = snapshot;
  const targetBudget = options.includeTargetBudgetForNonCommercial
    ? budgetContext?.targetBudget
    : undefined;
  return {
    ...withoutBudgetContext,
    ...(targetBudget ? { budgetContext: { targetBudget } } : {}),
    servicePlan: {
      ...withoutBudgetContext.servicePlan,
      modules: withoutBudgetContext.servicePlan.modules.map(({ pricing: _pricing, ...module }) => module)
    }
  };
}
