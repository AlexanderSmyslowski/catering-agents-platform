import {
  validateAcceptedEventSpec,
  type AcceptedEventSpec,
  type PurchaseItem,
  type ProductionPlan,
  type PurchaseList,
  type Recipe
} from "@catering/shared-core";
import { RecipeDiscoveryService } from "../recipe-discovery/service.js";
import {
  bakerPurchaseComponent,
  bakerPurchaseConstraintConflictReason,
  procurementItemsForComponent
} from "./procurement-rules.js";
import {
  hybridClarificationReason
} from "./production-sheet-builders.js";
import {
  isBlockingPlanningIssue
} from "./planning-readiness.js";
import { buildFinalProductionArtifacts } from "./planning-artifact-finalization.js";
import { createPlanningIssueCollector } from "./planning-issue-collector.js";
import { selectOperationalPlanningArtifacts } from "./planning-operational-artifacts.js";
import { normalizeRecipeResolution } from "./planning-recipe-resolution.js";
import { productionConstraintConflictReason } from "./production-constraint-conflicts.js";
import { buildUnresolvedComponentArtifacts } from "./planning-unresolved-component-artifacts.js";
import { buildResolvedRecipePlanningArtifacts } from "./planning-resolved-recipe-artifacts.js";
import { buildProcurementPlanningArtifacts } from "./planning-procurement-artifacts.js";

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
    const purchasedElements = component.productionDecision?.purchasedElements ?? [];
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

      if (!component.menuCategory) {
        const reason = "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.";
        const artifacts = buildUnresolvedComponentArtifacts({
          component,
          eventSpec,
          servings,
          reason,
          issue: `Klassifikation für ${component.label} fehlt.`,
          timelineLabel: `${component.label} fachlich klären`
        });
        recipeSelections.push(artifacts.selection);
        noteIssue(artifacts.issue, artifacts.blocking);
        kitchenSheets.push(artifacts.kitchenSheet);
        timeline.push(artifacts.timelineItem);
        continue;
      }

      if (!productionMode) {
        const hybridReason = hybridClarificationReason(component);
        const reason =
          hybridReason ??
          "Herstellungsentscheidung fehlt. Bitte Eigenproduktion, Hybrid, Convenience-Zukauf oder Fertigprodukt festlegen.";
        const artifacts = buildUnresolvedComponentArtifacts({
          component,
          eventSpec,
          servings,
          reason,
          issue: hybridReason
            ? `Herstellungsentscheidung für ${component.label} fehlt (Hybridfall Focaccia).`
            : `Herstellungsentscheidung für ${component.label} fehlt.`,
          timelineLabel: hybridReason ? `${component.label} Hybridfall klären` : `${component.label} Herstellungsart klären`
        });
        recipeSelections.push(artifacts.selection);
        noteIssue(artifacts.issue, artifacts.blocking);
        kitchenSheets.push(artifacts.kitchenSheet);
        timeline.push(artifacts.timelineItem);
        continue;
      }

      if ((productionMode === "hybrid" || productionMode === "convenience_purchase") && purchasedElements.length === 0) {
        const reason =
          "Hybrid-/Convenience-Entscheidung ist gesetzt, aber die zugekauften Bestandteile sind noch nicht benannt.";
        const artifacts = buildUnresolvedComponentArtifacts({
          component,
          eventSpec,
          servings,
          reason,
          issue: `Zugekaufte Bestandteile für ${component.label} fehlen.`,
          timelineLabel: `${component.label} Beschaffungsanteil klären`
        });
        recipeSelections.push(artifacts.selection);
        noteIssue(artifacts.issue, artifacts.blocking);
        kitchenSheets.push(artifacts.kitchenSheet);
        timeline.push(artifacts.timelineItem);
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

      const rawResolution = component.recipeOverrideId
        ? await discoveryService.resolveRecipeOverride(component.recipeOverrideId, component)
        : await discoveryService.resolveRecipe(component, eventSpec);
      const resolution = normalizeRecipeResolution(rawResolution, component.label);
      for (const issue of resolution.unresolvedItems) {
        noteIssue(issue, isBlockingPlanningIssue(issue));
      }

      const constraintConflict = productionConstraintConflictReason(
        resolution.recipe,
        eventSpec.productionConstraints
      );
      const selectedRecipe = constraintConflict
        ? {
            ...resolution.selection,
            selectionReason: constraintConflict,
            autoUsedInternetRecipe: false
          }
        : resolution.selection;
      recipeSelections.push(selectedRecipe);
      if (constraintConflict) {
        const artifacts = buildUnresolvedComponentArtifacts({
          component,
          eventSpec,
          servings,
          reason: constraintConflict,
          timelineLabel: `${component.label} Rezeptklärung`
        });
        noteIssue(artifacts.issue, artifacts.blocking);
        kitchenSheets.push(artifacts.kitchenSheet);
        timeline.push(artifacts.timelineItem);
        continue;
      }

      if (!resolution.recipe || servings <= 0) {
        const reason = resolution.selection.selectionReason || "Für diese Komponente wurde noch kein belastbares Rezept gefunden.";
        const artifacts = buildUnresolvedComponentArtifacts({
          component,
          eventSpec,
          servings,
          reason,
          blocking: servings <= 0,
          timelineLabel: `${component.label} Rezeptklärung`
        });
        noteIssue(artifacts.issue, artifacts.blocking);
        kitchenSheets.push(artifacts.kitchenSheet);
        timeline.push(artifacts.timelineItem);
        continue;
      }

      const artifacts = buildResolvedRecipePlanningArtifacts({
        eventSpec,
        component,
        recipe: resolution.recipe as Recipe,
        servings
      });
      productionBatches.push(artifacts.batch);
      kitchenSheets.push(artifacts.kitchenSheet);
      timeline.push(artifacts.timelineItem);
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
