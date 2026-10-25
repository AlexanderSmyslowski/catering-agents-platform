import type { OfferCalculationLineInput, PricingSummary } from "./types.js";

function canonicalJson(value: unknown): string | undefined {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") + "}";
  return JSON.stringify(value);
}
const areJsonValuesEqual = (left: unknown, right: unknown) => canonicalJson(left) === canonicalJson(right);

const MAX_CENTS = 1_000_000_000_000;
const categories = ["food", "staff", "logistics", "equipment", "drinks", "other"];
const units = ["guest", "hour", "flat", "piece"];
const keys = ["id", "label", "category", "quantity", "unit", "unitNetCents", "taxRateBps", "taxReason", "zeroPriceReason", "sourceKind", "sourceReference"];

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültige Preisaufstellung.");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, limit = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new Error(label + " fehlt oder ist zu lang.");
  return value.trim();
}

function boundedInteger(value: unknown, max: number, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) throw new Error(label + " ist ungültig.");
  return value as number;
}

function decimal(value: unknown): { canonical: string; numerator: bigint; denominator: bigint } {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(value)) {
    throw new Error("Menge: positive Dezimalzahl mit höchstens sechs Nachkommastellen erforderlich.");
  }
  const [whole, fraction = ""] = value.split(".");
  const canonicalFraction = fraction.replace(/0+$/, "");
  const numerator = BigInt(whole! + fraction);
  const denominator = 10n ** BigInt(fraction.length);
  if (numerator <= 0n || numerator > 100000n * denominator) throw new Error("Menge muss größer als 0 und höchstens 100.000 sein.");
  return { canonical: whole + (canonicalFraction ? "." + canonicalFraction : ""), numerator, denominator };
}

// Quoted net lines are rounded first; tax is rounded once per entered rate.
// Integer arithmetic also keeps fractional staff hours independent of binary floats.
function halfUp(numerator: bigint, denominator: bigint): number {
  const value = (2n * numerator + denominator) / (2n * denominator);
  if (value > BigInt(MAX_CENTS)) throw new Error("Preisaufstellung überschreitet den zulässigen Betragsbereich.");
  return Number(value);
}

function parseLine(value: unknown): OfferCalculationLineInput {
  const raw = record(value);
  if (Object.keys(raw).some(key => !keys.includes(key))) throw new Error("Unbekanntes Preisfeld; Summen werden ausschließlich vom Server berechnet.");
  const id = text(raw.id, "Positionskennung", 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Positionskennung ist ungültig.");
  const category = text(raw.category, "Leistungsart");
  const unit = text(raw.unit, "Einheit");
  if (!categories.includes(category) || !units.includes(unit)) throw new Error("Leistungsart oder Einheit ist ungültig.");
  const unitNetCents = boundedInteger(raw.unitNetCents, 1_000_000_000, "Netto-Einzelpreis in Cent");
  const taxRateBps = raw.taxRateBps === undefined ? undefined : boundedInteger(raw.taxRateBps, 10000, "Steuerfestlegung");
  const sourceKind = raw.sourceKind;
  if (typeof sourceKind !== "string" || !["app_transfer", "operator", "synthetic"].includes(sourceKind)) throw new Error("Preisquelle ist ungültig.");
  const taxReason = raw.taxReason === undefined ? undefined : text(raw.taxReason, "Begründung der Steuerfestlegung");
  const zeroPriceReason = raw.zeroPriceReason === undefined ? undefined : text(raw.zeroPriceReason, "Begründung für enthaltene Leistung");
  if (taxRateBps === 0 && !taxReason) throw new Error("Für 0 % Steuer ist eine Begründung erforderlich.");
  if (unitNetCents === 0 && !zeroPriceReason) throw new Error("Für eine kostenfreie/enthaltene Leistung ist eine Begründung erforderlich.");
  return {
    id, label: text(raw.label, "Leistungsbezeichnung"), category: category as OfferCalculationLineInput["category"],
    quantity: decimal(raw.quantity).canonical, unit: unit as OfferCalculationLineInput["unit"], unitNetCents,
    ...(taxRateBps !== undefined ? { taxRateBps } : {}),
    ...(taxReason ? { taxReason } : {}), ...(zeroPriceReason ? { zeroPriceReason } : {}),
    sourceKind: sourceKind as OfferCalculationLineInput["sourceKind"], sourceReference: text(raw.sourceReference, "Quellenreferenz")
  };
}

export function calculateOfferPricing(input: unknown, guestCount: number): PricingSummary {
  boundedInteger(guestCount, 100000, "Gästezahl");
  if (!guestCount) throw new Error("Gästezahl muss größer als 0 sein.");
  const raw = record(input);
  if (Object.keys(raw).some(key => key !== "lines") || !Array.isArray(raw.lines) || raw.lines.length < 1 || raw.lines.length > 100) {
    throw new Error("1–100 Leistungspositionen sind erforderlich.");
  }
  const lines = raw.lines.map(value => {
    const line = parseLine(value);
    const q = decimal(line.quantity);
    return { ...line, netCents: halfUp(q.numerator * BigInt(line.unitNetCents), q.denominator) };
  });
  if (new Set(lines.map(line => line.id)).size !== lines.length) throw new Error("Doppelte Leistungsposition.");
  const netCents = boundedInteger(lines.reduce((sum, line) => sum + line.netCents, 0), MAX_CENTS, "Nettosumme");
  const groups = new Map<number, number>();
  for (const line of lines) if (line.taxRateBps !== undefined) groups.set(line.taxRateBps, (groups.get(line.taxRateBps) ?? 0) + line.netCents);
  const taxGroups = [...groups].sort(([a], [b]) => a - b).map(([rateBps, net]) => ({
    rateBps, netCents: net, taxCents: halfUp(BigInt(net) * BigInt(rateBps), 10000n)
  }));
  const missingTaxLineIds = lines.filter(line => line.taxRateBps === undefined).map(line => line.id);
  const taxCents = missingTaxLineIds.length ? undefined : taxGroups.reduce((sum, group) => sum + group.taxCents, 0);
  const grossCents = taxCents === undefined ? undefined : boundedInteger(netCents + taxCents, MAX_CENTS, "Bruttosumme");
  const containsSynthetic = lines.some(line => line.sourceKind === "synthetic");
  return {
    subtotal: { amount: netCents / 100, currency: "EUR" },
    perPerson: { amount: halfUp(BigInt(netCents), BigInt(guestCount)) / 100, currency: "EUR" },
    notes: [
      "Netto-Verkaufspreise; Preisgrundlage und Steuerfestlegung bleiben prüfpflichtig. Einkaufskosten und Marge sind nicht erfasst.",
      ...(containsSynthetic ? ["Enthält synthetische Testannahmen – keine Unternehmenspreise."] : []),
      ...(missingTaxLineIds.length ? ["Steuerfestlegung unvollständig; keine Bruttosumme und keine Freigabe."] : [])
    ],
    calculation: {
      version: 1, roundingPolicy: "net-line-tax-group-half-up-v1", guestCount, containsSynthetic,
      lines, netCents, taxGroups, missingTaxLineIds,
      ...(taxCents !== undefined ? { taxCents, grossCents } : {})
    }
  };
}

/** Check all derived fields wherever the optional calculation is persisted or transported. */
export function validOfferPricingCalculation(value: unknown): boolean {
  try {
    const summary = record(value);
    if (summary.calculationRequired !== undefined && summary.calculationRequired !== true) return false;
    if (summary.calculationRequired && summary.calculation !== undefined) return false;
    if (summary.calculation === undefined) return true;
    const calculation = record(summary.calculation);
    if (!Array.isArray(calculation.lines)) return false;
    const lines = calculation.lines.map(value => {
      const { netCents: _derived, ...input } = record(value);
      return input;
    });
    const expected = calculateOfferPricing({ lines }, calculation.guestCount as number);
    return areJsonValuesEqual(calculation, expected.calculation)
      && areJsonValuesEqual(summary.subtotal, expected.subtotal)
      && areJsonValuesEqual(summary.perPerson, expected.perPerson);
  } catch {
    return false;
  }
}
