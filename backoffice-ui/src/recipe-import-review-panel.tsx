import { useEffect, useRef, useState } from "react";
import type { RecipeImportPreview, RecipeImportReview, RecipeNumberFormat } from "../../shared-core/src/recipe-library.js";
import type { RecipeImportSaveResult } from "./production-recipe-submission-actions.js";
import { previewRecipeFile, loadRecipeVisionCapability } from "./api.js";

type Props = {
  recipeName: string;
  recipeFile: File | null;
  setRecipeName: (value: string) => void;
  setRecipeFile: (value: File | null) => void;
  uploadRecipe: (target: "offer" | "production", numberFormat?: RecipeNumberFormat, review?: RecipeImportReview) => Promise<RecipeImportSaveResult | boolean | void>;
  submitting: boolean;
};

export function RecipeImportReviewPanel({ recipeName, recipeFile, setRecipeName, setRecipeFile, uploadRecipe, submitting }: Props) {
  const [visionCapability, setVisionCapability] = useState<{available:boolean;provider?:string;model?:string}>({available:false});
  useEffect(() => { let alive=true; void loadRecipeVisionCapability().then(value=>{if(alive)setVisionCapability(value);}).catch(()=>{}); return ()=>{alive=false;}; }, []);
  const [imageChecked, setImageChecked] = useState(false);
  const [numberFormat, setNumberFormat] = useState<RecipeNumberFormat | "">("");
  const [preview, setPreview] = useState<(RecipeImportPreview & { file: File; initialText:string })>();
  const [originalImage, setOriginalImage] = useState<{file:File; url:string}>();
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
  const manualButton = useRef<HTMLButtonElement>(null);
  const focusAfterDiscard = useRef(false);
  const isImage = Boolean(recipeFile && /\.(?:png|jpe?g)$/i.test(recipeFile.name));
  const busy = submitting || saving;
  const validServings = /^[1-9]\d{0,3}$/.test(servings);

  useEffect(() => {
    epoch.current += 1;
    setPreview(undefined); setText(""); setServings(""); setImageChecked(false); setReading(false); setError(""); setAttempted(false); setConfirmed(false); setDiscarding(false);
    return () => { epoch.current += 1; };
  }, [recipeFile, numberFormat]);

  useEffect(() => {
    if (!recipeFile || !/\.(?:png|jpe?g)$/i.test(recipeFile.name) || typeof URL.createObjectURL !== "function") { setOriginalImage(undefined); return; }
    const url=URL.createObjectURL(recipeFile);
    setOriginalImage({file:recipeFile,url});
    return () => { URL.revokeObjectURL(url); };
  }, [recipeFile]);

  useEffect(() => {
    if (!preview && focusAfterDiscard.current) {
      focusAfterDiscard.current=false;
      (isImage ? manualButton.current : readButton.current)?.focus();
    }
  }, [preview, isImage]);

  async function read(vision = false, preserve = false, manual = false) {
    if (!recipeFile || reading || busy) return;
    const ticket = ++epoch.current;
    const file = recipeFile;
    setReading(true); setError("");
    try {
      const candidate = await previewRecipeFile(file, recipeName, numberFormat || undefined, vision, manual);
      if (ticket !== epoch.current) return;
      if (!candidate.text.trim()) throw new Error("Diese Datei enthält keinen lesbaren Text. Bitte eine PDF mit Text, TXT oder Markdown wählen.");
      setPreview({ ...candidate, file, initialText: preserve ? (preview?.initialText ?? "") : (manual ? "" : candidate.text) }); if (!preserve) { setText(manual ? "" : candidate.text); setServings(""); } setConfirmed(false); setAttempted(false);
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
      const result = await uploadRecipe("production", numberFormat || undefined, { text, servings: Number(servings), confirmed: true, ...(preview.previewToken ? {previewToken:preview.previewToken} : {}) });
      if (result === false || (result && typeof result === "object" && !result.saved)) {
        const message = result && typeof result === "object" ? result.message : undefined;
        setError(`${message ?? "Speichern fehlgeschlagen."} Deine Eingaben sind erhalten.`);
      }
    } catch (failure) {
      setError(`${failure instanceof Error ? failure.message : "Speichern fehlgeschlagen."} Deine Eingaben sind erhalten.`);
    } finally { committing.current = false; setSaving(false); }
  }

  function discard() {
    epoch.current += 1; focusAfterDiscard.current=true; setPreview(undefined); setText(""); setServings(""); setImageChecked(false); setConfirmed(false); setAttempted(false); setDiscarding(false); setError("");
  }

  return <section aria-label="Rezept aus Datei übernehmen" className="form-panel recipe-import">
    <header><h3>Rezept aus Datei übernehmen</h3><p className="helper-text">Die Datei wird zuerst nur gelesen. Gespeichert wird erst nach deinem Abgleich.</p></header>
    <label className="field-block"><span>Rezeptdatei</span><input className="file-input" type="file" disabled={busy || reading || Boolean(preview)} accept=".pdf,.txt,.md,.jpg,.jpeg,.png,text/plain,text/markdown,application/pdf,image/jpeg,image/png" onChange={event => {
      epoch.current += 1; setPreview(undefined); setRecipeFile(event.target.files?.[0] ?? null);
    }} /><span className="helper-text">PDF mit Text, TXT oder Markdown · maximal 5 MB. {visionCapability.available ? "Fotos und gescannte Bildseiten können nach ausdrücklichem Start per KI gelesen werden; gescannte PDFs bitte als Foto einreichen oder manuell übertragen." : "Fotos (JPG/PNG) und gescannte PDFs kannst du manuell übertragen. KI-Bildlesung ist noch nicht freigegeben."}</span></label>
    <label className="field-block"><span>Rezeptname (optional)</span><input value={recipeName} disabled={busy || reading} onChange={event => setRecipeName(event.target.value)} placeholder="Name aus der Datei übernehmen" /></label>
    <label className="field-block"><span>Zahlenformat der Datei</span><select value={numberFormat} disabled={busy || reading || Boolean(preview)} onChange={event => {
      epoch.current += 1; setPreview(undefined); setNumberFormat(event.target.value as RecipeNumberFormat | "");
    }}><option value="">Nicht festgelegt</option><option value="de">Deutsch · 1.234,5</option><option value="en">Englisch · 1,234.5</option></select><span className="helper-text">Ohne Auswahl werden mehrdeutige Mengen markiert statt geraten.</span></label>
    {preview ? <p className="helper-text">Um Datei oder Zahlenformat zu ändern, bitte die Vorschau zuerst verwerfen.</p> : null}
    {!preview && !isImage ? <div className="action-row"><button ref={readButton} type="button" disabled={busy || reading || !recipeFile} onClick={() => void read(false)}>{reading ? "Wird eingelesen …" : "Datei einlesen"}</button></div> : null}
    {recipeFile ? <p className="helper-text">Ausgewählt: {recipeFile.name}</p> : null}
    {originalImage && originalImage.file === recipeFile ? <figure className="recipe-import__source"><img className="recipe-import__source-image" src={originalImage.url} alt="Originaldatei zum Abgleichen" /><figcaption className="helper-text">Originaldatei zum Abgleichen</figcaption></figure> : null}
    {visionCapability.available && recipeFile && /\.(?:png|jpe?g)$/i.test(recipeFile.name) ? <div><p className="helper-text">Bildlesung durch {visionCapability.provider} ({visionCapability.model}). Dabei wird die gesamte Datei extern verarbeitet. Entferne vorher nicht benötigte Personen- und Kontaktdaten. Rohdatei wird hier nicht gespeichert.</p><label className="recipe-import__confirmation"><input type="checkbox" checked={imageChecked} disabled={busy || reading} onChange={event => setImageChecked(event.target.checked)} /><span>Die Datei enthält keine nicht benötigten Personen- oder Kontaktdaten.</span></label><button type="button" disabled={busy || reading || !imageChecked} onClick={() => void read(true, Boolean(preview))}>{reading ? "Wird eingelesen …" : preview ? "Bild erneut mit KI lesen" : "Bild mit KI lesen"}</button>{preview ? <p className="helper-text">Beim erneuten Lesen bleiben deine Änderungen erhalten; vergleiche sie mit dem neu erkannten Text und bestätige erneut.</p> : null}</div> : null}
    {!preview && recipeFile && /\.(?:pdf|png|jpe?g)$/i.test(recipeFile.name) ? <div><button ref={manualButton} type="button" className={isImage && !visionCapability.available ? undefined : "secondary-button"} disabled={busy || reading} onClick={() => void read(false, false, true)}>Rezept manuell übertragen</button><p className="helper-text">Ohne KI: Zutaten und Zubereitung selbst aus der Originaldatei übertragen. Die Originaldatei bleibt bei dir.</p></div> : null}
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
      <div className="action-row"><button type="button" disabled={busy} onClick={() => void save()}>{saving ? "Wird gespeichert …" : "In Rezeptbibliothek speichern"}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => text !== preview.initialText || servings ? setDiscarding(true) : discard()}>Verwerfen</button></div>
      {discarding ? <div className="production-discard-confirmation" role="group" aria-label="Vorschau verwerfen"><p>Vorschau und Änderungen verwerfen?</p><button type="button" className="secondary-button" onClick={discard}>Vorschau verwerfen</button><button type="button" onClick={() => setDiscarding(false)}>Weiter prüfen</button></div> : null}
    </div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
