export type PurchasedQuantityEdit = { element: string; amountPerPerson: string; unit: string };

export type ComponentEditState = {
  menuCategory: string;
  productionMode: string;
  productionStation?: string;
  purchasedElements: string;
  originalPurchasedElements?: string[];
  purchasedQuantities?: PurchasedQuantityEdit[];
  recipeOverrideId: string;
  notes: string;
};
