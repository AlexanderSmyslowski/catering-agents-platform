import type { ClassifiedChangeItem } from "./impact-classifier.js";

export type PersistedApprovalStatus = "approved" | "pending_reapproval" | "rejected";
export type PersistedMilestone = "shopping_completed" | "production_started";
export type PersistedSeverity = "warn" | "confirm" | "stop";

export interface ApprovalTriggerResult {
  newApprovalStatus: PersistedApprovalStatus;
  requiredConfirmations: Array<{
    milestone: PersistedMilestone;
    severity: PersistedSeverity;
    prompt: string;
  }>;
  warnings: string[];
  blockingErrors: string[];
}

function toPersistedMilestone(
  value: "ShoppingCompleted" | "ProductionStarted"
): PersistedMilestone {
  return value === "ShoppingCompleted" ? "shopping_completed" : "production_started";
}

export function applyApprovalTrigger(input: {
  currentApprovalStatus: PersistedApprovalStatus;
  items: ClassifiedChangeItem[];
}): ApprovalTriggerResult {
  const result: ApprovalTriggerResult = {
    newApprovalStatus: input.currentApprovalStatus,
    requiredConfirmations: [],
    warnings: [],
    blockingErrors: []
  };

  for (const item of input.items) {
    for (const pointOfNoReturn of item.pointOfNoReturnResults) {
      if (!pointOfNoReturn.active) {
        continue;
      }

      if (pointOfNoReturn.severity === "warn") {
        result.warnings.push(pointOfNoReturn.prompt);
        continue;
      }

      result.requiredConfirmations.push({
        milestone: toPersistedMilestone(pointOfNoReturn.milestone),
        severity: pointOfNoReturn.severity,
        prompt: pointOfNoReturn.prompt
      });

      if (pointOfNoReturn.severity === "stop") {
        result.blockingErrors.push(pointOfNoReturn.prompt);
      }
    }
  }

  if (input.items.some((item) => item.impactLevel === "L3")) {
    result.newApprovalStatus = "pending_reapproval";
  }

  return result;
}
