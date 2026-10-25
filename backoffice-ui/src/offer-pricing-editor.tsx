import { useEffect, useId, useRef, useState } from "react";
import type { OfferCalculationLineInput, PricingSummary } from "@catering/shared-core";
import { calculateOfferPricing } from "../../shared-core/src/offer-calculation.js";
import { reviseOfferPricing } from "./api.js";

type Row = Omit<OfferCalculationLineInput, "unitNetCents" | "taxRateBps"> & { net: string; tax: string };
const reference = "App-Transfer Angebotsrechner 0.6 (2026-06-01), Arbeitswerte – prüfen";
const confirmedServiceRateCents = 4555;
const confirmedServiceRateReference = "Betreiberbestätigung vom 25.10.2026: aktueller Service-Stundensatz; Erhöhungsstichtag offen";
const templates = [
  { id: "delivery", label: "Lieferung & Abholung", category: "logistics", unit: "flat", cents: 15000 },
  { id: "setup", label: "Aufbau & Abbau", category: "logistics", unit: "flat", cents: 12000 },
  { id: "staff", label: "Servicepersonal – Personenstunden gesamt", category: "staff", unit: "hour", cents: confirmedServiceRateCents },
  { id: "kitchen", label: "Küchenpersonal – Personenstunden gesamt", category: "staff", unit: "hour", cents: 5500 },
  { id: "equipment", label: "Equipment / Table Top", category: "equipment", unit: "guest", cents: 850 },
  { id: "drinks", label: "Getränke", category: "drinks", unit: "guest", cents: 800 }
] as const;
const singularUnitLabels = { guest: "Gast", hour: "Personenstunde", flat: "Pauschale", piece: "Stück" };
const unitLabels = { guest: "Gäste", hour: "Personenstunden", flat: "Pauschalen", piece: "Stück" };
const money = (cents: number | undefined) => cents === undefined ? "Noch offen" :
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

function hundredths(raw: string, label: string): number {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) throw new Error(label + ": Zahl mit höchstens zwei Nachkommastellen erforderlich.");
  const [whole, fraction = ""] = normalized.split(".");
  return Number(BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0")));
}
function inputLines(rows: Row[]): OfferCalculationLineInput[] {
  return rows.map(({ net, tax, taxReason, zeroPriceReason, ...row }) => ({
    ...row, quantity: row.quantity.trim().replace(",", "."),
    unitNetCents: hundredths(net, row.label + " – Netto-Einzelpreis"),
    ...(tax.trim() ? { taxRateBps: hundredths(tax, row.label + " – Steuer in %") } : {}),
    ...(taxReason?.trim() ? { taxReason: taxReason.trim() } : {}),
    ...(zeroPriceReason?.trim() ? { zeroPriceReason: zeroPriceReason.trim() } : {})
  }));
}
export function OfferPricingEditor({ draftId, revision, variants, menuPlan, pricingSummary, disabled, onSaved, onEditingChange }: {
  draftId: string; revision: number; variants: Array<{ variantId: string; label: string; guests: number; menuPlan?: Array<Record<string, unknown>> }>;
  menuPlan: Array<Record<string, unknown>>; pricingSummary?: PricingSummary;
  disabled: boolean; onSaved: (draftId: string) => Promise<void>; onEditingChange: (editing: boolean) => void;
}) {
  const [rows, setRows] = useState<Row[]>();
  const [variantId, setVariantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const live = useRef(true);
  const submitting = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fieldId = useId();
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const variant = variants.find(item => item.variantId === variantId);
  const calculation = pricingSummary?.calculation;
  const costReadOnly = calculation?.lines.some(line => line.directCost !== undefined) ?? false;
  function begin() {
    setVariantId(calculation && variants.length === 1 ? variants[0]!.variantId : "");
    setRows(calculation ? calculation.lines.map(({ netCents: _net, unitNetCents, taxRateBps, ...line }) => ({
      ...line, net: (unitNetCents / 100).toFixed(2), tax: taxRateBps === undefined ? "" : String(taxRateBps / 100)
    })) : [{
      id: "food", label: "Speisen-Grundpaket – vollständiges Menü", category: "food", quantity: "",
      unit: "guest", net: "", tax: "", sourceKind: "app_transfer", sourceReference: reference
    }]);
    setError(""); onEditingChange(true);
  }
  function update(index: number, patch: Partial<Row>) {
    setRows(current => current?.map((row, at) => {
      if (at !== index) return row;
      const next = { ...row, ...patch };
      if (row.id === "staff" && row.sourceReference === confirmedServiceRateReference && patch.net !== undefined) {
        let confirmedAmount = false;
        try { confirmedAmount = hundredths(patch.net, row.label) === confirmedServiceRateCents; } catch { /* An incomplete price is an unconfirmed edit too. */ }
        if (!confirmedAmount) next.sourceReference = "Manuell geänderter Service-Stundensatz – Preisquelle prüfen";
      }
      return next;
    }));
  }
  let preview: PricingSummary | undefined;
  let previewError = "";
  if (rows && variant) {
    try { preview = calculateOfferPricing({ lines: inputLines(rows) }, variant.guests); }
    catch (cause) { previewError = cause instanceof Error ? cause.message : "Angaben unvollständig."; }
  }
  async function save() {
    if (!rows || submitting.current || disabled) return;
    try {
      if (!variant) throw new Error("Bitte zuerst die Angebotsvariante wählen.");
      const lines = inputLines(rows);
      calculateOfferPricing({ lines }, variant.guests);
      submitting.current = true; setSaving(true); setError("");
      const saved = await reviseOfferPricing(draftId, revision, variantId, lines);
      if (!live.current) return;
      await onSaved(saved.draftId);
      if (!live.current) return;
      setRows(undefined); onEditingChange(false);
    } catch (cause) {
      if (!live.current) return;
      setError(cause instanceof Error ? cause.message : "Preisaufstellung konnte nicht gespeichert werden.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      submitting.current = false;
      if (live.current) setSaving(false);
    }
  }
  function totals(summary?: PricingSummary) {
    const c = summary?.calculation;
    return <dl className="offer-pricing__totals" aria-live={rows ? "polite" : undefined}>
      <div><dt>Netto gesamt</dt><dd>{money(c?.netCents)}</dd></div>
      {c?.taxGroups.map(group => <div key={group.rateBps}><dt>Steuer {group.rateBps / 100} %</dt><dd>{money(group.taxCents)}</dd></div>)}
      <div><dt>Brutto gesamt</dt><dd>{money(c?.grossCents)}</dd></div>
      <div><dt>Netto je Gast · gerundet</dt><dd>{summary?.perPerson ? money(Math.round(summary.perPerson.amount * 100)) : "Noch offen"}</dd></div>
    </dl>;
  }
  return <section className="offer-pricing" aria-label="Preisaufstellung">
    <h3>Preisaufstellung</h3>
    <p className="helper-text">Speisenpaket für das gesamte Menü; Personal, Logistik und Zusatzleistungen separat. Verkaufspreise netto. Diese Ansicht zeigt keine internen Kosten oder Margen.</p>
    {costReadOnly ? <p role="status">Interne Kosten sind gespeichert und werden in dieser Version nicht angezeigt. Zum Bearbeiten der Preisaufstellung ist die Version mit Kostenerfassung erforderlich. Freigabe und Produktionsübergabe dieser Fassung sind hier nicht möglich. Die gespeicherten Daten bleiben erhalten. Menü- oder Veranstaltungsänderungen legen eine neue Fassung ohne Preisaufstellung an; die Kosten bleiben in der Ursprungsfassung erhalten.</p> : null}
    {rows ? <>
      <label>Zu kalkulierende Variante<select disabled={saving} value={variantId} onChange={event => {
        const selected = variants.find(item => item.variantId === event.target.value);
        setVariantId(event.target.value);
        setRows(current => current?.map(row => row.unit === "guest" ? { ...row, quantity: selected ? String(selected.guests) : "" } : row));
      }}><option value="">Bitte wählen</option>{variants.map(item => <option key={item.variantId} value={item.variantId}>{item.label} · {item.guests} Gäste</option>)}</select></label>
      <p className="helper-text">Speisen-Grundpaket umfasst: {(variant?.menuPlan ?? menuPlan).map(item => String(item.label) + " (" + String(item.servings ?? "offen") + " Portionen)").join(", ")}.</p>
      {rows.map((row, index) => <fieldset className="offer-pricing__fields" key={row.id} disabled={saving}>
        <legend>{index + 1}. {row.label}</legend>
        <label>Leistung<input value={row.label} onChange={event => update(index, { label: event.target.value })} /></label>
        <label>{unitLabels[row.unit]}<input inputMode="decimal" value={row.quantity} readOnly={row.category === "food"} onChange={event => update(index, { quantity: event.target.value })} /></label>
        <div>
          <label>Einzelpreis netto · EUR<input inputMode="decimal" value={row.net} aria-describedby={row.id === "staff" && row.sourceKind === "operator" && row.sourceReference === confirmedServiceRateReference ? fieldId + "-service-rate" : undefined} onChange={event => update(index, { net: event.target.value })} /></label>
          {row.id === "staff" && row.sourceKind === "operator" && row.sourceReference === confirmedServiceRateReference ? <p className="helper-text" id={fieldId + "-service-rate"}>{money(confirmedServiceRateCents)} netto je Personenstunde – bestätigter aktueller Stundensatz. Für frühere Leistungszeiträume den damaligen Beleg prüfen.</p> : null}
        </div>
        <label>Steuerfestlegung · %<input inputMode="decimal" value={row.tax} onChange={event => update(index, { tax: event.target.value })} placeholder="Offen" /></label>
        <label>Preisquelle<select value={row.sourceKind} onChange={event => update(index, { sourceKind: event.target.value as Row["sourceKind"] })}>
          <option value="app_transfer">Historische Angebotsgrundlage · prüfen</option>
          <option value="operator">Angabe durch Bearbeiter · prüfen</option>
          <option value="synthetic">Synthetische Testannahme</option>
        </select></label>
        <label>Quellenreferenz<input value={row.sourceReference} onChange={event => update(index, { sourceReference: event.target.value })} /></label>
        {row.tax.trim() && Number(row.tax.replace(",", ".")) === 0 ? <label>Begründung für 0 % Steuer<input value={row.taxReason ?? ""} onChange={event => update(index, { taxReason: event.target.value })} /></label> : null}
        {row.net.trim() && Number(row.net.replace(",", ".")) === 0 ? <label>Begründung für enthaltene/kostenfreie Leistung<input value={row.zeroPriceReason ?? ""} onChange={event => update(index, { zeroPriceReason: event.target.value })} /></label> : null}
        {row.category !== "food" ? <button type="button" className="secondary-button" onClick={() => setRows(current => current?.filter(item => item.id !== row.id))}>Leistung entfernen</button> : null}
      </fieldset>)}
      <p className="helper-text">Leistungen ergänzen. Vorbelegte Preise und Quellen vor der Angebotsfreigabe prüfen.</p>
      <div className="quiet-action-row">{templates.map(template => <button key={template.id} type="button" className="secondary-button" disabled={saving || rows.some(row => row.id === template.id)} onClick={() => setRows(current => [...(current ?? []), {
        id: template.id, label: template.label, category: template.category, unit: template.unit,
        quantity: template.unit === "guest" ? String(variant?.guests ?? "") : template.unit === "flat" ? "1" : "",
        net: (template.cents / 100).toFixed(2), tax: "", sourceKind: template.id === "staff" ? "operator" : "app_transfer", sourceReference: template.id === "staff" ? confirmedServiceRateReference : reference
      }])}>{template.label}</button>)}</div>
      <p className="helper-text">Personenstunden = Personen × Einsatzstunden, getrennt für Service und Küche. Steuer wird nicht vorbelegt.</p>
      <p className="helper-text">Vorschau – maßgeblich ist die gespeicherte Berechnung. {previewError}</p>
      {totals(preview)}
      {preview?.calculation?.missingTaxLineIds.length ? <p role="status">Steuerfestlegung unvollständig: Speichern möglich, Freigabe gesperrt. Brutto bleibt offen.</p> : null}
      <div className="quiet-action-row">
        <button type="button" disabled={saving || disabled} onClick={() => void save()}>{saving ? "Wird gespeichert …" : "Preisaufstellung als neue Fassung speichern"}</button>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => { setRows(undefined); setError(""); onEditingChange(false); }}>Verwerfen</button>
      </div>
    </> : calculation ? <>
      <p className="helper-text">{calculation.missingTaxLineIds.length ? "Unvollständig – Steuerfestlegung fehlt; Freigabe gesperrt." : "Vollständig erfasst – fachliche Preis-/Steuerprüfung weiterhin erforderlich."}</p>
      {calculation.containsSynthetic ? <p role="status">Enthält synthetische Testannahmen – keine Unternehmenspreise.</p> : null}
      {totals(pricingSummary)}
      <ul className="item-list compact">{calculation.lines.map(line => <li key={line.id}>
        {line.label}: {line.quantity} {Number(line.quantity) === 1 ? singularUnitLabels[line.unit] : unitLabels[line.unit]} × {money(line.unitNetCents)} = {money(line.netCents)} netto · Steuer {line.taxRateBps === undefined ? "offen" : line.taxRateBps / 100 + " %"} · Quelle: {line.sourceReference}{line.sourceKind === "synthetic" ? " · synthetisch" : " · prüfpflichtig"}
      </li>)}</ul>
      <button type="button" className="secondary-button" disabled={disabled || costReadOnly} onClick={begin}>Preisaufstellung bearbeiten</button>
    </> : <>
      {pricingSummary?.calculationRequired ? <p role="status">Angebot geändert – Preisaufstellung veraltet. Vor Freigabe neu kalkulieren.</p> : null}
      <p className="helper-text">Preis offen. Katalogrichtwerte sind keine geprüften Angebotspreise. Preisaufstellung mit Leistungsumfang, Quellen, Netto, Steuer und Brutto erfassen.</p>
      <button type="button" className="secondary-button" disabled={disabled} onClick={begin}>Preisaufstellung erfassen</button>
    </>}
    {error ? <p role="alert" tabIndex={-1} ref={errorRef}>{error}</p> : null}
  </section>;
}
