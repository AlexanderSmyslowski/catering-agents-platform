import { useEffect, useRef, useState } from "react";
import {
  confirmProductionQuantityOverride,
  fetchProductionQuantityWorkflow,
  previewProductionQuantityOverride,
  type ProductionQuantityWorkflowEdit,
  type ProductionQuantityWorkflowItem,
  type ProductionQuantityWorkflowPreviewResponse
} from "./production-quantity-api.js";

type Props = { caseId?: string };
/** A preview is bound to the case, component, input field and the exact raw
 * value it was computed for; the server additionally binds its previewId. */
type PendingPreview = {
  caseId: string;
  component: ProductionQuantityWorkflowItem;
  inputKey: string;
  inputRaw: string;
  targetLabel: string;
  edit: ProductionQuantityWorkflowEdit;
  response: ProductionQuantityWorkflowPreviewResponse;
};
function numberLabel(value: number | undefined, unit: string | undefined): string {
  return value === undefined ? "offen" : `${value.toLocaleString("de-DE", { maximumSignificantDigits: 15 })} ${unit === "servings" ? "Portionen" : unit ?? ""}`.trim();
}
function amountInput(raw: string | undefined, fallback: number | undefined): number {
  if (raw === undefined) return fallback ?? NaN;
  const text = raw.trim();
  return /^[+]?(?:[0-9]+([.,][0-9]*)?|[.,][0-9]+)$/.test(text) ? Number(text.replace(",", ".")) : NaN;
}
export function ProductionQuantityWorkflowPanel({ caseId }: Props) {
  const [loaded, setLoaded] = useState<{ caseId: string; items: ProductionQuantityWorkflowItem[] }>();
  const items = loaded && loaded.caseId === caseId ? loaded.items : [];
  const loadToken = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState<PendingPreview>();
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  // Every input change, new preview request or case switch advances this
  // token, so a late preview response can never become confirmable.
  const previewToken = useRef(0);
  const currentCaseId = useRef(caseId);
  currentCaseId.current = caseId;
  const invalidatePreview = () => { previewToken.current += 1; setPending(undefined); };

  const reload = async () => {
    const token = ++loadToken.current;
    setLoaded(undefined);
    if (!caseId) { setLoading(false); return; }
    const requestedCaseId = caseId;
    setLoading(true); setError(undefined);
    try {
      const result = await fetchProductionQuantityWorkflow(requestedCaseId);
      if (token === loadToken.current && currentCaseId.current === requestedCaseId) setLoaded({ caseId: requestedCaseId, items: result.items });
    } catch (cause) {
      if (token === loadToken.current && currentCaseId.current === requestedCaseId) setError(cause instanceof Error ? cause.message : "Mengen konnten nicht geladen werden.");
    } finally {
      if (token === loadToken.current && currentCaseId.current === requestedCaseId) setLoading(false);
    }
  };
  useEffect(() => {
    invalidatePreview(); setDraftValues({}); setError(undefined); setNotice(undefined);
    void reload();
  }, [caseId]);

  const changeValue = (key: string, value: string) => {
    // A visible value other than the previewed one must never be confirmed.
    if (pending) setNotice("Die Eingabe wurde geändert. Bitte die Änderung erneut prüfen.");
    invalidatePreview();
    setDraftValues((current) => ({ ...current, [key]: value }));
  };

  const requestPreview = async (input: { item: ProductionQuantityWorkflowItem; inputKey: string; targetLabel: string; edit: ProductionQuantityWorkflowEdit; fallbackError: string }) => {
    if (!caseId || loaded?.caseId !== caseId || !loaded.items.includes(input.item)) return;
    const requestedCaseId = caseId;
    invalidatePreview();
    const token = previewToken.current;
    const inputRaw = draftValues[input.inputKey];
    setError(undefined); setNotice(undefined);
    try {
      const response = await previewProductionQuantityOverride(requestedCaseId, input.item.componentId, input.edit);
      if (token !== previewToken.current || currentCaseId.current !== requestedCaseId) return;
      setPending({ caseId: requestedCaseId, component: input.item, inputKey: input.inputKey, inputRaw: inputRaw ?? "", targetLabel: input.targetLabel, edit: input.edit, response });
    } catch (cause) {
      if (token !== previewToken.current || currentCaseId.current !== requestedCaseId) return;
      setPending(undefined);
      setError(cause instanceof Error ? `${input.fallbackError} ${cause.message}` : input.fallbackError);
    }
  };

  const previewTarget = async (item: ProductionQuantityWorkflowItem) => {
    if (!caseId || !item.currentAuthority) return;
    const inputKey = `target:${item.componentId}`;
    const amount = amountInput(draftValues[inputKey], item.currentAuthority.perUnitAmount);
    if (!Number.isFinite(amount) || amount <= 0) { invalidatePreview(); setError("Bitte eine positive Menge eingeben."); return; }
    const edit: ProductionQuantityWorkflowEdit = { origin: "target_output", perUnitAmount: amount, unit: item.currentAuthority.unit };
    await requestPreview({ item, inputKey, targetLabel: `${numberLabel(amount, item.currentAuthority.unit)} pro Person`, edit, fallbackError: "Mengenvorschau konnte nicht erstellt werden." });
  };
  const previewPurchase = async (item: ProductionQuantityWorkflowItem, rowId: string) => {
    if (!caseId) return;
    const row = item.purchaseRows.find((candidate) => candidate.rowId === rowId);
    if (!row?.editable || !row.lineage) return;
    const inputKey = `purchase:${rowId}`;
    const amount = amountInput(draftValues[inputKey], row.amount);
    if (!Number.isFinite(amount) || amount <= 0) { invalidatePreview(); setError("Bitte eine positive Einkaufsmenge eingeben."); return; }
    const edit: ProductionQuantityWorkflowEdit = { origin: "purchase_ingredient", ingredientId: row.lineage.ingredientId, amount, unit: row.unit };
    await requestPreview({ item, inputKey, targetLabel: `${row.articleName}: ${numberLabel(amount, row.unit)} Einkauf`, edit, fallbackError: "Einkaufsmengen-Vorschau konnte nicht erstellt werden." });
  };
  const pendingMatchesInput = (candidate: PendingPreview | undefined): candidate is PendingPreview =>
    Boolean(candidate && candidate.caseId === caseId && (draftValues[candidate.inputKey] ?? "") === candidate.inputRaw);
  const confirm = async () => {
    if (!caseId || confirming || !pendingMatchesInput(pending) || pending.response.preview.status !== "preview_ready" || !pending.response.preview.confirmable) return;
    const bound = pending;
    setConfirming(true); setError(undefined); setNotice(undefined);
    try {
      const result = await confirmProductionQuantityOverride(bound.caseId, bound.component.componentId, bound.response.previewId, bound.edit);
      if (currentCaseId.current !== bound.caseId) return;
      invalidatePreview(); setDraftValues({});
      setNotice(result.status === "review_required" ? "Mengenänderung gespeichert. Die neue Menge benötigt noch die Küchenfreigabe." : "Mengenänderung übernommen und abhängige Produktionsmengen neu berechnet.");
      await reload();
    } catch (cause) {
      if (currentCaseId.current !== bound.caseId) return;
      // The server may have rejected a stale preview; a fresh check is required.
      invalidatePreview();
      setError(cause instanceof Error ? `Mengenänderung konnte nicht übernommen werden. Bitte die Änderung erneut prüfen. (${cause.message})` : "Mengenänderung konnte nicht übernommen werden. Bitte die Änderung erneut prüfen.");
    } finally {
      setConfirming(false);
    }
  };
  if (!caseId) return null;
  const visiblePending = pendingMatchesInput(pending) ? pending : undefined;
  return <article className="panel secondary-panel" data-testid="production-quantity-workflow">
    <header><h3>Produktionsmengen prüfen und ändern</h3></header>
    <p className="helper-text">Änderungen werden zuerst vollständig vorgerechnet. Rezept und Einkauf bleiben bis zur Bestätigung unverändert.</p>
    {loading ? <p className="helper-text">Mengen werden geladen …</p> : null}
    {notice ? <p className="helper-text" role="status">{notice}</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <ul className="item-list compact">{items.map((item) => <li key={item.componentId}>
      <strong>{item.label}</strong>
      <p>Aktuell: {numberLabel(item.currentAuthority?.perUnitAmount, item.currentAuthority?.unit)} pro Person · Gesamt {numberLabel(item.currentAuthority?.targetAmount, item.currentAuthority?.unit)}</p>
      {item.currentAuthority?.reviewStatus === "kitchen_review_required" ? <p className="helper-text">Bestätigte Mengenänderung · Küchenfreigabe noch erforderlich.</p> : null}
      {item.status === "recommended" ? <p className="helper-text">Empfehlung: {numberLabel(item.recommendedAmount, item.unit)}{item.professionalRange ? ` · professioneller Korridor ${item.professionalRange.min}–${item.professionalRange.max} ${item.professionalRange.unit}` : ""}</p> : <p className="helper-text">{item.reviewMessage ?? "Küchenentscheidung erforderlich."}</p>}
      {item.canEdit && item.currentAuthority ? <div className="quantity-edit-row">
        <label>Menge pro Person ändern<input aria-label={`${item.label} Menge pro Person`} inputMode="decimal" disabled={confirming} value={draftValues[`target:${item.componentId}`] ?? String(item.currentAuthority.perUnitAmount ?? "")} onChange={(event) => changeValue(`target:${item.componentId}`, event.target.value)}/></label>
        <button type="button" disabled={confirming} onClick={() => void previewTarget(item)}>Änderung prüfen</button>
      </div> : null}
      {item.purchaseRows.length > 0 ? <details><summary>Einkaufspositionen</summary><ul className="item-list compact">{item.purchaseRows.map((row) => <li key={row.rowId}>
        <strong>{row.articleName}</strong> · {numberLabel(row.amount, row.unit)}
        {row.editable ? <div className="quantity-edit-row">
          <input aria-label={`${row.articleName} Einkaufsmenge`} inputMode="decimal" disabled={confirming} value={draftValues[`purchase:${row.rowId}`] ?? String(row.amount)} onChange={(event) => changeValue(`purchase:${row.rowId}`, event.target.value)}/>
          <button type="button" disabled={confirming} onClick={() => void previewPurchase(item, row.rowId)}>Einkaufsmenge prüfen</button>
        </div> : <p className="helper-text">{row.readOnlyReason}</p>}
      </li>)}</ul></details> : null}
    </li>)}</ul>
    {visiblePending ? <section aria-label="Mengenvorschau">
      <h4>Auswirkung der Änderung: {visiblePending.component.label}</h4>
      <p className="helper-text">Geprüfter Wert: {visiblePending.targetLabel}</p>
      {visiblePending.response.preview.status === "preview_ready" ? <>
        <p>Neu: {numberLabel(visiblePending.response.preview.resultingTarget?.amount, visiblePending.response.preview.resultingTarget?.unit)} · Faktor {visiblePending.response.preview.scaleFactor?.toLocaleString("de-DE", { maximumFractionDigits: 4 })}</p>
        <ul className="item-list compact">{(visiblePending.response.preview.recipeChanges ?? []).map((change) => <li key={change.ingredientId}>{change.name}: {numberLabel(change.previousAmount, change.unit)} → {numberLabel(change.effectiveAmount, change.unit)}</li>)}</ul>
        {(visiblePending.response.preview.appliedRuleIds ?? []).length > 0 ? <details className="technical-context-details">
          <summary>Freigegebene nichtlineare Regeln berücksichtigt ({visiblePending.response.preview.appliedRuleIds?.length})</summary>
          <p className="helper-text">{visiblePending.response.preview.appliedRuleIds?.join(", ")}</p>
        </details> : null}
        <p className="helper-text">Die neue Menge benötigt eine neue Küchenfreigabe. Der bisher freigegebene Produktionsstand bleibt bis dahin erhalten.</p>
        <button type="button" disabled={confirming || !visiblePending.response.preview.confirmable} onClick={() => void confirm()}>{confirming ? "Wird übernommen …" : "Änderung übernehmen"}</button>
      </> : <p className="form-error">Änderung kann nicht bestätigt werden: {(visiblePending.response.preview.issues ?? []).join(", ")}</p>}
      <button type="button" className="secondary-button" disabled={confirming} onClick={invalidatePreview}>Abbrechen</button>
    </section> : null}
  </article>;
}
