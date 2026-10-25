import { summarizeOfferDirectCosts, type PricingSummary } from "@catering/shared-core";
const escape = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const euro = (cents: number | undefined) => cents === undefined ? "offen" : (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const units = { guest: ["Gast", "Gäste"], hour: ["Personenstunde", "Personenstunden"], flat: ["Pauschale", "Pauschalen"], piece: ["Stück", "Stück"] };
const money = (cents: number | undefined) => `<span class="money">${euro(cents)}</span>`;
export function renderOfferPricingHtml(summary: PricingSummary, includeSources = true): string {
  const c = summary.calculation;
  if (!c) return "";
  const costs = summarizeOfferDirectCosts(c);
  const internalCosts = includeSources ? [
    "<section><h3>Interne Kosten</h3><p>Erfasste direkte Kosten netto: " + euro(costs.enteredNetCents) + "</p>",
    "<p>Deckungsbeitrag vor Gemeinkosten" + (costs.status === "estimated" ? " · vorläufig" : "") + ": " + (costs.contributionNetCents === undefined ? "noch unvollständig" : euro(costs.contributionNetCents)) + "</p>",
    "<p>Verkauf netto minus direkte Kosten der erfassten Positionen. Weitere Gemeinkosten sind nicht berücksichtigt; der Betrag ist kein Gewinn.</p>",
    costs.missingLineIds.length ? "<p>Kosten offen: " + c.lines.filter(line => costs.missingLineIds.includes(line.id)).map(line => escape(line.label)).join(", ") + ". Fehlende Kosten werden nicht als null gerechnet.</p>" : "",
    costs.estimatedLineIds.length ? "<p>Enthält geschätzte Kosten – Preisstand prüfen." + (costs.status === "estimated" ? " Deckungsbeitrag vorläufig." : "") + "</p>" : "",
    costs.status === "documented" ? "<p>Belegpreise laut Eingabe. Preisstand und Gültigkeit für diesen Auftrag prüfen.</p>" : "",
    "<ul>", ...c.lines.filter(line => line.directCost).map(line => "<li>" + escape(line.label) + ": " + euro(line.directCost!.totalNetCents)
      + " · " + (line.directCost!.basis === "estimated" ? "Geschätzt" : "Belegpreis") + " · " + escape(line.directCost!.sourceReference)
      + " · Preisstand: " + escape(line.directCost!.priceDate ?? "nicht bekannt") + "</li>"), "</ul></section>"
  ].join("") : "";
  return [
    '<section class="offer-pricing"><h2>Preisaufstellung</h2><p>Verkaufspreise netto. Preis- und Steuergrundlage bleiben prüfpflichtig.</p>',
    c.containsSynthetic ? "<p><strong>Enthält synthetische Testannahmen – keine Unternehmenspreise.</strong></p>" : "",
    "<table><thead><tr><th>Leistung</th><th>Menge / Einheit</th><th>Einzelpreis netto</th><th>Betrag netto</th><th>Steuer</th>",
    includeSources ? "<th>Quelle · prüfpflichtig</th>" : "", "</tr></thead><tbody>",
    ...c.lines.map(line => "<tr><td>" + escape(line.label) + (line.zeroPriceReason ? " · " + escape(line.zeroPriceReason) : "")
      + '</td><td><span class="quantity">' + escape(line.quantity) + " " + units[line.unit][Number(line.quantity) === 1 ? 0 : 1] + "</span>"
      + "</td><td>" + money(line.unitNetCents) + "</td><td>" + money(line.netCents)
      + "</td><td>" + (line.taxRateBps === undefined ? "offen" : escape(line.taxRateBps / 100) + " %")
      + (line.taxReason ? " · " + escape(line.taxReason) : "") + "</td>"
      + (includeSources ? "<td>" + escape(line.sourceReference) + (line.sourceKind === "synthetic" ? " · synthetisch" : "") + "</td>" : "") + "</tr>"),
    "</tbody></table><p>Netto gesamt: " + euro(c.netCents) + "</p>",
    ...c.taxGroups.map(group => "<p>Steuer " + escape(group.rateBps / 100) + " % auf " + euro(group.netCents) + ": " + euro(group.taxCents) + "</p>"),
    "<p>Brutto gesamt: " + euro(c.grossCents) + "</p>",
    "<p>Netto je Gast (gerundet, " + escape(c.guestCount) + " Gäste): " + euro(Math.round(summary.perPerson!.amount * 100)) + "</p>",
    c.missingTaxLineIds.length ? "<p><strong>Steuerfestlegung unvollständig; Brutto offen und Freigabe gesperrt.</strong></p>" : "",
    internalCosts,
    "<p>Berechnung: Netto je Zeile auf Cent; Steuer je erfasstem Satz auf die Nettogruppensumme, jeweils kaufmännisch gerundet.</p></section>"
  ].join("");
}
