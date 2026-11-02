import { useRef, useState } from "react";
import { readSchwanPriceList, type SupplierPriceCandidate } from "./supplier-price-import.js";

type IngredientCostRow = { id: number; name: string; used: string; reference: string; unit: string; price: string; source: string; supplierOriginalPrice?: string };
const ingredientCostSourcePrefix = "Zutaten- und Kostenansätze: ";
const emptyRow = (id: number): IngredientCostRow => ({ id, name: "", used: "", reference: "", unit: "", price: "", source: "" });
const supplierPriceChanged = (row: IngredientCostRow) => row.supplierOriginalPrice !== undefined && row.price.replace(",", ".") !== row.supplierOriginalPrice.replace(",", ".");
// The editor accepts at most eight digits before the decimal point.
const maximumCents = 9_999_999_999n;

function editorCents(input: string | undefined): bigint | undefined {
  const value = input?.trim().replace(",", ".") ?? "";
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return undefined;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function positiveDecimal(input: string, decimals: number): { value: bigint; scale: bigint } | undefined {
  const value = input.trim().replace(",", ".");
  if (!(new RegExp(`^(?:0|[1-9]\\d{0,5})(?:\\.\\d{1,${decimals}})?$`)).test(value)) return undefined;
  const [whole, fraction = ""] = value.split(".");
  const integer = BigInt(whole! + fraction);
  return integer > 0n ? { value: integer, scale: 10n ** BigInt(fraction.length) } : undefined;
}

function ingredientTotal(row: IngredientCostRow): bigint | undefined {
  const used = positiveDecimal(row.used, 6), reference = positiveDecimal(row.reference, 6), price = positiveDecimal(row.price, 4);
  if (!row.name.trim() || !row.source.trim() || !["g", "kg", "ml", "l", "Stück"].includes(row.unit) || !used || !reference || !price) return undefined;
  const numerator = used.value * reference.scale * price.value * 100n;
  const denominator = used.scale * reference.value * price.scale;
  return (2n * numerator + denominator) / (2n * denominator);
}

export function IngredientCostHelper({ existingCost, onApply, onInvalidate }: {
  existingCost?: string;
  onApply: (amount: string, source: string) => void;
  onInvalidate: () => void;
}) {
  const [rows, setRows] = useState<IngredientCostRow[]>([emptyRow(1)]);
  const [confirmed, setConfirmed] = useState(false);
  const [prices, setPrices] = useState<SupplierPriceCandidate[]>([]);
  const [priceDate, setPriceDate] = useState("");
  const [priceMessage, setPriceMessage] = useState("");
  const priceLoad = useRef(0);
  const nextId = useRef(2);
  const appliedCents = useRef<bigint | undefined>(undefined);
  const totals = rows.map(ingredientTotal);
  const complete = totals.every((value): value is bigint => value !== undefined);
  const total = complete ? totals.reduce((sum, value) => sum + value, 0n) : undefined;
  const sources = [...new Set(rows.map(row => row.source.trim() + (supplierPriceChanged(row) ? "; Preis manuell geändert" : "")))].join("; ");
  const source = ingredientCostSourcePrefix + sources;
  const ready = complete && total !== undefined && total <= maximumCents && source.length <= 500;
  const existingCents = editorCents(existingCost);
  function changed() {
    setConfirmed(false);
    if (appliedCents.current !== undefined) {
      if (editorCents(existingCost) === appliedCents.current) onInvalidate();
      appliedCents.current = undefined;
    }
  }
  function update(id: number, patch: Partial<IngredientCostRow>) {
    changed();
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  }
  return <details className="offer-pricing__ingredient-helper">
    <summary>Zutatenkosten berechnen</summary>
    <p className="helper-text">Mengen und Nettopreise eingeben. Beispiel: 5 kg benötigt, 1 kg kostet 2,20 €. Beide Mengen brauchen dieselbe Einheit. Preise dürfen bis zu vier Nachkommastellen haben. Die Rechnung zeigt Verbrauchskosten, nicht den Kauf ganzer Gebinde.</p>
    <p className="helper-text">Einzelne Ansätze werden nicht gespeichert. Bitte Rechenweg und Belege separat festhalten; gespeichert werden nur Gesamtsumme und Quellenhinweis.</p>
    <details>
      <summary>Schwan-Preisliste verwenden</summary>
      <p className="helper-text">Excel-Preisliste aus der E-Mail auswählen und danach den Preisstand eintragen. Die Datei wird nur in diesem Browser gelesen. Preisvorschläge sind ungeprüft und bleiben nicht gespeichert. Bereits ausgewählte Ansätze behalten ihren eingetragenen Preisstand.</p>
      <label>Schwan-Exceldatei<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={async event => {
        const load = ++priceLoad.current;
        const file = event.currentTarget.files?.[0];
        setPrices([]); setPriceDate(""); setPriceMessage("");
        if (!file) return;
        if (file.size > 5_000_000) { setPriceMessage("Die Datei ist zu groß. Bitte eine Preisliste bis 5 MB wählen."); return; }
        try {
          const candidates = readSchwanPriceList(new Uint8Array(await file.arrayBuffer()));
          if (load !== priceLoad.current) return;
          setPrices(candidates);
          setPriceMessage(candidates.length ? `${candidates.length} Preisvorschläge gelesen. Eine Zutat eingeben und den passenden Artikel auswählen.` : "Keine verwendbaren Preise gefunden. Bitte die Preisliste prüfen.");
        } catch (error) { if (load === priceLoad.current) setPriceMessage(error instanceof Error ? error.message : "Die Preisliste konnte nicht gelesen werden."); }
      }} /></label>
      <label>Preisstand der Liste<input type="date" value={priceDate} onChange={event => setPriceDate(event.target.value)} /></label>
      <p role="status">{priceMessage}</p>
    </details>
    {rows.map((row, index) => <fieldset className="offer-pricing__ingredient-row offer-pricing__cost-fields" key={row.id}>
      <legend>Ansatz {index + 1}</legend>
      <label>Zutat oder Kostenbestandteil<input value={row.name} onChange={event => update(row.id, { name: event.target.value })} /></label>
      {prices.length > 0 && row.name.trim().length >= 2 ? <div>
        <p>Passende Artikel aus der Preisliste {priceDate ? `vom ${priceDate.split("-").reverse().join(".")}` : "– bitte Preisstand eintragen"}:</p>
        {prices.filter(candidate => candidate.product.toLocaleLowerCase("de-DE").includes(row.name.trim().toLocaleLowerCase("de-DE"))).slice(0, 8).map(candidate => <button type="button" className="secondary-button" key={candidate.row} disabled={!priceDate} onClick={() => {
          update(row.id, { name: candidate.product, reference: "", unit: "", price: candidate.price, supplierOriginalPrice: candidate.price,
            source: `Schwan Preisliste ${priceDate}, Artikel ${candidate.article || "ohne Nummer"}, Zeile ${candidate.row}; ${candidate.unit || "Einheit offen"}, Inhalt ${candidate.content || "offen"}; ungeprüft` });
        }}>{candidate.product} · {candidate.content || "Inhalt offen"} · {candidate.unit || "Einheit offen"} · {candidate.price.replace(".", ",")} €</button>)}
        <p className="helper-text">Nach der Auswahl Nettopreis, Preisbezug und Einheit anhand der Preisliste prüfen und eintragen. Der Treffer ist keine automatische Gleichsetzung mit der Zutat.</p>
      </div> : null}
      <label>Benötigte Menge<input inputMode="decimal" value={row.used} onChange={event => update(row.id, { used: event.target.value })} /></label>
      <label>Menge im Preisbezug<input inputMode="decimal" value={row.reference} onChange={event => update(row.id, { reference: event.target.value })} /></label>
      <label>Einheit für beide Mengen<select value={row.unit} onChange={event => update(row.id, { unit: event.target.value })}>
        <option value="">Bitte wählen</option><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">l</option><option value="Stück">Stück</option>
      </select></label>
      <label>Preis des Preisbezugs netto · EUR<input inputMode="decimal" value={row.price} onChange={event => update(row.id, { price: event.target.value })} /></label>
      {supplierPriceChanged(row) ? <p role="status">Preis manuell geändert; der ursprüngliche Listenpreis war {row.supplierOriginalPrice?.replace(".", ",")} €.</p> : null}
      <label>Quelle oder Schätzgrund<input value={row.source} onChange={event => update(row.id, { source: event.target.value })} /></label>
      {rows.length > 1 ? <button type="button" className="secondary-button" onClick={() => { changed(); setRows(current => current.filter(item => item.id !== row.id)); }}>Ansatz {index + 1} entfernen</button> : null}
    </fieldset>)}
    <button type="button" className="secondary-button" disabled={rows.length >= 100} onClick={() => { changed(); setRows(current => [...current, emptyRow(nextId.current++)]); }}>Weiteren Ansatz hinzufügen</button>
    <p aria-live="polite">{ready ? "Summe der Ansätze: " + (Number(total) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "Summe offen – alle Ansätze und Quellen vollständig ausfüllen."}</p>
    {complete && total !== undefined && total > maximumCents ? <p role="status">Die Summe überschreitet den zulässigen Betrag.</p> : null}
    {complete && source.length > 500 ? <p role="status">Quellenhinweise sind zu lang. Bitte kürzen und die vollständigen Belege separat festhalten.</p> : null}
    <label className="offer-pricing__ingredient-confirm"><input type="checkbox" checked={confirmed} onChange={event => { if (!event.target.checked) changed(); else setConfirmed(true); }} />Alle direkten Kosten dieser Position sind in den Ansätzen enthalten.</label>
    {existingCost?.trim() ? <p className="helper-text">{appliedCents.current !== undefined && existingCents === appliedCents.current
      ? "Die Schätzung wurde in die Kosten übernommen."
      : "Der bisherige Kostenbetrag" + (existingCents === undefined ? "" : " " + (Number(existingCents) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })) + " wird bei der Übernahme ersetzt."}</p> : null}
    <button type="button" disabled={!ready || !confirmed} onClick={() => {
      if (!ready || total === undefined) return;
      onApply((Number(total) / 100).toFixed(2), source);
      appliedCents.current = total;
    }}>Kostensumme als Schätzung übernehmen</button>
  </details>;
}
