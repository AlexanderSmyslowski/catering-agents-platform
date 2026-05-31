import { isBlockingPlanningIssue } from "./planning-readiness.js";

export type PlanningIssueCollector = {
  readonly unresolvedItems: string[];
  readonly warnings: string[];
  readonly blockingIssues: string[];
  noteIssue: (message: string, blocking?: boolean) => void;
};

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

export function createPlanningIssueCollector(
  initialUnresolvedItems: string[] = []
): PlanningIssueCollector {
  const unresolvedItems = [...initialUnresolvedItems];
  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  return {
    unresolvedItems,
    warnings,
    blockingIssues,
    noteIssue(message, blocking = isBlockingPlanningIssue(message)) {
      pushUnique(unresolvedItems, message);
      if (blocking) {
        pushUnique(blockingIssues, message);
        return;
      }

      pushUnique(warnings, message);
    }
  };
}
