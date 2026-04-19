import {
  aggregatePurchaseList,
  mergeReadiness,
  procurementGroupFor,
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

function stationFor(label: string): string {
  if (/salat|dessert/i.test(label)) {
    return "cold-kitchen";
  }

  if (/kaffee|tee/i.test(label)) {
    return "beverage-station";
  }

  return "hot-kitchen";
}

function prepWindowFor(spec: AcceptedEventSpec): string {
  return spec.event.date
    ? `${spec.event.date} T-1`
    : "Zeitfenster offen, Produktionsvorlauf bitte manuell prüfen";
}

function gnPlanFor(servings: number): { container: string; count: number }[] {
  return [
    {
      container: servings > 40 ? "GN 1/1" : "GN 1/2",
      count: Math.max(1, Math.ceil(servings / 20))
    }
  ];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function procurementItemsForComponent(
  component: AcceptedEventSpec["menuPlan"][number],
  servings: number
): PurchaseItem[] {
  const productionMode = component.productionDecision?.mode;
  const purchasedElements = component.productionDecision?.purchasedElements ?? [];

  if (productionMode === "hybrid") {
    return purchasedElements.map((element, index) => ({
      ingredientId: `proc-${slugify(component.componentId)}-${slugify(element)}-${index + 1}`,
      displayName: `${element} für ${component.label}`,
      normalizedQty: servings,
      normalizedUnit: "portion",
      purchaseQty: servings,
      purchaseUnit: "portion",
      group: procurementGroupFor(element),
      supplierHint: "Metro Convenience",
      sourceRecipes: [`procurement:${component.componentId}`],
      mappingConfidence: 0.7
    }));
  }

  if (productionMode === "convenience_purchase") {
    return purchasedElements.map((element, index) => ({
      ingredientId: `proc-${slugify(component.componentId)}-${slugify(element)}-${index + 1}`,
      displayName: `${element} für ${component.label}`,
      normalizedQty: servings,
      normalizedUnit: "portion",
      purchaseQty: servings,
      purchaseUnit: "portion",
      group: procurementGroupFor(element),
      supplierHint: "Metro Convenience",
      sourceRecipes: [`procurement:${component.componentId}`],
      mappingConfidence: 0.7
    }));
  }

  if (productionMode === "external_finished") {
    return [
      {
        ingredientId: `proc-${slugify(component.componentId)}-finished`,
        displayName: component.label,
        normalizedQty: servings,
        normalizedUnit: "portion",
        purchaseQty: servings,
        purchaseUnit: "portion",
        group: procurementGroupFor(component.label),
        supplierHint: "Metro / externer Lieferant",
        sourceRecipes: [`procurement:${component.componentId}`],
        mappingConfidence: 0.65
      }
    ];
  }

  return [];
}

function purchasedElementsSummary(component: AcceptedEventSpec["menuPlan"][number]): string {
  const purchasedElements = component.productionDecision?.purchasedElements ?? [];
  return purchasedElements.length > 0 ? purchasedElements.join(", ") : "noch offen";
}

function procurementKitchenSheet(
  component: AcceptedEventSpec["menuPlan"][number],
  servings: number
): ProductionPlan["kitchenSheets"][number] {
  const mode = component.productionDecision?.mode;
  const modeLabel =
    mode === "convenience_purchase"
      ? "Convenience-Zukauf"
      : mode === "external_finished"
        ? "Fertigprodukt / externer Bezug"
        : "Beschaffung";

  return {
    title: `${component.label} - ${modeLabel}`,
    instructions: [
      `Menge einplanen: ${servings} Portionen.`,
      `Beschaffung laut Herstellungsart: ${modeLabel}.`,
      `Zugekaufte Bestandteile: ${purchasedElementsSummary(component)}.`,
      "Lieferquelle und Gebinde vor Bestellung kurz prüfen.",
      "Komponente vor Service optisch und mengenmäßig gegen das Angebot prüfen."
    ]
  };
}

function unresolvedKitchenSheet(
  component: AcceptedEventSpec["menuPlan"][number],
  servings: number,
  reason: string
): ProductionPlan["kitchenSheets"][number] {
  return {
    title: `${component.label} - Rezeptklärung nötig`,
    instructions: [
      `Aktuell geplant für ${servings} Portionen.`,
      reason,
      "Für diese Komponente liegt derzeit noch kein belastbares Rezept vor.",
      "Bitte Bibliotheksrezept zuweisen, neues Rezept hochladen oder Herstellungsart auf Beschaffung umstellen.",
      "Danach die Produktionsplanung erneut starten."
    ]
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBlockingPlanningIssue(message: string): boolean {
  return /Harte Intake-Restriktion|Herstellungsentscheidung fehlt|Gerichtsklassifikation fehlt|Zugekaufte Bestandteile.*fehlen|Rezeptzuweisung .* ist ungültig\.|technischer Fehler|Timeout|fehlgeschlagen/i.test(
    message
  );
}

function summarizeFallbackReason(blockingIssues: string[], warnings: string[]): string {
  return blockingIssues[0] ?? warnings[0] ?? "Die Produktionsplanung musste in einen deterministischen Fallback wechseln.";
}

function normalizeRecipeResolution(
  resolution: unknown,
  componentLabel: string
): {
  recipe?: unknown;
  selection: ProductionPlan["recipeSelections"][number];
  unresolvedItems: string[];
} {
  if (!isPlainObject(resolution)) {
    throw new Error(`Ungültige Planungsantwort für ${componentLabel}.`);
  }

  const { recipe, selection, unresolvedItems } = resolution as {
    recipe?: unknown;
    selection?: unknown;
    unresolvedItems?: unknown;
  };

  if (
    !isPlainObject(selection) ||
    typeof selection.componentId !== "string" ||
    typeof selection.selectionReason !== "string" ||
    typeof selection.autoUsedInternetRecipe !== "boolean" ||
    !Array.isArray(unresolvedItems) ||
    unresolvedItems.some((issue) => typeof issue !== "string")
  ) {
    throw new Error(`Ungültige Planungsantwort für ${componentLabel}.`);
  }

  return {
    recipe,
    selection: selection as unknown as ProductionPlan["recipeSelections"][number],
    unresolvedItems: unresolvedItems as string[]
  };
}

function productionConstraintConflictReason(
  recipe: unknown,
  productionConstraints?: string[]
): string | undefined {
  if (!isPlainObject(recipe) || !Array.isArray(productionConstraints) || productionConstraints.length === 0) {
    return undefined;
  }

  const name = typeof recipe.name === "string" ? recipe.name : "";
  const dietTags = Array.isArray(recipe.dietTags)
    ? recipe.dietTags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const ingredientNames = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .flatMap((ingredient) => {
          if (!isPlainObject(ingredient) || typeof ingredient.name !== "string") {
            return [];
          }

          return [ingredient.name];
        })
        .join(" ")
    : "";
  const haystack = `${name} ${dietTags.join(" ")} ${ingredientNames}`.toLowerCase();

  if (productionConstraints.includes("gluten_free") && /\b(brot|weizen|weissmehl|weizenmehl|mehl|gluten|baguette|pasta|nudel|spaghetti|toast|roggen|dinkel|seitan)\b/i.test(haystack)) {
    return `Harte Intake-Restriktion gluten_free blockiert die Rezeptwahl für ${name || "diese Komponente"}.`;
  }

  if (productionConstraints.includes("vegan") && /\b(milch|sahne|butter|ei|eier|joghurt|käse|kaese|quark|honig|gelatine|gelatin|parmesan|mozzarella|feta|gouda|brie|camembert|garnel|garnele|garnelen|shrimp|prawn|fish|lachs|schinken|speck|huhn|rind|kalb|puten|thunfisch)\b/i.test(haystack)) {
    return `Harte Intake-Restriktion vegan blockiert die Rezeptwahl für ${name || "diese Komponente"}.`;
  }

  if (productionConstraints.includes("vegetarian") && /\b(chicken|beef|pork|ham|bacon|sausage|salami|fish|lachs|schinken|speck|huhn|rind|kalb|puten|thunfisch|garnel|garnele|garnelen|shrimp|prawn|scampi)\b/i.test(haystack)) {
    return `Harte Intake-Restriktion vegetarian blockiert die Rezeptwahl für ${name || "diese Komponente"}.`;
  }

  return undefined;
}

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
  const unresolvedItems: string[] = [...(eventSpec.missingFields ?? [])];
  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  const pushUnique = (values: string[], value: string) => {
    if (!values.includes(value)) {
      values.push(value);
    }
  };

  const noteIssue = (message: string, blocking = isBlockingPlanningIssue(message)) => {
    pushUnique(unresolvedItems, message);
    if (blocking) {
      pushUnique(blockingIssues, message);
      return;
    }

    pushUnique(warnings, message);
  };

  for (const component of eventSpec.menuPlan) {
    const servings = component.servings ?? eventSpec.attendees.expected ?? 0;
    const productionMode = component.productionDecision?.mode;
    const purchasedElements = component.productionDecision?.purchasedElements ?? [];

    try {
      if (!component.menuCategory) {
        const reason = "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.";
        recipeSelections.push({
          componentId: component.componentId,
          selectionReason: reason,
          autoUsedInternetRecipe: false
        });
        noteIssue(`Klassifikation für ${component.label} fehlt.`, true);
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason));
        timeline.push({
          label: `${component.label} fachlich klären`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      if (!productionMode) {
        const reason =
          "Herstellungsentscheidung fehlt. Bitte Eigenproduktion, Hybrid, Convenience-Zukauf oder Fertigprodukt festlegen.";
        recipeSelections.push({
          componentId: component.componentId,
          selectionReason: reason,
          autoUsedInternetRecipe: false
        });
        noteIssue(`Herstellungsentscheidung für ${component.label} fehlt.`, true);
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason));
        timeline.push({
          label: `${component.label} Herstellungsart klären`,
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
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason));
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
        kitchenSheets.push(procurementKitchenSheet(component, servings));
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
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, constraintConflict));
        timeline.push({
          label: `${component.label} Rezeptklärung`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      if (!resolution.recipe || servings <= 0) {
        const reason = resolution.selection.selectionReason || "Für diese Komponente wurde noch kein belastbares Rezept gefunden.";
        noteIssue(reason, servings <= 0);
        kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason));
        timeline.push({
          label: `${component.label} Rezeptklärung`,
          at: prepWindowFor(eventSpec)
        });
        continue;
      }

      const resolvedRecipe = resolution.recipe as { name: string };
      const draftBatch = toProductionBatch(resolution.recipe as any, component.componentId, servings);
      const batchId = `batch-${eventSpec.specId}-${component.componentId}`;
      const batch = {
        batchId,
        ...draftBatch,
        station: stationFor(component.label),
        prepWindow: prepWindowFor(eventSpec),
        gnPlan: gnPlanFor(servings)
      };

      productionBatches.push(batch);
      kitchenSheets.push({
        title: `${component.label} - ${resolvedRecipe.name}`,
        instructions: [
          ...batch.steps.map((step) => `${step.index}. ${step.instruction}`),
          ...(productionMode === "hybrid"
            ? [`Zukaufteil separat disponieren: ${purchasedElementsSummary(component)}.`]
            : [])
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
      kitchenSheets.push(unresolvedKitchenSheet(component, servings, reason));
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
  const operationalKitchenSheets = hasBlockingIssues ? [] : kitchenSheets;
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

  return {
    productionPlan,
    purchaseList
  };
}
