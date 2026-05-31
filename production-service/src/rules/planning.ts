import {
  validateAcceptedEventSpec,
  type AcceptedEventSpec,
  type PurchaseItem,
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

export async function buildProductionArtifacts(
  eventSpecInput: AcceptedEventSpec,
  discoveryService: RecipeDiscoveryService
): Promise<{ productionPlan: ProductionPlan; purchaseList: PurchaseList }> {
  const eventSpec = validateAcceptedEventSpec(eventSpecInput);
  const productionBatches: ProductionPlan["productionBatches"] = [];
  const procurementItems: PurchaseItem[] = [];
  const kitchenSheets: ProductionPlan["kitchenSheets"] = [];
  const timeline: ProductionPlan["timeline"] = [];
  const recipeSelections: ProductionPlan["recipeSelections"] = [];
  const issueCollector = createPlanningIssueCollector(eventSpec.missingFields);
  const {
    unresolvedItems,
    warnings,
    blockingIssues,
    noteIssue
  } = issueCollector;

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
          recipeSelections.push(artifacts.selection);
          noteIssue(artifacts.issue, artifacts.blocking);
          kitchenSheets.push(artifacts.kitchenSheet);
          timeline.push(artifacts.timelineItem);
          continue;
        }

        const artifacts = buildProcurementPlanningArtifacts({
          eventSpec,
          component: implicitBakerPurchase,
          servings,
          kind: "baker_purchase"
        });
        procurementItems.push(...artifacts.procurementItems);
        recipeSelections.push(artifacts.selection);
        kitchenSheets.push(artifacts.kitchenSheet);
        timeline.push(artifacts.timelineItem);
        continue;
      }

      const readinessArtifacts = buildComponentReadinessArtifacts({
        component,
        eventSpec,
        servings
      });
      if (readinessArtifacts) {
        recipeSelections.push(readinessArtifacts.selection);
        noteIssue(readinessArtifacts.issue, readinessArtifacts.blocking);
        kitchenSheets.push(readinessArtifacts.kitchenSheet);
        timeline.push(readinessArtifacts.timelineItem);
        continue;
      }

      if (productionMode === "convenience_purchase" || productionMode === "external_finished") {
        const artifacts = buildProcurementPlanningArtifacts({
          eventSpec,
          component,
          servings,
          kind: "component_procurement"
        });
        procurementItems.push(...artifacts.procurementItems);
        recipeSelections.push(artifacts.selection);
        kitchenSheets.push(artifacts.kitchenSheet);
        timeline.push(artifacts.timelineItem);
        continue;
      }

      procurementItems.push(...procurementItemsForComponent(component, servings));

      const recipeArtifacts = await buildRecipeComponentPlanningArtifacts({
        eventSpec,
        component,
        servings,
        discoveryService
      });
      recipeSelections.push(recipeArtifacts.selection);
      for (const issue of recipeArtifacts.issues) {
        noteIssue(issue.issue, issue.blocking);
      }
      kitchenSheets.push(recipeArtifacts.kitchenSheet);
      timeline.push(recipeArtifacts.timelineItem);
      if (recipeArtifacts.kind === "unresolved") {
        continue;
      }

      productionBatches.push(recipeArtifacts.batch);
    } catch (error) {
      const reason = error instanceof Error && error.message.startsWith("Ungültige Planungsantwort")
        ? error.message
        : `Technischer Fehler in der Produktionsplanung für ${component.label}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`;
      const artifacts = buildUnresolvedComponentArtifacts({
        component,
        eventSpec,
        servings,
        reason,
        timelineLabel: `${component.label} Rezeptklärung`
      });
      recipeSelections.push(artifacts.selection);
      noteIssue(artifacts.issue, artifacts.blocking);
      kitchenSheets.push(artifacts.kitchenSheet);
      timeline.push(artifacts.timelineItem);
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
