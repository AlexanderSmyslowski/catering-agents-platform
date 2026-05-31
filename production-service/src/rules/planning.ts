import {
  validateAcceptedEventSpec,
  type AcceptedEventSpec,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";
import { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import { buildFinalProductionArtifacts } from "./planning-artifact-finalization.js";
import { createPlanningIssueCollector } from "./planning-issue-collector.js";
import { selectOperationalPlanningArtifacts } from "./planning-operational-artifacts.js";
import { buildUnresolvedComponentArtifacts } from "./planning-unresolved-component-artifacts.js";
import { appendUnresolvedComponentArtifacts } from "./planning-artifact-appender.js";
import { planningComponentErrorReason } from "./planning-component-error-reason.js";
import { createPlanningArtifactState } from "./planning-artifact-state.js";
import { appendPlanningComponentBranchArtifacts } from "./planning-component-branch.js";

export async function buildProductionArtifacts(
  eventSpecInput: AcceptedEventSpec,
  discoveryService: RecipeDiscoveryService
): Promise<{ productionPlan: ProductionPlan; purchaseList: PurchaseList }> {
  const eventSpec = validateAcceptedEventSpec(eventSpecInput);
  const issueCollector = createPlanningIssueCollector(eventSpec.missingFields);
  const {
    unresolvedItems,
    warnings,
    blockingIssues,
    noteIssue
  } = issueCollector;
  const {
    productionBatches,
    procurementItems,
    kitchenSheets,
    timeline,
    recipeSelections,
    appender: artifactAppender
  } = createPlanningArtifactState(noteIssue);

  for (const component of eventSpec.menuPlan) {
    const servings = component.servings ?? eventSpec.attendees.expected ?? 0;

    try {
      await appendPlanningComponentBranchArtifacts({
        eventSpec,
        component,
        servings,
        discoveryService,
        artifactAppender
      });
    } catch (error) {
      const reason = planningComponentErrorReason(component.label, error);
      const artifacts = buildUnresolvedComponentArtifacts({
        component,
        eventSpec,
        servings,
        reason,
        timelineLabel: `${component.label} Rezeptklärung`
      });
      appendUnresolvedComponentArtifacts(artifactAppender, artifacts);
    }
  }

  const uniqueBlockingIssues = [...new Set(blockingIssues)];
  const operationalArtifacts = selectOperationalPlanningArtifacts(
    {
      productionBatches,
      timeline,
      kitchenSheets,
      procurementItems
    },
    uniqueBlockingIssues
  );

  return buildFinalProductionArtifacts({
    eventSpec,
    readinessIssues: {
      unresolvedItems,
      warnings,
      blockingIssues: uniqueBlockingIssues
    },
    operationalArtifacts,
    recipeSelections,
  });
}
