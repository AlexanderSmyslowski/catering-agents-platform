/*
 * Yield / Ausbeute / Verschnitt in V1:
 * - netQty: benoetigte verwendbare Menge in der Produktion
 * - yieldFactor: nutzbarer Anteil der Ausgangsmenge, in V1 nur > 0 und <= 1
 * - grossQty: benoetigte Ausgangsmenge vor Verlust
 * - wasteQty: erwartete Verlust-/Verschnittmenge
 *
 * Verbindliche Formel:
 * grossQty = netQty / yieldFactor
 * wasteQty = grossQty - netQty
 *
 * Primaere Pflegeebene in V1 ist "ingredient", weil IngredientLine heute
 * die kleinste bestehende, deterministische Produktionsposition im Kernfluss ist.
 */

function roundYieldQuantity(value: number): number {
  return Number(value.toFixed(4));
}

export interface YieldQuantities {
  netQty: number;
  yieldFactor: number;
  grossQty: number;
  wasteQty: number;
}

export function assertYieldFactor(yieldFactor: number): number {
  if (!Number.isFinite(yieldFactor) || yieldFactor <= 0) {
    throw new Error("yieldFactor muss größer als 0 sein.");
  }

  if (yieldFactor > 1) {
    throw new Error("yieldFactor darf in V1 nicht größer als 1 sein.");
  }

  return yieldFactor;
}

export function calculateYieldQuantities(
  netQty: number,
  yieldFactor: number
): YieldQuantities {
  if (!Number.isFinite(netQty) || netQty < 0) {
    throw new Error("netQty muss eine nicht-negative Zahl sein.");
  }

  const normalizedYieldFactor = assertYieldFactor(yieldFactor);
  const grossQty = roundYieldQuantity(netQty / normalizedYieldFactor);
  const wasteQty = roundYieldQuantity(grossQty - netQty);

  return {
    netQty: roundYieldQuantity(netQty),
    yieldFactor: normalizedYieldFactor,
    grossQty,
    wasteQty
  };
}
