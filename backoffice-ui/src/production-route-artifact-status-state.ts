import { formatProductionContextId } from "./production-route-context-state.js";

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
  return input.purchaseListCount > 0
    ? `${input.purchaseListCount} Liste${input.purchaseListCount === 1 ? "" : "n"} · ${input.itemCount} Positionen`
    : "noch keine Liste";
}

export function formatProductionIntakeOriginLabel(input: {
  intakeRequestDetail?: Record<string, unknown> | null;
  currentIntakeRequestId?: string;
}): string {
  if (input.intakeRequestDetail) {
    const source = input.intakeRequestDetail.source as Record<string, unknown> | undefined;
    return `${String(source?.channel ?? "-")} · ${String(source?.receivedAt ?? "-")} · ${String(
      input.intakeRequestDetail.requestId ?? "-"
    )}`;
  }

  const requestId = input.currentIntakeRequestId?.trim();
  return requestId ? `Intake-Anfrage ${requestId}` : "kein Intake-Ursprung verknüpft";
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
    `planId ${formatProductionContextId(input.selectedPlan.planId)}`,
    `specId ${formatProductionContextId(input.selectedPlan.eventSpecId, input.selectedPlanSpec?.specId)}`,
    input.purchaseLists[0] ? `purchaseListId ${formatProductionContextId(input.purchaseLists[0].purchaseListId)}` : undefined
  ]
    .filter(Boolean)
    .join(" · ");
}
