import { useEffect, useId, useRef, useState } from "react";
import type { OfferCalculationLineInput, PricingSummary } from "@catering/shared-core";
import { calculateOfferPricing, parseOfferDirectCost, summarizeOfferDirectCosts } from "../../shared-core/src/offer-calculation.js";
import { reviseOfferPricing } from "./api.js";

type Row = Omit<OfferCalculationLineInput, "unitNetCents" | "taxRateBps" | "directCost"> & {
  net: string; tax: string; costNet?: string; costBasis?: "documented" | "estimated"; costReference?: string; costDate?: string; costEstimateDate?: string;
};
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
function localDate(): string {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}
function parseRowDirectCost({ costNet, costBasis, costReference, costDate, costEstimateDate }: Pick<Row, "costNet" | "costBasis" | "costReference" | "costDate" | "costEstimateDate">): OfferCalculationLineInput["directCost"] {
  if (!costNet?.trim()) return undefined;
  return parseOfferDirectCost({
    totalNetCents: hundredths(costNet, "Direkte Kosten gesamt"),
    basis: costBasis ?? "estimated", sourceReference: costReference?.trim() ?? "",
    ...(costDate ? { priceDate: costDate } : {}),
    ...((costBasis ?? "estimated") === "estimated" ? { estimateDate: costEstimateDate ?? localDate() } : {})
  });
}
function costInputStatus(row: Row): string {
  try {
    const cost = parseRowDirectCost(row);
    return !cost ? "Kosten offen" : cost.basis === "documented" ? "Belegpreis" : "Geschätzt";
  } catch {
    return "Kostenangabe prüfen";
  }
}
function inputLines(rows: Row[], costErrors?: string[]): OfferCalculationLineInput[] {
  return rows.map(({ net, tax, taxReason, zeroPriceReason, costNet, costBasis, costReference, costDate, costEstimateDate, ...row }) => {
    let directCost: OfferCalculationLineInput["directCost"];
    try {
      directCost = parseRowDirectCost({ costNet, costBasis, costReference, costDate, costEstimateDate });
    } catch (cause) {
      const message = row.label + ": " + (cause instanceof Error ? cause.message : "Kostenangabe prüfen.");
      if (costErrors) costErrors.push(message);
      else throw new Error(message);
    }
    return {
      ...row, quantity: row.quantity.trim().replace(",", "."),
      unitNetCents: hundredths(net, row.label + " – Netto-Einzelpreis"),
      ...(tax.trim() ? { taxRateBps: hundredths(tax, row.label + " – Steuer in %") } : {}),
      ...(taxReason?.trim() ? { taxReason: taxReason.trim() } : {}),
      ...(zeroPriceReason?.trim() ? { zeroPriceReason: zeroPriceReason.trim() } : {}),
      ...(directCost ? { directCost } : {})
    };
  });
}
export function OfferPricingEditor({ draftId, revision, variants, menuPlan, pricingSummary, disabled, onSaved, onEditingChange }: {
  draftId: string; revision: number; variants: Array<{ variantId: string; label: string; guests: number; menuPlan?: Array<Record<string, unknown>> }>;
  menuPlan: Array<Record<string, unknown>>; pricingSummary?: PricingSummary;
  disabled: boolean; onSaved: (draftId: string) => Promise<void>; onEditingChange: (editing: boolean) => void;
}) {
  const [rows, setRows] = useState<Row[]>();
  const [variantId, setVariantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingSavedDraft, setPendingSavedDraft] = useState<string>();
  const frozen = saving || Boolean(pendingSavedDraft);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const live = useRef(true);
  const submitting = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fieldId = useId();
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const variant = variants.find(item => item.variantId === variantId);
  const calculation = pricingSummary?.calculation;
  function begin() {
    setVariantId(calculation && variants.length === 1 ? variants[0]!.variantId : "");
    setRows(calculation ? calculation.lines.map(({ netCents: _net, unitNetCents, taxRateBps, directCost, ...line }) => ({
      ...line, net: (unitNetCents / 100).toFixed(2), tax: taxRateBps === undefined ? "" : String(taxRateBps / 100),
      ...(directCost ? { costNet: (directCost.totalNetCents / 100).toFixed(2), costBasis: directCost.basis,
        costReference: directCost.sourceReference, costDate: directCost.priceDate ?? "", costEstimateDate: directCost.estimateDate } : {})
    })) : [{
      id: "food", label: "Speisen-Grundpaket – vollständiges Menü", category: "food", quantity: "",
      unit: "guest", net: "", tax: "", sourceKind: "app_transfer", sourceReference: reference
    }]);
    setError(""); setNotice(""); onEditingChange(true);
  }
  function update(index: number, patch: Partial<Row>) {
    setError("");
    setRows(current => current?.map((row, at) => {
      if (at !== index) return row;
      const next = { ...row, ...patch };
      if (row.costBasis === "documented" && (
        (patch.costNet !== undefined && patch.costNet !== row.costNet)
        || (patch.quantity !== undefined && patch.quantity !== row.quantity)
        || (patch.label !== undefined && patch.label !== row.label)
      )) {
        next.costBasis = "estimated";
      }
      if (next.costNet?.trim() && (next.costBasis ?? "estimated") === "estimated"
        && patch.costEstimateDate === undefined && ["costNet", "costBasis", "quantity", "label"]
          .some(key => key in patch && patch[key as keyof Row] !== row[key as keyof Row])) {
        next.costEstimateDate = localDate();
      }
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
  const costPreviewErrors: string[] = [];
  if (rows && variant) {
    try { preview = calculateOfferPricing({ lines: inputLines(rows, costPreviewErrors) }, variant.guests); }
    catch (cause) { previewError = cause instanceof Error ? cause.message : "Angaben unvollständig."; }
  }
  async function save() {
    if (!rows || submitting.current || disabled || pendingSavedDraft) return;
    let postedDraftId: string | undefined;
    try {
      if (!variant) throw new Error("Bitte zuerst die Angebotsvariante wählen.");
      const lines = inputLines(rows);
      calculateOfferPricing({ lines }, variant.guests);
      submitting.current = true; setSaving(true); setError("");
      const saved = await reviseOfferPricing(draftId, revision, variantId, lines);
      if (!live.current) return;
      postedDraftId = saved.draftId;
      setPendingSavedDraft(saved.draftId);
      await onSaved(saved.draftId);
      if (!live.current) return;
      setRows(undefined); setPendingSavedDraft(undefined); onEditingChange(false);
    } catch (cause) {
      if (!live.current) return;
      setError(postedDraftId
        ? "Die neue Fassung wurde gespeichert. Die Ansicht konnte nicht aktualisiert werden. Bitte die gespeicherte Fassung laden."
        : cause instanceof Error ? cause.message : "Preisaufstellung konnte nicht gespeichert werden.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      submitting.current = false;
      if (live.current) setSaving(false);
    }
  }
  async function reloadSaved() {
    if (!pendingSavedDraft || submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      await onSaved(pendingSavedDraft);
      if (!live.current) return;
      setRows(undefined); setPendingSavedDraft(undefined); onEditingChange(false);
    } catch {
      if (live.current) {
        setError("Die Fassung bleibt gespeichert. Sie konnte noch nicht geladen werden. Bitte später erneut versuchen oder den Zugriff auf den Auftrag prüfen.");
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      submitting.current = false;
      if (live.current) setSaving(false);
    }
  }
  function closeSaved() {
    setRows(undefined); setPendingSavedDraft(undefined); setError(""); onEditingChange(false);
    setNotice("Die Fassung bleibt gespeichert. Bitte den Auftrag später erneut laden.");
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
  function directCosts(summary?: PricingSummary) {
    const c = summary?.calculation;
    if (!c) return null;
    const costs = summarizeOfferDirectCosts(c);
    return <section aria-label="Interne Kosten und Deckungsbeitrag">
      <h4>Interne Kosten</h4>
      <dl className="offer-pricing__totals">
        <div><dt>Erfasste direkte Kosten netto</dt><dd>{money(costs.enteredNetCents)}</dd></div>
        <div><dt>Deckungsbeitrag vor Gemeinkosten{costs.status === "estimated" ? " · vorläufig" : ""}</dt><dd>{costs.contributionNetCents === undefined ? "Noch unvollständig" : money(costs.contributionNetCents)}</dd></div>
      </dl>
      <p className="helper-text">Verkauf netto minus direkte Kosten der erfassten Positionen. Weitere Gemeinkosten sind nicht berücksichtigt; der Betrag ist kein Gewinn.</p>
      {costs.missingLineIds.length ? <p role="status">Kosten offen: {c.lines.filter(line => costs.missingLineIds.includes(line.id)).map(line => line.label).join(", ")}. Fehlende Kosten werden nicht als null gerechnet.</p> : null}
      {costs.estimatedLineIds.length ? <p role="status">Enthält geschätzte Kosten – Preisstand prüfen.{costs.status === "estimated" ? " Deckungsbeitrag vorläufig." : ""}</p> : null}
      {costs.status === "documented" ? <p className="helper-text">Belegpreise laut Eingabe. Preisstand und Gültigkeit für diesen Auftrag prüfen.</p> : null}
    </section>;
  }
  return <section className="offer-pricing" aria-label="Preisaufstellung">
    <h3>Preisaufstellung</h3>
    <p className="helper-text">Speisenpaket für das gesamte Menü; Personal, Logistik und Zusatzleistungen separat. Verkaufspreise netto. Interne direkte Kosten können getrennt ergänzt werden; Schätzungen sind möglich.</p>
    {rows ? <>
      <label>Zu kalkulierende Variante<select disabled={frozen} value={variantId} onChange={event => {
        const selected = variants.find(item => item.variantId === event.target.value);
        setVariantId(event.target.value); setError("");
        setRows(current => current?.map(row => row.unit === "guest" ? {
          ...row, quantity: selected ? String(selected.guests) : "",
          ...(row.costNet?.trim() && row.quantity !== (selected ? String(selected.guests) : "") ? { costBasis: "estimated" as const, costEstimateDate: localDate() } : {})
        } : row));
      }}><option value="">Bitte wählen</option>{variants.map(item => <option key={item.variantId} value={item.variantId}>{item.label} · {item.guests} Gäste</option>)}</select></label>
      <p className="helper-text">Speisen-Grundpaket umfasst: {(variant?.menuPlan ?? menuPlan).map(item => String(item.label) + " (" + String(item.servings ?? "offen") + " Portionen)").join(", ")}.</p>
      {rows.map((row, index) => <fieldset className="offer-pricing__fields" key={row.id} disabled={frozen}>
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
        <details className="offer-pricing__cost-input">
          <summary>Interne Kosten · {costInputStatus(row)}</summary>
          <p className="helper-text" id={fieldId + "-cost-" + row.id}>Gesamtkosten dieser Position, nicht je Gast oder Stunde. {row.category === "food" ? "Zutaten und weitere zugehörige Kosten addieren; separate Leistungen nicht doppelt zählen. " : ""}Fehlende Beträge schätzen; ist keine Gesamtschätzung möglich, Feld leer lassen. Bei Mengenänderung werden die Kosten nicht automatisch angepasst.</p>
          <div className="offer-pricing__cost-fields">
            <label>Kosten gesamt netto · EUR<input inputMode="decimal" value={row.costNet ?? ""} aria-describedby={fieldId + "-cost-" + row.id + " " + fieldId + "-cost-source-" + row.id} onChange={event => update(index, { costNet: event.target.value })} /></label>
            <label>Kostengrundlage<select value={row.costBasis ?? "estimated"} onChange={event => update(index, { costBasis: event.target.value as Row["costBasis"] })}>
              <option value="estimated">Geschätzt / älterer Preis</option>
              <option value="documented">Belegpreis · für Auftrag geprüft</option>
            </select></label>
            <div>
              <label>Beleg oder Schätzgrund<input value={row.costReference ?? ""} aria-describedby={fieldId + "-cost-source-" + row.id} onChange={event => update(index, { costReference: event.target.value })} /></label>
              <p className="helper-text" id={fieldId + "-cost-source-" + row.id}>Brutto nicht als Netto eintragen. Ältere oder unsichere Preise als Schätzung mit Quelle kennzeichnen.</p>
            </div>
            {(row.costBasis ?? "estimated") === "estimated" ? <label>Schätzstand · Datum der Schätzung<input type="date" value={row.costEstimateDate ?? localDate()} onChange={event => update(index, { costEstimateDate: event.target.value })} /></label> : null}
            <label>Preisstand · Datum, falls bekannt<input type="date" value={row.costDate ?? ""} onChange={event => update(index, { costDate: event.target.value })} /></label>
          </div>
          {row.costBasis === "documented" ? <p className="helper-text">Nur wählen, wenn Beleg und Gültigkeit für diesen Auftrag geprüft sind. Ein Preisdatum ist dafür erforderlich.</p> : null}
        </details>
        {row.tax.trim() && Number(row.tax.replace(",", ".")) === 0 ? <label>Begründung für 0 % Steuer<input value={row.taxReason ?? ""} onChange={event => update(index, { taxReason: event.target.value })} /></label> : null}
        {row.net.trim() && Number(row.net.replace(",", ".")) === 0 ? <label>Begründung für enthaltene/kostenfreie Leistung<input value={row.zeroPriceReason ?? ""} onChange={event => update(index, { zeroPriceReason: event.target.value })} /></label> : null}
        {row.category !== "food" ? <button type="button" className="secondary-button" onClick={() => setRows(current => current?.filter(item => item.id !== row.id))}>Leistung entfernen</button> : null}
      </fieldset>)}
      <p className="helper-text">Leistungen ergänzen. Vorbelegte Preise und Quellen vor der Angebotsfreigabe prüfen.</p>
      <div className="quiet-action-row">{templates.map(template => <button key={template.id} type="button" className="secondary-button" disabled={frozen || rows.some(row => row.id === template.id)} onClick={() => setRows(current => [...(current ?? []), {
        id: template.id, label: template.label, category: template.category, unit: template.unit,
        quantity: template.unit === "guest" ? String(variant?.guests ?? "") : template.unit === "flat" ? "1" : "",
        net: (template.cents / 100).toFixed(2), tax: "", sourceKind: template.id === "staff" ? "operator" : "app_transfer", sourceReference: template.id === "staff" ? confirmedServiceRateReference : reference
      }])}>{template.label}</button>)}</div>
      <p className="helper-text">Personenstunden = Personen × Einsatzstunden, getrennt für Service und Küche. Steuer wird nicht vorbelegt.</p>
      <p className="helper-text">Vorschau – maßgeblich ist die gespeicherte Berechnung. {previewError}</p>
      {costPreviewErrors.length ? <p role="status">{costPreviewErrors.join(" ")} Bitte ergänzen oder den Kostenbetrag leer lassen.</p> : null}
      {totals(preview)}
      {directCosts(preview)}
      {preview?.calculation?.missingTaxLineIds.length ? <p role="status">Steuerfestlegung unvollständig: Speichern möglich, Freigabe gesperrt. Brutto bleibt offen.</p> : null}
      <div className="quiet-action-row">
        {pendingSavedDraft ? <>
          <button type="button" disabled={saving} onClick={() => void reloadSaved()}>{saving ? "Wird geladen …" : "Gespeicherte Fassung laden"}</button>
          <button type="button" className="secondary-button" disabled={saving} onClick={closeSaved}>Bearbeitung schließen</button>
        </> : <>
          <button type="button" disabled={saving || disabled} onClick={() => void save()}>{saving ? "Wird gespeichert …" : "Preisaufstellung als neue Fassung speichern"}</button>
          <button type="button" className="secondary-button" disabled={saving} onClick={() => { setRows(undefined); setError(""); onEditingChange(false); }}>Verwerfen</button>
        </>}
      </div>
    </> : calculation ? <>
      <p className="helper-text">{calculation.missingTaxLineIds.length ? "Unvollständig – Steuerfestlegung fehlt; Freigabe gesperrt." : "Verkaufspreise und Steuer erfasst – fachliche Prüfung weiterhin erforderlich."}</p>
      {calculation.containsSynthetic ? <p role="status">Enthält synthetische Testannahmen – keine Unternehmenspreise.</p> : null}
      {totals(pricingSummary)}
      {directCosts(pricingSummary)}
      <ul className="item-list compact">{calculation.lines.map(line => <li key={line.id}>
        {line.label}: {line.quantity} {Number(line.quantity) === 1 ? singularUnitLabels[line.unit] : unitLabels[line.unit]} × {money(line.unitNetCents)} = {money(line.netCents)} netto · Steuer {line.taxRateBps === undefined ? "offen" : line.taxRateBps / 100 + " %"} · Quelle: {line.sourceReference}{line.sourceKind === "synthetic" ? " · synthetisch" : " · prüfpflichtig"}
        {line.directCost ? <p>Direkte Kosten gesamt: {money(line.directCost.totalNetCents)} · {line.directCost.basis === "estimated" ? "Geschätzt" : "Belegpreis"} · {line.directCost.sourceReference} · Preisstand: {line.directCost.priceDate ?? "nicht bekannt"}{line.directCost.estimateDate ? " · Schätzstand: " + line.directCost.estimateDate : ""}</p> : <p>Kosten offen</p>}
      </li>)}</ul>
      <button type="button" className="secondary-button" disabled={disabled} onClick={begin}>Preisaufstellung bearbeiten</button>
    </> : <>
      {pricingSummary?.calculationRequired ? <p role="status">Angebot geändert – Preisaufstellung veraltet. Vor Freigabe neu kalkulieren.</p> : null}
      <p className="helper-text">Preis offen. Katalogrichtwerte sind keine geprüften Angebotspreise. Preisaufstellung mit Leistungsumfang, Quellen, Netto, Steuer und Brutto erfassen.</p>
      <button type="button" className="secondary-button" disabled={disabled} onClick={begin}>Preisaufstellung erfassen</button>
    </>}
    {error ? <p role="alert" tabIndex={-1} ref={errorRef}>{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </section>;
}
