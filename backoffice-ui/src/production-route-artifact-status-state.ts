export function countPurchaseListItems(purchaseLists: Array<Record<string, unknown>>): number {
  return purchaseLists.reduce((sum, purchaseList) => {
    const totals = purchaseList.totals as Record<string, unknown> | undefined;
    const itemCount = Number(totals?.itemCount);
    if (Number.isFinite(itemCount)) {
      return sum + itemCount;
    }
    if (Array.isArray(purchaseList.items)) {
      return sum + purchaseList.items.length;
    }
    return sum;
  }, 0);
}

export function formatPurchaseZoneStatusLabel(input: {
  purchaseListCount: number;
  itemCount: number;
}): string {
  if (input.purchaseListCount === 0) {
    return "noch keine Liste";
  }

  if (input.itemCount === 0) {
    return input.purchaseListCount === 1 ? "1 Liste ohne Positionen" : `${input.purchaseListCount} Listen ohne Positionen`;
  }

  return `${input.purchaseListCount} Liste${input.purchaseListCount === 1 ? "" : "n"} · ${input.itemCount} Positionen`;
}

export function formatProductionIntakeOriginLabel(input: {
  intakeRequestDetail?: Record<string, unknown> | null;
  currentIntakeRequestId?: string;
}): string {
  if (input.intakeRequestDetail) {
    const source = input.intakeRequestDetail.source as Record<string, unknown> | undefined;
    return `${formatIntakeSourceChannelLabel(source?.channel)} · ${String(source?.receivedAt ?? "-")} · ${String(
      input.intakeRequestDetail.requestId ? "Intake-Anfrage verknüpft" : "Intake-Anfrage ohne Kennung"
    )}`;
  }

  const requestId = input.currentIntakeRequestId?.trim();
  return requestId ? "Intake-Anfrage verknüpft" : "kein Intake-Ursprung verknüpft";
}

function formatIntakeSourceChannelLabel(value: unknown): string {
  const channel = String(value ?? "").trim();
  const labels: Record<string, string> = {
    manual_form: "manuelle Eingabe",
    offer: "Angebotsagent",
    text: "Text",
    pdf_upload: "Dateiupload"
  };
  return channel ? labels[channel] ?? channel : "-";
}

export function formatProductionHandoffExportLabel(input: {
  hasSelectedPlan: boolean;
  purchaseListCount: number;
}): string {
  return [
    input.hasSelectedPlan ? "Produktionsblatt vorhanden" : "Produktionsblatt offen",
    input.purchaseListCount > 0 ? "Einkaufsliste vorhanden" : "Einkaufsliste offen"
  ].join(" · ");
}

export function formatProductionHandoffContextLabel(input: {
  selectedPlan?: Record<string, unknown>;
  selectedPlanSpec?: Record<string, unknown>;
  purchaseLists: Array<Record<string, unknown>>;
}): string | undefined {
  if (!input.selectedPlan) {
    return undefined;
  }

  return [
    "Produktionsplan im Fokus",
    input.selectedPlanSpec ? "Spezifikation im Fokus" : "Spezifikation aus Planbezug",
    input.purchaseLists[0] ? "Einkaufsliste vorhanden" : "Einkaufsliste offen"
  ]
    .filter(Boolean)
    .join(" · ");
}
