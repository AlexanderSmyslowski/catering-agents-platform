import { useEffect, useRef, useState } from "react";
import type { RecipeImportPreview, RecipeImportReview, RecipeNumberFormat } from "../../shared-core/src/recipe-library.js";
import type { RecipeImportSaveResult } from "./production-recipe-submission-actions.js";
import { previewRecipeFile } from "./api.js";

type Props = {
  recipeName: string;
  recipeFile: File | null;
  setRecipeName: (value: string) => void;
  setRecipeFile: (value: File | null) => void;
  uploadRecipe: (target: "offer" | "production", numberFormat?: RecipeNumberFormat, review?: RecipeImportReview) => Promise<RecipeImportSaveResult | boolean | void>;
  submitting: boolean;
};

export function RecipeImportReviewPanel({ recipeName, recipeFile, setRecipeName, setRecipeFile, uploadRecipe, submitting }: Props) {
  const [numberFormat, setNumberFormat] = useState<RecipeNumberFormat | "">("");
  const [preview, setPreview] = useState<(RecipeImportPreview & { file: File })>();
  const [text, setText] = useState("");
  const [servings, setServings] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const epoch = useRef(0);
  const committing = useRef(false);
  const servingsField = useRef<HTMLInputElement>(null);
  const textField = useRef<HTMLTextAreaElement>(null);
  const confirmationField = useRef<HTMLInputElement>(null);
  const readButton = useRef<HTMLButtonElement>(null);
  const busy = submitting || saving;
  const validServings = /^[1-9]\d{0,3}$/.test(servings);

  useEffect(() => {
    epoch.current += 1;
    setPreview(undefined); setReading(false); setError(""); setAttempted(false); setConfirmed(false); setDiscarding(false);
    return () => { epoch.current += 1; };
  }, [recipeFile, numberFormat]);

  async function read() {
    if (!recipeFile || reading || busy) return;
    const ticket = ++epoch.current;
    const file = recipeFile;
    setReading(true); setError("");
    try {
      const candidate = await previewRecipeFile(file, recipeName, numberFormat || undefined);
      if (ticket !== epoch.current) return;
      if (!candidate.text.trim()) throw new Error("Diese Datei enthält keinen lesbaren Text. Bitte eine PDF mit Text, TXT oder Markdown wählen.");
      setPreview({ ...candidate, file }); setText(candidate.text); setServings(""); setConfirmed(false); setAttempted(false);
    } catch (failure) {
      if (ticket === epoch.current) setError(failure instanceof Error ? failure.message : "Die Datei konnte nicht gelesen werden. Bitte erneut versuchen.");
    } finally { if (ticket === epoch.current) setReading(false); }
  }

  async function save() {
    if (committing.current || busy || !preview || preview.file !== recipeFile) return;
    setAttempted(true); setError("");
    if (!text.trim()) { textField.current?.focus(); return; }
    if (!validServings) { servingsField.current?.focus(); return; }
    if (!confirmed) { confirmationField.current?.focus(); return; }
    committing.current = true; setSaving(true);
    try {
      const result = await uploadRecipe("production", numberFormat || undefined, { text, servings: Number(servings), confirmed: true });
      if (result === false || (result && typeof result === "object" && !result.saved)) {
        const message = result && typeof result === "object" ? result.message : undefined;
        setError(`${message ?? "Speichern fehlgeschlagen."} Deine Eingaben sind erhalten.`);
      }
    } catch (failure) {
      setError(`${failure instanceof Error ? failure.message : "Speichern fehlgeschlagen."} Deine Eingaben sind erhalten.`);
    } finally { committing.current = false; setSaving(false); }
  }

  function discard() {
    epoch.current += 1; setPreview(undefined); setConfirmed(false); setAttempted(false); setDiscarding(false); setError("");
    readButton.current?.focus();
  }

  return <section aria-label="Rezept aus Datei übernehmen" className="form-panel recipe-import">
    <header><h3>Rezept aus Datei übernehmen</h3><p className="helper-text">Die Datei wird zuerst nur gelesen. Gespeichert wird erst nach deinem Abgleich.</p></header>
    <label className="field-block"><span>Rezeptdatei</span><input className="file-input" type="file" disabled={busy || reading} accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf" onChange={event => {
      epoch.current += 1; setPreview(undefined); setRecipeFile(event.target.files?.[0] ?? null);
    }} /><span className="helper-text">PDF mit Text, TXT oder Markdown · maximal 5 MB. Fotos und gescannte Seiten können noch nicht automatisch gelesen werden.</span></label>
    <label className="field-block"><span>Rezeptname (optional)</span><input value={recipeName} disabled={busy || reading} onChange={event => setRecipeName(event.target.value)} placeholder="Name aus der Datei übernehmen" /></label>
    <label className="field-block"><span>Zahlenformat der Datei</span><select value={numberFormat} disabled={busy || reading} onChange={event => {
      epoch.current += 1; setPreview(undefined); setNumberFormat(event.target.value as RecipeNumberFormat | "");
    }}><option value="">Nicht festgelegt</option><option value="de">Deutsch · 1.234,5</option><option value="en">Englisch · 1,234.5</option></select><span className="helper-text">Ohne Auswahl werden mehrdeutige Mengen markiert statt geraten.</span></label>
    {!preview ? <div className="action-row"><button ref={readButton} type="button" disabled={busy || reading || !recipeFile} onClick={() => void read()}>{reading ? "Wird eingelesen …" : "Datei einlesen"}</button></div> : null}
    {recipeFile ? <p className="helper-text">Ausgewählt: {recipeFile.name}</p> : null}
    {preview && preview.file === recipeFile ? <div className="form-panel" aria-label="Rezeptvorschau prüfen">
      <header><h4>Vorschau – noch nicht gespeichert</h4><p className="helper-text">Vergleiche Mengen, Einheiten, Zubereitung und Hinweise mit deiner Originaldatei. Jede Zutat braucht eine feste Planmenge.</p></header>
      {preview.issue ? <p className="helper-text">Beim Einlesen aufgefallen: {preview.issue}</p> : null}
      <div className="recipe-import__comparison">
        <label className="field-block"><span>Vorlagentext zum Vergleich</span><textarea readOnly value={preview.text} rows={10} /></label>
        <label className="field-block"><span>Rezepttext zum Speichern</span><textarea id="recipe-import-text" ref={textField} value={text} disabled={busy} rows={10} maxLength={64000} aria-invalid={attempted && !text.trim()} aria-describedby="recipe-import-text-hint" onChange={event => { setText(event.target.value); setConfirmed(false); setError(""); }} /><span id="recipe-import-text-hint" className="helper-text">Eine Zutat pro Zeile: Menge, Einheit, Zutat – etwa {numberFormat === "en" ? "2.5" : "2,5"} kg Kartoffeln. Zubereitung und Allergenhinweise erhalten. {attempted && !text.trim() ? "Bitte den Rezepttext eintragen." : ""}</span></label>
      </div>
      <label className="field-block"><span>Portionen laut Original</span><input id="recipe-import-servings" ref={servingsField} type="number" inputMode="numeric" min={1} max={9999} step={1} value={servings} disabled={busy} aria-invalid={attempted && !validServings} aria-describedby="recipe-import-servings-hint" onChange={event => { setServings(event.target.value); setConfirmed(false); setError(""); }} /><span id="recipe-import-servings-hint" className="helper-text">{preview.servings ? `Erkannt: ${preview.servings} Portionen. Bitte mit dem Original abgleichen und selbst eintragen.` : "Keine eindeutige Portionszahl erkannt. Bitte aus dem Original eintragen."} {attempted && !validServings ? "Eine ganze Zahl zwischen 1 und 9999 ist erforderlich." : ""}</span></label>
      <label className="recipe-import__confirmation"><input id="recipe-import-confirmed" ref={confirmationField} type="checkbox" checked={confirmed} disabled={busy} aria-invalid={attempted && !confirmed} aria-describedby="recipe-import-confirmation-hint" onChange={event => setConfirmed(event.target.checked)} /><span>Mengen, Einheiten und Portionen stimmen mit dem Original überein.</span></label>
      <p id="recipe-import-confirmation-hint" className="helper-text">{attempted && !confirmed ? "Bitte den Abgleich bestätigen. " : ""}Das Rezept wird als „Prüfung nötig“ gespeichert. Dies ist noch keine Freigabe für einen Auftrag.</p>
      <div className="action-row"><button type="button" disabled={busy} onClick={() => void save()}>{saving ? "Wird gespeichert …" : "In Rezeptbibliothek speichern"}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => text !== preview.text || servings ? setDiscarding(true) : discard()}>Verwerfen</button></div>
      {discarding ? <div className="production-discard-confirmation" role="group" aria-label="Vorschau verwerfen"><p>Vorschau und Änderungen verwerfen?</p><button type="button" className="secondary-button" onClick={discard}>Vorschau verwerfen</button><button type="button" onClick={() => setDiscarding(false)}>Weiter prüfen</button></div> : null}
    </div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
