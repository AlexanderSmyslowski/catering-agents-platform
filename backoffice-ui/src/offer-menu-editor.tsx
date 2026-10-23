import { useEffect, useRef, useState } from "react";
import { reviseOfferMenu, type OfferMenuEditItem } from "./api.js";

type Row = Omit<OfferMenuEditItem, "servings"> & { servings: string };

export function OfferMenuEditor({ draftId, revision, menuPlan, onSaved, disabled, onEditingChange }: {
  draftId: string;
  revision: number;
  menuPlan: Array<Record<string, unknown>>;
  onSaved: (draftId: string) => Promise<void>;
  disabled: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [rows, setRows] = useState<Row[] | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function begin() {
    setRows(menuPlan.map((item) => ({
      componentId: typeof item.componentId === "string" ? item.componentId : undefined,
      label: String(item.label ?? ""),
      servings: item.servings === undefined ? "" : String(item.servings),
      menuCategory: item.menuCategory as Row["menuCategory"],
      dietaryTags: Array.isArray(item.dietaryTags) ? item.dietaryTags as string[] : undefined
    })));
    setError(""); setNotice(""); onEditingChange(true);
  }
  function update(index: number, patch: Partial<Row>) {
    setRows((previous) => previous?.map((row, at) => at === index ? { ...row, ...patch } : row));
  }
  async function save() {
    if (!rows || saving) return;
    if (rows.length === 0 || rows.some((row) => !row.label.trim() || !row.servings.trim() || !Number.isFinite(Number(row.servings)) || Number(row.servings) <= 0)) {
      setError("Bitte für jedes Gericht einen Namen und eine positive Portionszahl angeben."); return;
    }
    setSaving(true); setError("");
    try {
      const draft = await reviseOfferMenu(draftId, revision, rows.map((row) => ({ ...row, servings: Number(row.servings) })));
      if (!live.current) return;
      await onSaved(draft.draftId);
      if (!live.current) return;
      setRows(undefined); onEditingChange(false);
      setNotice("Menü als neue Angebotsfassung gespeichert. Bitte erneut prüfen und freigeben.");
    } catch (cause) {
      if (!live.current) return;
      setError(cause instanceof Error ? cause.message : "Menü konnte nicht gespeichert werden.");
    } finally { if (live.current) setSaving(false); }
  }
  return <section aria-label="Menü und Portionszahlen">
    <h3>Menü und Portionszahlen</h3>
    <p className="helper-text">Die Portionen gehören zum jeweiligen Gericht. Ernährungsgruppen sind keine zusätzlichen Gäste. Allergene und Kalkulation separat prüfen.</p>
    {rows ? <>
      {rows.map((row, index) => <div className="compact-form-grid" key={index}>
        <label>Gericht {index + 1}<input className="operator-input" value={row.label} disabled={saving} onChange={(event) => update(index, { label: event.target.value })} /></label>
        <label>Portionen {index + 1}<input className="operator-input" type="number" min="0.01" step="any" value={row.servings} disabled={saving} onChange={(event) => update(index, { servings: event.target.value })} /></label>
        <label>Ernährungsart {index + 1}<select className="operator-input" value={row.menuCategory ?? ""} disabled={saving} onChange={(event) => {
          const category = event.target.value as Row["menuCategory"];
          update(index, { menuCategory: category || undefined, dietaryTags: category === "vegan" ? ["vegan"] : category === "vegetarian" ? ["vegetarian"] : [] });
        }}><option value="">Noch zu prüfen</option><option value="classic">Mit Fleisch / klassisch</option><option value="vegetarian">Vegetarisch</option><option value="vegan">Vegan</option></select></label>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => setRows(rows.filter((_, at) => at !== index))}>Gericht {index + 1} entfernen</button>
      </div>)}
      <div className="quiet-action-row">
        <button type="button" className="secondary-button" disabled={saving} onClick={() => setRows([...rows, { label: "", servings: "" }])}>Gericht hinzufügen</button>
        <button type="button" disabled={disabled || saving} onClick={() => void save()}>{saving ? "Wird gespeichert …" : "Menü als neue Fassung speichern"}</button>
        <button type="button" className="secondary-button" disabled={saving} onClick={() => { setRows(undefined); onEditingChange(false); setError(""); }}>Abbrechen</button>
      </div>
    </> : <>
      <ul className="item-list compact">{menuPlan.map((item, index) => <li key={String(item.componentId ?? index)}>{String(item.label ?? "")} · {item.servings === undefined ? "Portionen offen" : String(item.servings) + " Portionen"}{item.menuCategory === "vegan" ? " · vegan" : item.menuCategory === "vegetarian" ? " · vegetarisch" : item.menuCategory === "classic" ? " · klassisch" : ""}</li>)}</ul>
      <button type="button" className="secondary-button" disabled={disabled} onClick={begin}>Menü bearbeiten</button>
    </>}
    {error ? <p role="alert">{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </section>;
}
