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
import { buildComponentReadinessArtifacts } from "./planning-component-readiness-artifacts.js";
import {
  appendProcurementPlanningArtifacts,
  appendRecipeComponentPlanningArtifacts,
  appendUnresolvedComponentArtifacts
} from "./planning-artifact-appender.js";
import { planningComponentErrorReason } from "./planning-component-error-reason.js";
import { createPlanningArtifactState } from "./planning-artifact-state.js";
import { buildImplicitBakerPurchasePlanningArtifacts } from "./planning-baker-purchase-artifacts.js";
import { buildExplicitProcurementPlanningArtifacts } from "./planning-explicit-procurement-artifacts.js";
import { buildRecipeBranchPlanningArtifacts } from "./planning-recipe-branch-artifacts.js";

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
      const bakerPurchaseArtifacts = buildImplicitBakerPurchasePlanningArtifacts({
        eventSpec,
        component,
        servings
      });
      if (bakerPurchaseArtifacts?.kind === "unresolved") {
        appendUnresolvedComponentArtifacts(artifactAppender, bakerPurchaseArtifacts.artifacts);
        continue;
      }
      if (bakerPurchaseArtifacts?.kind === "procurement") {
        appendProcurementPlanningArtifacts(artifactAppender, bakerPurchaseArtifacts.artifacts);
        continue;
      }

      const readinessArtifacts = buildComponentReadinessArtifacts({
        component,
        eventSpec,
        servings
      });
      if (readinessArtifacts) {
        appendUnresolvedComponentArtifacts(artifactAppender, readinessArtifacts);
        continue;
      }

      const artifacts = buildExplicitProcurementPlanningArtifacts({
        eventSpec,
        component,
        servings
      });
      if (artifacts) {
        appendProcurementPlanningArtifacts(artifactAppender, artifacts);
        continue;
      }

      const recipeBranchArtifacts = await buildRecipeBranchPlanningArtifacts({
        eventSpec,
        component,
        servings,
        discoveryService
      });
      procurementItems.push(...recipeBranchArtifacts.procurementItems);
      const { recipeArtifacts } = recipeBranchArtifacts;
      appendRecipeComponentPlanningArtifacts(artifactAppender, recipeArtifacts);
      if (recipeArtifacts.kind === "unresolved") {
        continue;
      }
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
