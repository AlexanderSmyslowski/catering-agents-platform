export type PurchaseListPreviewItem = {
  articleName: string;
  quantity: string;
  unit: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

export function getPurchaseListPreviewItems(
  purchaseList: Record<string, unknown>
): PurchaseListPreviewItem[] {
  const rawItems = Array.isArray(purchaseList.items)
    ? purchaseList.items
    : Array.isArray(purchaseList.positions)
      ? purchaseList.positions
      : Array.isArray(purchaseList.entries)
        ? purchaseList.entries
        : [];

  return rawItems.slice(0, 5).flatMap((item) => {
    const itemRecord = asRecord(item);
    if (!itemRecord) {
      return [];
    }

    const quantityRecord = asRecord(itemRecord.quantity);
    const articleName =
      readStringOrNumber(itemRecord, ["displayName", "articleName", "name", "label", "ingredientName"]) ??
      "Artikel";
    const quantity =
      readStringOrNumber(itemRecord, ["purchaseQty", "normalizedQty", "qty", "amount"]) ??
      readStringOrNumber(quantityRecord, ["amount"]) ??
      "-";
    const unit =
      readStringOrNumber(itemRecord, ["purchaseUnit", "normalizedUnit", "unit"]) ??
      readStringOrNumber(quantityRecord, ["unit"]) ??
      "-";

    return [{ articleName, quantity, unit }];
  });
}
