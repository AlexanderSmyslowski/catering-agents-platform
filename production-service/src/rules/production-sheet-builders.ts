import type {
  AcceptedEventSpec,
  ProductionPlan
} from "@catering/shared-core";

type MenuPlanComponent = AcceptedEventSpec["menuPlan"][number];

export function stationFor(label: string): string {
  if (/salat|dessert/i.test(label)) {
    return "cold-kitchen";
  }

  if (/kaffee|tee/i.test(label)) {
    return "beverage-station";
  }

  return "hot-kitchen";
}

export function prepWindowFor(spec: AcceptedEventSpec): string {
  return spec.event.date
    ? `${spec.event.date} T-1`
    : "Zeitfenster offen, Produktionsvorlauf bitte manuell prüfen";
}

export function gnPlanFor(servings: number): { container: string; count: number }[] {
  return [
    {
      container: servings > 40 ? "GN 1/1" : "GN 1/2",
      count: Math.max(1, Math.ceil(servings / 20))
    }
  ];
}

export function hybridClarificationReason(component: MenuPlanComponent): string | undefined {
  if (!/\bfocaccia\b/i.test(component.label)) {
    return undefined;
  }

  return `Hybridfall ${component.label}: Bitte bewusst klären, ob Eigenproduktion, Bäcker-Zukauf, Convenience-Zukauf oder Fertigprodukt gilt.`;
}

export function purchasedElementsSummary(component: MenuPlanComponent): string {
  const purchasedElements = component.productionDecision?.purchasedElements ?? [];
  return purchasedElements.length > 0 ? purchasedElements.join(", ") : "noch offen";
}

export function productionQtyFor(servings: number) {
  return {
    amount: servings,
    unit: "Portionen"
  };
}

export function procurementKitchenSheet(
  component: MenuPlanComponent,
  servings: number,
  spec: AcceptedEventSpec
): ProductionPlan["kitchenSheets"][number] {
  const mode = component.productionDecision?.mode;
  const modeLabel =
    mode === "convenience_purchase"
      ? "Convenience-Zukauf"
      : mode === "external_finished"
        ? "Fertigprodukt / externer Bezug"
        : "Beschaffung";
  const procurementNotes = [
    `Beschaffung laut Herstellungsart: ${modeLabel}.`,
    `Zugekaufte Bestandteile: ${purchasedElementsSummary(component)}.`,
    "Lieferquelle und Gebinde vor Bestellung kurz prüfen."
  ];

  return {
    title: `${component.label} - ${modeLabel}`,
    componentId: component.componentId,
    productionQty: productionQtyFor(servings),
    station: stationFor(component.label),
    prepWindow: prepWindowFor(spec),
    ingredients: [],
    steps: [],
    procurementNotes,
    instructions: [
      `Menge einplanen: ${servings} Portionen.`,
      ...procurementNotes,
      "Komponente vor Service optisch und mengenmäßig gegen das Angebot prüfen."
    ]
  };
}

export function unresolvedKitchenSheet(
  component: MenuPlanComponent,
  servings: number,
  reason: string,
  spec: AcceptedEventSpec
): ProductionPlan["kitchenSheets"][number] {
  return {
    title: `${component.label} - Rezeptklärung nötig`,
    componentId: component.componentId,
    productionQty: productionQtyFor(servings),
    station: stationFor(component.label),
    prepWindow: prepWindowFor(spec),
    ingredients: [],
    steps: [],
    blockingNotes: [reason],
    instructions: [
      `Aktuell geplant für ${servings} Portionen.`,
      reason,
      "Für diese Komponente liegt derzeit noch kein belastbares Rezept vor.",
      "Bitte Bibliotheksrezept zuweisen, neues Rezept hochladen oder Herstellungsart auf Beschaffung umstellen.",
      "Danach die Produktionsplanung erneut starten."
    ]
  };
}
