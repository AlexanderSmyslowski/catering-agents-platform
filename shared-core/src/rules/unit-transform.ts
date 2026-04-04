/*
 * Einheitentransformation in Phase 1:
 * - kleine, deterministische Einkaufs-Normalform
 * - nur sichere Basistransformationen
 * - keine dichte- oder rezepturabhaengigen Konvertierungen
 */

export interface UnitTransformResult {
  normalizedQty: number;
  normalizedUnit: string;
  status: "identity" | "converted" | "untransformed";
  sourceUnit: string;
}

function roundUnitQuantity(amount: number): number {
  return Number(amount.toFixed(4));
}

export function normalizePurchaseQuantity(amount: number, unit: string): UnitTransformResult {
  const normalizedUnit = unit.trim().toLowerCase();

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Menge fuer Einheitentransformation muss eine nicht-negative Zahl sein.");
  }

  if (normalizedUnit === "g") {
    return {
      normalizedQty: roundUnitQuantity(amount / 1000),
      normalizedUnit: "kg",
      status: "converted",
      sourceUnit: normalizedUnit
    };
  }

  if (normalizedUnit === "ml") {
    return {
      normalizedQty: roundUnitQuantity(amount / 1000),
      normalizedUnit: "l",
      status: "converted",
      sourceUnit: normalizedUnit
    };
  }

  if (normalizedUnit === "kg" || normalizedUnit === "l" || normalizedUnit === "pcs") {
    return {
      normalizedQty: roundUnitQuantity(amount),
      normalizedUnit,
      status: "identity",
      sourceUnit: normalizedUnit
    };
  }

  return {
    normalizedQty: roundUnitQuantity(amount),
    normalizedUnit: normalizedUnit || unit,
    status: "untransformed",
    sourceUnit: normalizedUnit || unit
  };
}
