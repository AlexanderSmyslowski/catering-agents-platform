import type { MenuComponent } from "./types.js";

export function validPurchasedQuantities(decision: unknown): boolean {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) return false;
  const input = decision as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(input, "purchasedQuantities")) return true;
  const quantities = input.purchasedQuantities;
  const elements = input.purchasedElements;
  const text = (value: unknown, max: number): value is string =>
    typeof value === "string" && Boolean(value.trim()) && value.length <= max;
  if (!Array.isArray(elements) || elements.length > 100 || elements.some(element => !text(element, 500)) ||
    new Set(elements.map(element => element.trim())).size !== elements.length ||
    !Array.isArray(quantities) || quantities.length !== elements.length) return false;
  const seen = new Set<string>();
  for (const quantity of quantities) {
    if (!quantity || typeof quantity !== "object" || Array.isArray(quantity) ||
      Object.keys(quantity).some(key => !["element", "amountPerPerson", "unit"].includes(key)) ||
      !text(quantity.element, 500) || !elements.includes(quantity.element) || seen.has(quantity.element) ||
      typeof quantity.amountPerPerson !== "number" || !Number.isFinite(quantity.amountPerPerson) || quantity.amountPerPerson <= 0 ||
      !text(quantity.unit, 100)) return false;
    seen.add(quantity.element);
  }
  return true;
}

export type PurchasedQuantity = NonNullable<NonNullable<MenuComponent["productionDecision"]>["purchasedQuantities"]>[number];
