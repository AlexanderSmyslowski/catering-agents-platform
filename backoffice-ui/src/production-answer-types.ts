export type PurchasedQuantityEdit = { element: string; amountPerPerson: string; unit: string };

export type ComponentEditState = {
  correctionLabel?: string;
  correctionServings?: string;
  split?: { reason: string; children: Array<{ label: string; servings: string; recipeId: string }> };
  menuCategory: string;
  productionMode: string;
  productionStation?: string;
  purchasedElements: string;
  originalPurchasedElements?: string[];
  purchasedQuantities?: PurchasedQuantityEdit[];
  recipeOverrideId: string;
  notes: string;
};
