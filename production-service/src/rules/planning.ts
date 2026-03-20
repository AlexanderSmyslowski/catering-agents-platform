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
  if (/bäcker|b[aä]cker|zukauf vom b[aä]cker/i.test(reason)) {
    return {
      title: `${component.label} - Bäcker-Zukauf`,
      instructions: [
        `Aktuell geplant für ${servings} Portionen.`,
        reason,
        "Bitte die Bäckerbestellung mit Sorte, Menge und Lieferzeit abstimmen.",
        "Für diese Komponente wird kein Rezept und keine Internetrecherche benötigt.",
        "Danach die Komponente als Beschaffung/Zukauf weiterführen."
      ]
    };
  }

  if (/focaccia/i.test(component.label)) {
    return {
      title: `${component.label} - Herstellungsart klären`,
      instructions: [
        `Aktuell geplant für ${servings} Portionen.`,
        reason,
        "Bitte entscheiden: Eigenproduktion oder Zukauf.",
        "Falls Eigenproduktion gewünscht ist: internes Rezept zuweisen oder neues Rezept anlegen.",
        "Danach die Produktionsplanung erneut starten."
      ]
    };
  }

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

function unresolvedTimelineLabel(
  component: AcceptedEventSpec["menuPlan"][number],
  reason: string
): string {
  if (/bäcker|b[aä]cker|zukauf vom b[aä]cker/i.test(reason)) {
    return `${component.label} beschaffen`;
  }

  if (/focaccia/i.test(component.label)) {
    return `${component.label} Herstellungsart klären`;
  }

  return `${component.label} Rezeptklärung`;
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

  for (const component of eventSpec.menuPlan) {
    const servings = component.servings ?? eventSpec.attendees.expected ?? 0;
    const productionMode = component.productionDecision?.mode;
    const purchasedElements = component.productionDecision?.purchasedElements ?? [];

    if (!component.menuCategory) {
      const reason = "Gerichtsklassifikation fehlt. Bitte klassisch, vegetarisch oder vegan festlegen.";
      recipeSelections.push({
        componentId: component.componentId,
        selectionReason: reason,
        autoUsedInternetRecipe: false
      });
      unresolvedItems.push(`Klassifikation für ${component.label} fehlt.`);
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
      unresolvedItems.push(`Herstellungsentscheidung für ${component.label} fehlt.`);
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
      unresolvedItems.push(`Zugekaufte Bestandteile für ${component.label} fehlen.`);
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

    const resolution = component.recipeOverrideId
      ? await discoveryService.resolveRecipeOverride(component.recipeOverrideId, component)
      : await discoveryService.resolveRecipe(component, eventSpec);
    recipeSelections.push(resolution.selection);
    unresolvedItems.push(...resolution.unresolvedItems);

    if (!resolution.recipe || servings <= 0) {
      kitchenSheets.push(
        unresolvedKitchenSheet(
          component,
          servings,
          resolution.selection.selectionReason || "Für diese Komponente wurde noch kein belastbares Rezept gefunden."
        )
      );
      timeline.push({
        label: unresolvedTimelineLabel(
          component,
          resolution.selection.selectionReason || "Für diese Komponente wurde noch kein belastbares Rezept gefunden."
        ),
        at: prepWindowFor(eventSpec)
      });
      continue;
    }

    const draftBatch = toProductionBatch(resolution.recipe, component.componentId, servings);
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
      title: `${component.label} - ${resolution.recipe.name}`,
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
  }

  const readiness = mergeReadiness(eventSpec.readiness, unresolvedItems);
  const productionPlan = validateProductionPlan({
    schemaVersion: SCHEMA_VERSION,
    planId: `plan-${eventSpec.specId}`,
    eventSpecId: eventSpec.specId,
    readiness,
    productionBatches,
    timeline,
    kitchenSheets,
    recipeSelections,
    unresolvedItems: [...new Set(unresolvedItems)]
  });

  const purchaseList = validatePurchaseList(
    aggregatePurchaseList(eventSpec.specId, productionBatches, procurementItems)
  );

  return {
    productionPlan,
    purchaseList
  };
}
