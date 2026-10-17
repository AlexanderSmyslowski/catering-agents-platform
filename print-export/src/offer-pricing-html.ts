import type { PricingSummary } from "@catering/shared-core";
const escape = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const euro = (cents: number | undefined) => cents === undefined ? "offen" : (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const units = { guest: "Gäste", hour: "Personenstunden", flat: "Pauschalen", piece: "Stück" };
export function renderOfferPricingHtml(summary: PricingSummary, includeSources = true): string {
  const c = summary.calculation;
  if (!c) return "";
  return [
    "<section><h2>Preisaufstellung</h2><p>Verkaufspreise netto. Einkaufskosten und Marge sind nicht erfasst. Preis- und Steuergrundlage bleiben prüfpflichtig.</p>",
    c.containsSynthetic ? "<p><strong>Enthält synthetische Testannahmen – keine Unternehmenspreise.</strong></p>" : "",
    "<table><thead><tr><th>Leistung</th><th>Menge / Einheit</th><th>Einzelpreis netto</th><th>Betrag netto</th><th>Steuer</th>",
    includeSources ? "<th>Quelle · prüfpflichtig</th>" : "", "</tr></thead><tbody>",
    ...c.lines.map(line => "<tr><td>" + escape(line.label) + (line.zeroPriceReason ? " · " + escape(line.zeroPriceReason) : "")
      + "</td><td>" + escape(line.quantity) + " " + units[line.unit]
      + "</td><td>" + euro(line.unitNetCents) + "</td><td>" + euro(line.netCents)
      + "</td><td>" + (line.taxRateBps === undefined ? "offen" : escape(line.taxRateBps / 100) + " %")
      + (line.taxReason ? " · " + escape(line.taxReason) : "") + "</td>"
      + (includeSources ? "<td>" + escape(line.sourceReference) + (line.sourceKind === "synthetic" ? " · synthetisch" : "") + "</td>" : "") + "</tr>"),
    "</tbody></table><p>Netto gesamt: " + euro(c.netCents) + "</p>",
    ...c.taxGroups.map(group => "<p>Steuer " + escape(group.rateBps / 100) + " % auf " + euro(group.netCents) + ": " + euro(group.taxCents) + "</p>"),
    "<p>Brutto gesamt: " + euro(c.grossCents) + "</p>",
    "<p>Netto je Gast (gerundet, " + escape(c.guestCount) + " Gäste): " + euro(Math.round(summary.perPerson!.amount * 100)) + "</p>",
    c.missingTaxLineIds.length ? "<p><strong>Steuerfestlegung unvollständig; Brutto offen und Freigabe gesperrt.</strong></p>" : "",
    "<p>Berechnung: Netto je Zeile auf Cent; Steuer je erfasstem Satz auf die Nettogruppensumme, jeweils kaufmännisch gerundet.</p></section>"
  ].join("");
}
