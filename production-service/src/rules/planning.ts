import {
  validateAcceptedEventSpec,
  type AcceptedEventSpec,
  type ProductionPlan,
  type PurchaseList
} from "@catering/shared-core";
import { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import {
  bakerPurchaseComponent,
  bakerPurchaseConstraintConflictReason,
  procurementItemsForComponent
} from "./procurement-rules.js";
import { buildFinalProductionArtifacts } from "./planning-artifact-finalization.js";
import { createPlanningIssueCollector } from "./planning-issue-collector.js";
import { selectOperationalPlanningArtifacts } from "./planning-operational-artifacts.js";
import { buildUnresolvedComponentArtifacts } from "./planning-unresolved-component-artifacts.js";
import { buildProcurementPlanningArtifacts } from "./planning-procurement-artifacts.js";
import { buildComponentReadinessArtifacts } from "./planning-component-readiness-artifacts.js";
import { buildRecipeComponentPlanningArtifacts } from "./planning-recipe-component-artifacts.js";
import {
  appendProcurementPlanningArtifacts,
  appendRecipeComponentPlanningArtifacts,
  appendUnresolvedComponentArtifacts
} from "./planning-artifact-appender.js";
import { planningComponentErrorReason } from "./planning-component-error-reason.js";
import { createPlanningArtifactState } from "./planning-artifact-state.js";

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
    const productionMode = component.productionDecision?.mode;
    const implicitBakerPurchase = productionMode ? undefined : bakerPurchaseComponent(component);

    try {
      if (implicitBakerPurchase) {
        const constraintConflict = bakerPurchaseConstraintConflictReason(
          implicitBakerPurchase,
          eventSpec.productionConstraints
        );
        if (constraintConflict) {
          const artifacts = buildUnresolvedComponentArtifacts({
            component,
            eventSpec,
            servings,
            reason: constraintConflict,
            timelineLabel: `${component.label} Bäcker-Zukauf klären`
          });
          appendUnresolvedComponentArtifacts(artifactAppender, artifacts);
          continue;
        }

        const artifacts = buildProcurementPlanningArtifacts({
          eventSpec,
          component: implicitBakerPurchase,
          servings,
          kind: "baker_purchase"
        });
        appendProcurementPlanningArtifacts(artifactAppender, artifacts);
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

      if (productionMode === "convenience_purchase" || productionMode === "external_finished") {
        const artifacts = buildProcurementPlanningArtifacts({
          eventSpec,
          component,
          servings,
          kind: "component_procurement"
        });
        appendProcurementPlanningArtifacts(artifactAppender, artifacts);
        continue;
      }

      procurementItems.push(...procurementItemsForComponent(component, servings));

      const recipeArtifacts = await buildRecipeComponentPlanningArtifacts({
        eventSpec,
        component,
        servings,
        discoveryService
      });
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
