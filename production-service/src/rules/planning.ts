import {
  aggregatePurchaseList,
  mergeReadiness,
  SCHEMA_VERSION,
  toProductionBatch,
  validateAcceptedEventSpec,
  validateProductionPlan,
  validatePurchaseList,
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
import {
  gnPlanFor,
  hybridClarificationReason,
  prepWindowFor,
  procurementKitchenSheet,
  purchasedElementsSummary,
  stationFor,
  unresolvedKitchenSheet
} from "./production-sheet-builders.js";
import {
  isBlockingPlanningIssue,
  purchaseCoverageBlockingIssues,
  summarizeFallbackReason,
  withPurchaseCoverageBlockingIssues
} from "./planning-readiness.js";
import { createPlanningIssueCollector } from "./planning-issue-collector.js";
import { normalizeRecipeResolution } from "./planning-recipe-resolution.js";
import { productionConstraintConflictReason } from "./production-constraint-conflicts.js";

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
          recipeSelections.push({
            componentId: component.componentId,
            selectionReason: constraintConflict,
            autoUsedInternetRecipe: false
          });
          noteIssue(constraintConflict, true);
          kitchenSheets.push(unresolvedKitchenSheet(component, servings, constraintConflict, eventSpec));
          timeline.push({
            label: `${component.label} Bäcker-Zukauf klären`,
            at: prepWindowFor(eventSpec)
          });
          continue;
        }

        procurementItems.push(...procurementItemsForComponent(implicitBakerPurchase, servings));
        recipeSelections.push({
          componentId: component.componentId,
          selectionReason:
            "Brot/Baguette ist als klarer Bäcker-Zukauf markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen.",
          autoUsedInternetRecipe: false
        });
        kitchenSheets.push(procurementKitchenSheet(implicitBakerPurchase, servings, eventSpec));
        timeline.push({
          label: `${component.label} beim Bäcker beschaffen`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      if (!component.menuCategory) {
        const reason = "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.";
        recipeSelections.push({
          componentId: component.componentId,
          selectionReason: reason,
          autoUsedInternetRecipe: false
        });
        noteIssue(`Klassifikation für ${component.label} fehlt.`, true);
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason, eventSpec));
        timeline.push({
          label: `${component.label} fachlich klären`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      if (!productionMode) {
        const hybridReason = hybridClarificationReason(component);
        const reason =
          hybridReason ??
          "Herstellungsentscheidung fehlt. Bitte Eigenproduktion, Hybrid, Convenience-Zukauf oder Fertigprodukt festlegen.";
        recipeSelections.push({
          componentId: component.componentId,
          selectionReason: reason,
          autoUsedInternetRecipe: false
        });
        noteIssue(
          hybridReason
            ? `Herstellungsentscheidung für ${component.label} fehlt (Hybridfall Focaccia).`
            : `Herstellungsentscheidung für ${component.label} fehlt.`,
          true
        );
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason, eventSpec));
        timeline.push({
          label: hybridReason ? `${component.label} Hybridfall klären` : `${component.label} Herstellungsart klären`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      if ((productionMode === "hybrid" || productionMode === "convenience_purchase") && purchasedElements.length === 0) {
        const reason =
          "Hybrid-/Convenience-Entscheidung ist gesetzt, aber die zugekauften Bestandteile sind noch nicht benannt.";
        recipeSelections.push({
          componentId: component.componentId,
          selectionReason: reason,
          autoUsedInternetRecipe: false
        });
        noteIssue(`Zugekaufte Bestandteile für ${component.label} fehlen.`, true);
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason, eventSpec));
        timeline.push({
          label: `${component.label} Beschaffungsanteil klären`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      if (productionMode === "convenience_purchase" || productionMode === "external_finished") {
        procurementItems.push(...procurementItemsForComponent(component, servings));
        recipeSelections.push({
          componentId: component.componentId,
          selectionReason:
            productionMode === "convenience_purchase"
              ? "Komponente ist als Convenience-Zukauf markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen."
              : "Komponente ist als Fertigprodukt markiert und wurde als Beschaffungsposition in die Einkaufsliste übernommen.",
          autoUsedInternetRecipe: false
        });
        kitchenSheets.push(procurementKitchenSheet(component, servings, eventSpec));
        timeline.push({
          label:
            productionMode === "convenience_purchase"
              ? `${component.label} beschaffen`
              : `${component.label} extern disponieren`,
          at: prepWindowFor(eventSpec)
        });
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
        noteIssue(constraintConflict, true);
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, constraintConflict, eventSpec));
        timeline.push({
          label: `${component.label} Rezeptklärung`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      if (!resolution.recipe || servings <= 0) {
        const reason = resolution.selection.selectionReason || "Für diese Komponente wurde noch kein belastbares Rezept gefunden.";
        noteIssue(reason, servings <= 0);
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason, eventSpec));
        timeline.push({
          label: `${component.label} Rezeptklärung`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      const resolvedRecipe = resolution.recipe as {
        recipeId: string;
        name: string;
        allergens?: string[];
        dietTags?: string[];
      };
      const draftBatch = toProductionBatch(resolution.recipe as any, component.componentId, servings);
      const batchId = `batch-${eventSpec.specId}-${component.componentId}`;
      const batch = {
        batchId,
        ...draftBatch,
        station: stationFor(component.label),
        prepWindow: prepWindowFor(eventSpec),
        gnPlan: gnPlanFor(servings)
      };
      const procurementNotes = productionMode === "hybrid"
        ? [`Zukaufteil separat disponieren: ${purchasedElementsSummary(component)}.`]
        : [];

      productionBatches.push(batch);
      kitchenSheets.push({
        title: `${component.label} - ${resolvedRecipe.name}`,
        componentId: component.componentId,
        recipeId: resolvedRecipe.recipeId,
        productionQty: batch.scaledYield,
        station: batch.station,
        prepWindow: batch.prepWindow,
        ingredients: batch.ingredients,
        steps: batch.steps,
        allergens: resolvedRecipe.allergens ?? [],
        dietTags: resolvedRecipe.dietTags ?? [],
        gnPlan: batch.gnPlan,
        ...(procurementNotes.length > 0 ? { procurementNotes } : {}),
        instructions: [
          ...batch.steps.map((step) => `${step.index}. ${step.instruction}`),
          ...procurementNotes
        ]
      });
      timeline.push({
        label: `${component.label} vorbereiten`,
        at: batch.prepWindow
      });
    } catch (error) {
      const reason = error instanceof Error && error.message.startsWith("Ungültige Planungsantwort")
        ? error.message
        : `Technischer Fehler in der Produktionsplanung für ${component.label}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`;
      recipeSelections.push({
        componentId: component.componentId,
        selectionReason: reason,
        autoUsedInternetRecipe: false
      });
      noteIssue(reason, true);
      kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason, eventSpec));
      timeline.push({
        label: `${component.label} Rezeptklärung`,
        at: prepWindowFor(eventSpec)
      });
    }
  }

  const readiness = mergeReadiness(eventSpec.readiness, unresolvedItems, blockingIssues);
  const uniqueWarnings = [...new Set(warnings)];
  const uniqueBlockingIssues = [...new Set(blockingIssues)];
  const hasBlockingIssues = uniqueBlockingIssues.length > 0;
  const operationalProductionBatches = hasBlockingIssues ? [] : productionBatches;
  const operationalTimeline = hasBlockingIssues ? [] : timeline;
  const operationalKitchenSheets = hasBlockingIssues
    ? kitchenSheets.filter((sheet) => (sheet.blockingNotes?.length ?? 0) > 0)
    : kitchenSheets;
  const operationalProcurementItems = hasBlockingIssues ? [] : procurementItems;
  const productionPlan = validateProductionPlan({
    schemaVersion: SCHEMA_VERSION,
    planId: `plan-${eventSpec.specId}`,
    eventSpecId: eventSpec.specId,
    readiness,
    productionBatches: operationalProductionBatches,
    timeline: operationalTimeline,
    kitchenSheets: operationalKitchenSheets,
    recipeSelections,
    unresolvedItems: [...new Set(unresolvedItems)],
    ...(uniqueWarnings.length > 0 || uniqueBlockingIssues.length > 0
      ? {
          isFallback: true,
          fallbackReason: summarizeFallbackReason(uniqueBlockingIssues, uniqueWarnings),
          warnings: uniqueWarnings,
          blockingIssues: uniqueBlockingIssues
        }
      : {})
  });

  const purchaseList = validatePurchaseList(
    aggregatePurchaseList(eventSpec.specId, operationalProductionBatches, operationalProcurementItems)
  );
  const purchaseCoverageIssues = purchaseCoverageBlockingIssues(productionPlan, purchaseList);

  return {
    productionPlan: purchaseCoverageIssues.length > 0
      ? withPurchaseCoverageBlockingIssues(eventSpec, productionPlan, purchaseCoverageIssues)
      : productionPlan,
    purchaseList
  };
}
