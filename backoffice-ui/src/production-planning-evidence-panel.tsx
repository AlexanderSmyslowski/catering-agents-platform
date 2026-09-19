import { useEffect, useRef, useState } from "react";
import { evaluateQuantityDecision } from "../../shared-core/src/quantity-decision.js";
import type { QuantityDecisionInput, Recipe, RecipeEventUseReview } from "@catering/shared-core";
import { ApiResponseError, loadProductionDrafts, loadProductionRecipeLibrary, reviseProductionDraft, saveProductionPlanningEvidence,
  type ProductionDraft, type ProductionDraftListResponse, type ProductionPlanningEvidence, type ProductionPlanningEvidenceInput } from "./api.js";
import { useCateringSession } from "./session-boundary.js";
import { announceProductionDraftRefresh } from "./production-draft-review-panel.js";

type Props = { caseId?: string; submitting: boolean; onChanged?: () => Promise<void> };
type Component = { componentId: string; label: string; servings?: number; recipeOverrideId?: string; productionDecision?: { mode?: string } };
type Spec = { specId: string; attendees: { expected: number }; servicePlan: { eventType: string; serviceForm?: string }; menuPlan: Component[] };
const confirmationLabels: Record<keyof RecipeEventUseReview["confirmations"], string> = {
  quantitiesAndYield: "Mengen und Ausbeute für dieses Event geprüft",
  methodAndEquipment: "Methode und Ausstattung für dieses Event geprüft",
  allergensAndDiet: "Allergene und Ernährungsanforderungen für dieses Event geprüft",
  holdingAndRegeneration: "Warmhaltung und Regeneration für dieses Event geprüft"
};
function currentDraft(data: ProductionDraftListResponse) {
  return [...data.items].sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0))[0];
}
function binding(draft: ProductionDraft) {
  return JSON.stringify([draft.draftId, draft.revision, draft.status, draft.draftArtifacts?.eventSpec]);
}
function exactEvidence(evidence: ProductionPlanningEvidence, caseId: string, draft: ProductionDraft, component: Component, spec: Spec) {
  return evidence.caseId === caseId && evidence.draftId === draft.draftId && evidence.draftRevision === draft.revision &&
    evidence.componentId === component.componentId && evidence.recipeId === component.recipeOverrideId && evidence.eventSpecId === spec.specId;
}

function RecipeDetails({ value }: { value: Record<string, unknown> }) {
  const recipe = value as unknown as Recipe;
  const production = recipe.knowledge?.production;
  return <div>
    <p>Grundrezept: {recipe.baseYield?.servings ?? "offen"} Portionen · Allergene: {recipe.allergens?.join(", ") || "keine Angaben"} · Ernährung: {recipe.dietTags?.join(", ") || "keine Angaben"}</p>
    <ul>{recipe.ingredients?.map((ingredient, index) => <li key={index}>
      {ingredient.name}: {ingredient.quantity?.amount} {ingredient.quantity?.unit}
    </li>)}</ul>
    <ol>{recipe.steps?.map((step, index) => <li key={index}>{step.instruction}</li>)}</ol>
    <p>Vorlauf: {production?.prepLeadMinutes ?? "offen"} Minuten · Haltedauer: {production?.holdMinutes ?? "offen"} Minuten</p>
    <p>Ausstattung: {production?.equipmentNotes?.join(", ") || "offen"} · Regeneration: {production?.regenerationInstructions || "offen"}</p>
    {production?.criticalParameters?.map((parameter, index) => <p key={index}>{parameter.name}: {parameter.value} {parameter.unit}</p>)}
    {recipe.knowledge?.sourceCitation && <p>Quellenangabe: {recipe.knowledge.sourceCitation.title} {recipe.knowledge.sourceCitation.author} {recipe.knowledge.sourceCitation.location}</p>}
  </div>;
}

export function ProductionPlanningEvidencePanel(props: Props) {
  const userId = useCateringSession()?.session.user.userId;
  if (!props.caseId || !userId) return null;
  return <CaseEvidencePanel key={JSON.stringify([props.caseId, userId])} {...props} caseId={props.caseId} userId={userId} />;
}

function CaseEvidencePanel({ caseId, userId, submitting, onChanged }: Props & { caseId: string; userId: string }) {
  const [data, setData] = useState<ProductionDraftListResponse>();
  const [library, setLibrary] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  async function reload() {
    const version = ++generation.current;
    setLoading(true);
    try {
      const [fresh, candidates] = await Promise.all([loadProductionDrafts(caseId), loadProductionRecipeLibrary()]);
      if (generation.current !== version) return;
      setData(fresh); setLibrary(candidates.items); setError("");
    } catch (cause) {
      if (generation.current !== version) return;
      setError(cause instanceof Error ? cause.message : "Planungs-Evidenz konnte nicht geladen werden.");
      throw cause;
    } finally { if (generation.current === version) setLoading(false); }
  }
  useEffect(() => {
    const refresh = () => { void reload().catch(() => undefined); };
    refresh();
    window.addEventListener("catering:production-draft-refresh", refresh);
    return () => { generation.current++; window.removeEventListener("catering:production-draft-refresh", refresh); };
  }, [caseId]);
  const draft = data && currentDraft(data);
  const spec = draft?.draftArtifacts?.eventSpec as Spec | undefined;
  const components = Array.isArray(spec?.menuPlan) ? spec.menuPlan.filter(component =>
    component.productionDecision?.mode === "scratch" || component.productionDecision?.mode === "hybrid") : [];
  if (!error && (!draft || !spec || !draft.source?.sourceRef?.startsWith("offer-handoff:"))) return null;
  return <section className="panel" aria-label="Rezept und Mengenplanung">
    <h3>Rezeptgrundlage, Menge und Eventprüfung</h3>
    <p>Bibliotheksfreigabe, Allergenverifizierung und endgültige Produktionsfreigabe bleiben eigenständige Prüfungen.</p>
    <p>Nach einem Rezeptupload „Planungsstand neu laden“ wählen, um die neue Bibliotheksgrundlage auszuwählen.</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="secondary-button" disabled={loading} onClick={() => void reload().catch(() => undefined)}>Planungsstand neu laden</button>
    {draft && spec && <p>Revision {draft.revision} · {draft.draftId}</p>}
    {draft && spec && components.map(component => {
      const evidence = data?.planningEvidence?.find(item => exactEvidence(item, caseId, draft, component, spec));
      const predecessor = data?.planningEvidence?.filter(item => item.caseId === caseId && item.componentId === component.componentId && item.draftId !== draft.draftId) ?? [];
      const snapshot = data?.planningRecipes?.find(item => item.recipe.recipeId === component.recipeOverrideId);
      const candidates = snapshot ? [...library.filter(item => item.recipeId !== component.recipeOverrideId), snapshot.recipe] : library;
      return <ComponentEvidence key={JSON.stringify([binding(draft), component.componentId, snapshot, evidence])}
        caseId={caseId} userId={userId} draft={draft} spec={spec} component={component} recipes={candidates}
        recipeSnapshotHash={snapshot?.recipeSnapshotHash}
        evidence={evidence} predecessor={predecessor} disabled={submitting || loading || Boolean(error)}
        reload={reload} onChanged={onChanged} />;
    })}
    {components.length === 0 && <p>Keine Eigenproduktions- oder Hybridkomponente benötigt Rezept-Evidenz.</p>}
  </section>;
}

function ComponentEvidence({ caseId, userId, draft, spec, component, recipes, recipeSnapshotHash, evidence, predecessor, disabled, reload, onChanged }: {
  caseId: string; userId: string; draft: ProductionDraft; spec: Spec; component: Component; recipes: Array<Record<string, unknown>>;
  evidence?: ProductionPlanningEvidence; predecessor: ProductionPlanningEvidence[]; disabled: boolean; reload: () => Promise<void>; onChanged?: () => Promise<void>;
  recipeSnapshotHash?: string;
}) {
  const [selected, setSelected] = useState(component.recipeOverrideId ?? "");
  const [basis, setBasis] = useState<QuantityDecisionInput["basis"]>("servings_per_person");
  const [perUnit, setPerUnit] = useState(String(component.servings && spec.attendees.expected ? component.servings / spec.attendees.expected : ""));
  const [total, setTotal] = useState(String(component.servings ?? ""));
  const [unit, setUnit] = useState("servings");
  const [role, setRole] = useState<QuantityDecisionInput["dishRole"]>("other");
  const [rationale, setRationale] = useState("");
  const [reference, setReference] = useState("");
  const [mappingAmount, setMappingAmount] = useState("");
  const [mappingServings, setMappingServings] = useState("");
  const [confirmations, setConfirmations] = useState<RecipeEventUseReview["confirmations"]>({
    quantitiesAndYield: false, methodAndEquipment: false, allergensAndDiet: false, holdingAndRegeneration: false
  });
  function resetConfirmations() {
    setConfirmations({ quantitiesAndYield: false, methodAndEquipment: false, allergensAndDiet: false, holdingAndRegeneration: false });
  }
  const [pending, setPending] = useState<ProductionPlanningEvidenceInput>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const recipe = recipes.find(item => item.recipeId === selected);
  const assigned = Boolean(recipe && selected === component.recipeOverrideId);
  const targetUnit = basis === "servings_per_person" ? "servings" : basis === "pieces_per_person" ? "pieces" : unit;
  const quantity: QuantityDecisionInput = {
    decisionId: "preview", eventSpecId: spec.specId, componentId: component.componentId, guestCount: spec.attendees.expected,
    serviceFormat: spec.servicePlan.serviceForm ?? spec.servicePlan.eventType, dishRole: role, basis,
    ...(basis !== "fixed_total" ? { perUnitAmount: Number(perUnit), perUnitUnit: targetUnit } : {}),
    targetAmount: basis === "fixed_total" ? Number(total) : Number((Number(perUnit) * spec.attendees.expected).toFixed(6)),
    targetUnit, rationale, evidence: { kind: "operator_instruction", reference }, reviewStatus: "approved"
  };
  const quantityCheck = evaluateQuantityDecision(quantity);
  const mappingValid = targetUnit === "servings" || Number(mappingAmount) > 0 && Number(mappingServings) > 0;
  const canSave = assigned && recipeSnapshotHash && quantityCheck.valid && reference.trim() && mappingValid && Object.values(confirmations).every(Boolean);
  const locked = disabled || busy || Boolean(pending) || draft.status !== "pending_review";
  async function assertFresh() {
    const fresh = await loadProductionDrafts(caseId);
    if (!alive.current) return false;
    const current = currentDraft(fresh);
    const currentRecipeHash = fresh.planningRecipes?.find(item => item.recipe.recipeId === component.recipeOverrideId)?.recipeSnapshotHash;
    if (!current || binding(current) !== binding(draft) || current.status !== "pending_review" ||
      (assigned && (!recipeSnapshotHash || currentRecipeHash !== recipeSnapshotHash))) {
      setMessage("Der Entwurf wurde geändert. Bitte den aktuellen Planungsstand prüfen.");
      await reload(); return false;
    }
    return true;
  }
  async function assignRecipe() {
    if (running.current || locked || !selected) return;
    running.current = true; setBusy(true);
    try {
      if (!await assertFresh()) return;
      await reviseProductionDraft(draft.draftId, { caseId, expectedRevision: draft.revision!, componentClassifications: [],
        componentUpdates: [{ componentId: component.componentId, recipeOverrideId: selected }] });
      if (!alive.current) return;
      announceProductionDraftRefresh();
      await onChanged?.();
      if (alive.current) await reload();
    } catch (cause) { if (alive.current) setMessage(cause instanceof Error ? cause.message : "Rezeptzuordnung konnte nicht gespeichert werden."); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  async function save() {
    if (running.current || disabled || draft.status !== "pending_review" || (!pending && !canSave)) return;
    running.current = true; setBusy(true); setMessage("");
    try {
      if (!await assertFresh()) return;
      const reviewedAt = new Date().toISOString();
      // Retain the complete immutable command after uncertain responses; retries must not mint new IDs or timestamps.
      const payload = pending ?? {
        draftId: draft.draftId, draftRevision: draft.revision!, componentId: component.componentId, recipeId: selected,
        expectedRecipeSnapshotHash: recipeSnapshotHash!,
        quantityDecision: { ...quantity, decisionId: `quantity-${crypto.randomUUID()}` },
        recipeEventUseReview: { eventSpecId: spec.specId, recipeId: selected, reviewedBy: userId, reviewedAt, decision: "accepted_for_event" as const, confirmations: { ...confirmations } },
        ...(targetUnit !== "servings" ? { outputMapping: { recipeId: selected, outputAmount: Number(mappingAmount), outputUnit: targetUnit,
          recipeServings: Number(mappingServings), reviewedBy: userId, reviewedAt } } : {})
      };
      setPending(payload);
      try {
        await saveProductionPlanningEvidence(caseId, payload);
      } catch (cause) {
        // Only a definitive rejection of this write permits a corrected command.
        // A failed follow-up read must not discard an already submitted command.
        if (alive.current && cause instanceof ApiResponseError && cause.status >= 400 && cause.status < 500) {
          setPending(undefined);
          resetConfirmations();
          if (cause.status === 409) await reload().catch(() => undefined);
        }
        throw cause;
      }
      if (!alive.current) return;
      announceProductionDraftRefresh();
      await onChanged?.();
      if (alive.current) await reload();
    } catch (cause) { if (alive.current) setMessage(cause instanceof Error ? cause.message : "Speicherantwort unklar. Bitte identisch erneut senden."); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  const source = recipe?.source as Record<string, unknown> | undefined;
  return <article className="form-panel" aria-label={`Rezeptplanung ${component.label}`}>
    <h4>{component.label}</h4>
    {message && <p role="alert">{message}</p>}
    {predecessor.length > 0 && <p>Vorgänger-Evidenz vorhanden: {predecessor.map(item => `Revision ${item.draftRevision}`).join(", ")}. Nur Herkunft, keine gültige Prüfung dieser Revision.</p>}
    {evidence ? <div role="status">
      <strong>Planungs-Evidenz kanonisch gespeichert · Revision {evidence.draftRevision}</strong>
      {evidence.recipeSnapshotHash !== recipeSnapshotHash && <p role="alert">Rezeptstand geändert oder nicht verfügbar: Diese Evidenz ist für die Vorbereitung nicht mehr gültig. Neue Entwurfsrevision und erneute Prüfung erforderlich.</p>}
      <p>{evidence.quantityDecision.targetAmount} {evidence.quantityDecision.targetUnit} · {evidence.quantityDecision.rationale}</p>
      <p>Mengenbasis: {evidence.quantityDecision.basis} · pro Person: {evidence.quantityDecision.perUnitAmount ?? "nicht angewendet"} {evidence.quantityDecision.perUnitUnit} · {evidence.quantityDecision.guestCount} Gäste · {evidence.quantityDecision.serviceFormat}</p>
      <p>Herkunft: {evidence.quantityDecision.evidence.reference} · Prüfung: {evidence.recipeEventUseReview.reviewedBy} · {evidence.recipeEventUseReview.reviewedAt}</p>
      <p>Rezept: {evidence.recipeId} · Snapshot: {evidence.recipeSnapshotHash}</p>
    </div> : <>
      <label className="field-block">Rezeptgrundlage
        <select aria-label="Rezeptgrundlage" value={selected} disabled={locked} onChange={event => { setSelected(event.target.value); resetConfirmations(); }}>
          <option value="">Rezeptkandidat auswählen</option>
          {recipes.map(item => <option key={String(item.recipeId)} value={String(item.recipeId)}>{String(item.name)} · {String((item.source as Record<string, unknown> | undefined)?.approvalState ?? "ungeprüft")}</option>)}
        </select>
      </label>
      {!recipes.length && <p>Eine ausdrücklich gekennzeichnete Rezeptgrundlage über „Rezepte verwalten“ hochladen.</p>}
      {recipe && <details><summary>Rezeptgrundlage prüfen: {String(recipe.name)} · {String(source?.approvalState)}</summary>
        <p>Herkunft: {String(source?.reference ?? "nicht angegeben")}</p>
        <RecipeDetails value={recipe} />
      </details>}
      {!assigned ? <><p>Zuerst die Rezeptzuordnung als neue Revision speichern. Die Eventprüfung folgt am frisch geladenen Stand.</p>
        <button type="button" disabled={locked || !selected} onClick={() => void assignRecipe()}>Rezeptzuordnung speichern</button></> :
      <fieldset disabled={locked} onChangeCapture={event => {
        if (!(event.target instanceof HTMLInputElement && event.target.type === "checkbox")) resetConfirmations();
      }}>
        <legend>Menge und bewusste Eventprüfung</legend>
        <p>{spec.attendees.expected} Gäste · {quantity.serviceFormat} · bekannte Komponentenmenge: {component.servings ?? "offen"} Portionen. Keine automatischen Verlust- oder Sicherheitszuschläge.</p>
        <label>Mengenbasis <select aria-label="Mengenbasis" value={basis} onChange={event => {
          const next = event.target.value as QuantityDecisionInput["basis"];
          setBasis(next);
          if (next === "per_person_weight" && (unit === "servings" || unit === "pieces")) setUnit("kg");
        }}>
          <option value="servings_per_person">Portionen pro Person</option><option value="pieces_per_person">Stück pro Person</option>
          <option value="per_person_weight">Gewicht pro Person</option><option value="fixed_total">Feste Gesamtmenge</option>
        </select></label>
        <label>Rolle <select aria-label="Rolle der Komponente" value={role} onChange={event => setRole(event.target.value as QuantityDecisionInput["dishRole"])}>
          {(["other", "main", "side", "starter", "dessert", "snack", "fingerfood", "condiment", "beverage_food_component"] as const).map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        {basis === "fixed_total" ? <label>Zielmenge <input aria-label="Zielmenge" type="number" min="0" step="any" value={total} onChange={event => setTotal(event.target.value)} /></label>
          : <label>Menge pro Person <input aria-label="Menge pro Person" type="number" min="0" step="any" value={perUnit} onChange={event => setPerUnit(event.target.value)} /></label>}
        {(basis === "per_person_weight" || basis === "fixed_total") && <label>Einheit <select aria-label="Mengeneinheit" value={unit} onChange={event => setUnit(event.target.value)}>
          <option value="servings">Portionen</option><option value="pieces">Stück</option><option value="kg">kg</option><option value="g">g</option><option value="l">l</option>
        </select></label>}
        <p>Zielmenge: {Number.isFinite(quantity.targetAmount) ? quantity.targetAmount : "offen"} {targetUnit}</p>
        <label>Begründung <textarea aria-label="Mengenbegründung" value={rationale} onChange={event => setRationale(event.target.value)} /></label>
        <label>Herkunft der Mengenentscheidung <input aria-label="Mengenherkunft" value={reference} onChange={event => setReference(event.target.value)} /></label>
        {targetUnit !== "servings" && <div><p>Geprüfte Rezept-Ausgabemenge: Wie viele {targetUnit} entsprechen wie vielen Rezeptportionen?</p>
          <label>Ausgabemenge <input aria-label="Rezept-Ausgabemenge" type="number" step="any" value={mappingAmount} onChange={event => setMappingAmount(event.target.value)} /></label>
          <label>Rezeptportionen <input aria-label="Rezeptportionen" type="number" step="any" value={mappingServings} onChange={event => setMappingServings(event.target.value)} /></label>
        </div>}
        {Object.entries(confirmationLabels).map(([key, label]) => <label className="field-block" key={key}>
          <input type="checkbox" checked={confirmations[key as keyof typeof confirmations]} onChange={event =>
            setConfirmations(current => ({ ...current, [key]: event.target.checked }))} />{label}
        </label>)}
        <p>Mit dem Speichern bestätigst du die konkrete Mengenentscheidung und diese Eventprüfung als angemeldeter Operator ({userId}).</p>
      </fieldset>}
      {assigned && <button type="button" disabled={disabled || busy || draft.status !== "pending_review" || (!pending && !canSave)} onClick={() => void save()}>
        {pending ? "Identisch erneut senden" : "Menge und Eventprüfung speichern"}
      </button>}
    </>}
  </article>;
}
