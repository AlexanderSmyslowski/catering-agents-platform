import type { ProductionDraft, ProductionDraftReviewCard } from "./api.js";
import { formatRecipeApprovalStateLabel } from "../../shared-core/src/export-source-metadata.js";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function value(value: unknown, missing = "Angabe fehlt"): string {
  return text(value) ?? number(value)?.toString() ?? `unvollständig: ${missing}`;
}
function quantity(amount: unknown, unit: unknown): string {
  return `${number(amount) ?? "unvollständig: Menge fehlt"} ${unit === "servings" ? amount === 1 ? "Portion" : "Portionen" : text(unit) ?? "unvollständig: Einheit fehlt"}`;
}
function label(input: unknown, labels: Record<string, string>, missing: string): string {
  const key = text(input);
  return key && Object.hasOwn(labels, key) ? labels[key]! : `unvollständig: ${missing}`;
}
function approvalLabel(input: unknown): string {
  const state = text(input);
  if (state === "rejected") return "abgelehnt";
  return state && ["approved_internal", "auto_usable", "review_required"].includes(state)
    ? formatRecipeApprovalStateLabel(state) ?? "unvollständig: Rezeptstatus klären" : "unvollständig: Rezeptstatus klären";
}
const stationLabels = { hot: "Warme Küche", "hot-kitchen": "Warme Küche", cold: "Kalte Küche", "cold-kitchen": "Kalte Küche", pastry: "Patisserie" };
function station(input: unknown): string {
  const key = text(input);
  return key && Object.hasOwn(stationLabels, key) ? stationLabels[key as keyof typeof stationLabels] : value(input, "Arbeitsbereich fehlt");
}
function quantityObject(input: unknown): string {
  const item = record(input);
  return quantity(item?.amount, item?.unit);
}
function Warning({ children = "Prüfziel nicht verfügbar oder unvollständig. Bitte vor der Entscheidung klären." }: { children?: string }) {
  return <p className="helper-text" role="note">{children}</p>;
}
function Strings({ items, label }: { items: unknown; label: string }) {
  if (items === undefined) return null;
  if (!Array.isArray(items)) return <Warning>{`${label} unvollständig.`}</Warning>;
  return <>{items.length > 0 && <p><strong>{label}</strong></p>}<ul>{items.map((item, index) => <li key={index}>{value(item)}</li>)}</ul></>;
}
function Ingredients({ items }: { items: unknown }) {
  if (!Array.isArray(items)) return <Warning>Zutaten unvollständig.</Warning>;
  return <ul>{items.map((item, index) => {
    const ingredient = record(item);
    return <li key={index}>{value(ingredient?.name, "Zutat fehlt")}: {quantityObject(ingredient?.quantity)}</li>;
  })}</ul>;
}
function Steps({ items }: { items: unknown }) {
  if (items === undefined) return null;
  if (!Array.isArray(items)) return <Warning>Arbeitsschritte unvollständig.</Warning>;
  return <ol>{items.map((item, index) => <li key={index}>{value(record(item)?.instruction)}</li>)}</ol>;
}

// Paths are an allowlist of snapshot locations, never property traversal or executable input.
function resolveTarget(draft: ProductionDraft, card: ProductionDraftReviewCard): RecordValue | undefined {
  const artifacts = draft.draftArtifacts;
  let target: RecordValue | undefined;
  let idKey: string;
  let expectedPath: string;
  if (card.kind === "recipe") {
    const recipes = Array.isArray(artifacts?.recipes) ? artifacts.recipes : [];
    const matches = recipes.map(record).filter(recipe => text(card.targetId) && recipe?.recipeId === card.targetId);
    if (matches.length !== 1) return undefined;
    target = matches[0];
    const index = recipes.indexOf(target!);
    expectedPath = `$.draftArtifacts.recipes[${index}]`;
    idKey = "recipeId";
  } else if (card.kind === "event_data") {
    target = record(artifacts?.eventSpec); expectedPath = "$.draftArtifacts.eventSpec"; idKey = "specId";
  } else if (card.kind === "timeline") {
    target = record(artifacts?.productionPlan); expectedPath = "$.draftArtifacts.productionPlan"; idKey = "planId";
  } else if (card.kind === "purchase_item") {
    target = record(artifacts?.purchaseList); expectedPath = "$.draftArtifacts.purchaseList"; idKey = "purchaseListId";
  } else return undefined;
  if (card.targetPath !== undefined && card.targetPath !== expectedPath) return undefined;
  if (!target || !text(target[idKey]) || (card.targetId !== undefined && card.targetId !== target[idKey])) return undefined;
  // An absent path is only resolvable by a matching immutable artifact identifier.
  return card.targetPath === expectedPath || text(card.targetId) ? target : undefined;
}

const modeLabels: Record<string, string> = {
  scratch: "Eigenproduktion", hybrid: "Teilweise Eigenproduktion", convenience_purchase: "Convenience-Zukauf", external_finished: "Externer Fertigzukauf"
};
function EventContent({ spec }: { spec: RecordValue }) {
  const event = record(spec.event);
  const attendees = record(spec.attendees);
  return <>
    <p><strong>{value(event?.title, "Veranstaltungsname fehlt")}</strong></p>
    <p>Datum: {value(event?.date)} · Gäste: {value(attendees?.expected ?? attendees?.guaranteed)}</p>
    <p><strong>Zeitfenster</strong></p>
    {Array.isArray(event?.schedule) && event.schedule.length ? <ul>{event.schedule.map((item, index) => {
      const slot = record(item);
      return <li key={index}>{value(slot?.label)}: {value(slot?.start)} – {value(slot?.end)}</li>;
    })}</ul> : <Warning>Zeitfenster nicht verfügbar.</Warning>}
    <Strings items={spec.productionConstraints} label="Auftrags- und Sonderkosthinweise · keine Allergen- oder Küchenfreigabe" />
    <p><strong>Komponenten</strong></p>
    {Array.isArray(spec.menuPlan) && spec.menuPlan.length ? <ul>{spec.menuPlan.map((item, index) => {
      const component = record(item);
      const decision = record(component?.productionDecision);
      const mode = text(decision?.mode);
      return <li key={index}>{value(component?.label)} · Kategorie: {label(component?.menuCategory, { classic: "Klassisch", vegetarian: "Vegetarisch", vegan: "Vegan" }, "Ernährungskennzeichnung klären")} · Herstellung: {mode && Object.hasOwn(modeLabels, mode) ? modeLabels[mode] : value(undefined, "Herstellungsweg unbekannt")} · Portionen: {value(component?.servings)}
        <Strings items={decision?.purchasedElements} label="Zukauf" />
        {decision?.notes !== undefined && <p>{value(decision.notes)}</p>}
      </li>;
    })}</ul> : <Warning>Komponenten nicht verfügbar.</Warning>}
  </>;
}
function frozenBatchName(draft: ProductionDraft, batch: RecordValue, kind: "component" | "recipe"): string {
  const spec = record(draft.draftArtifacts?.eventSpec);
  const plan = record(draft.draftArtifacts?.productionPlan);
  if (!text(spec?.specId) || plan?.eventSpecId !== spec?.specId) return "unvollständig: Zuordnung zum Auftrag klären";
  const items = kind === "component" ? spec?.menuPlan : draft.draftArtifacts?.recipes;
  const key = kind === "component" ? "componentId" : "recipeId";
  const matches = Array.isArray(items) ? items.map(record).filter(item => text(batch[key]) && item?.[key] === batch[key]) : [];
  return matches.length === 1 ? value(matches[0]?.[kind === "component" ? "label" : "name"], "Bezeichnung fehlt") : "unvollständig: Bezeichnung nicht eindeutig zugeordnet";
}
function Batch({ batch, draft }: { batch: RecordValue | undefined; draft: ProductionDraft }) {
  if (!batch) return <Warning>Produktionsansatz unvollständig.</Warning>;
  return <div>
    <p><strong>{frozenBatchName(draft, batch, "component")}</strong> · Rezept: {frozenBatchName(draft, batch, "recipe")}</p>
    <p>Skalierte Zielmenge: {quantityObject(batch.scaledYield)} · {value(batch.batchCount)} Chargen</p>
    <p>Arbeitsbereich: {station(batch.station)} · Zeitfenster: {value(batch.prepWindow)}</p>
    <Ingredients items={batch.ingredients} /><Steps items={batch.steps} />
  </div>;
}
function PlanContent({ plan, draft }: { plan: RecordValue; draft: ProductionDraft }) {
  const readiness = record(plan.readiness);
  return <>
    <p>Berechnungsstand: {label(readiness?.status, { complete: "Vollständig berechnet", partial: "Teilweise berechnet", insufficient: "Berechnung unvollständig" }, "Berechnungsstand klären")}</p>
    <Strings items={readiness?.reasons} label="Begründungen" />
    {Array.isArray(plan.productionBatches) ? <>
      <p>{plan.productionBatches.length} {plan.productionBatches.length === 1 ? "Produktionsansatz" : "Produktionsansätze"}</p>
      {plan.productionBatches.map((batch, index) => <Batch key={index} batch={record(batch)} draft={draft} />)}
    </> : <Warning>Produktionsansätze nicht verfügbar.</Warning>}
    <p><strong>Küchenblätter</strong></p>
    {Array.isArray(plan.kitchenSheets) ? plan.kitchenSheets.map((item, index) => {
      const sheet = record(item);
      return <div key={index}>
        <p><strong>{value(sheet?.title, "Küchenblatt fehlt")}</strong></p>
        <p>Produktionsmenge: {quantityObject(sheet?.productionQty)} · Arbeitsbereich: {station(sheet?.station)} · Zeitfenster: {value(sheet?.prepWindow)}</p>
        <Ingredients items={sheet?.ingredients} /><Strings items={sheet?.instructions} label="Anweisungen" /><Steps items={sheet?.steps} />
        <Strings items={sheet?.procurementNotes} label="Beschaffungshinweise" /><Strings items={sheet?.blockingNotes} label="Offene Küchenprüfung" />
      </div>;
    }) : <Warning>Küchenblätter nicht verfügbar.</Warning>}
    <p><strong>Ablauf</strong></p>
    {Array.isArray(plan.timeline) ? <ul>{plan.timeline.map((item, index) => <li key={index}>{value(record(item)?.label)}: {value(record(item)?.at)}</li>)}</ul> : <Warning>Ablauf unvollständig.</Warning>}
    <Strings items={plan.unresolvedItems} label="Offene Punkte" /><Strings items={plan.warnings} label="Warnungen" /><Strings items={plan.blockingIssues} label="Planungshindernisse" />
  </>;
}
function procurementName(source: unknown, list: RecordValue, draft: ProductionDraft): string | undefined {
  const match = text(source)?.match(/^procurement:(.+)$/);
  const spec = record(draft.draftArtifacts?.eventSpec);
  if (!match || !text(spec?.specId) || list.eventSpecId !== spec?.specId || !Array.isArray(spec?.menuPlan)) return undefined;
  const matches = spec.menuPlan.map(record).filter(component => component?.componentId === match[1]);
  const component = matches.length === 1 ? matches[0] : undefined;
  return component && ["hybrid", "convenience_purchase", "external_finished"].includes(text(record(component.productionDecision)?.mode) ?? "")
    ? text(component.label) : undefined;
}
function PurchaseContent({ list, draft }: { list: RecordValue; draft: ProductionDraft }) {
  return <>
    {!Array.isArray(list.items) ? <Warning>Einkaufspositionen nicht verfügbar.</Warning> : <>
    <p className="helper-text frozen-purchase-scroll-hint">Tabelle nach rechts verschieben, um Herkunft und Rezeptstatus zu lesen.</p>
    <div className="frozen-purchase-table" role="region" aria-label="Einkaufspositionen mit Herkunft und Rezeptstatus · seitlich verschiebbar" tabIndex={0}><table>
      <thead><tr><th>Position</th><th>Einkaufsmenge</th><th>Normalisierte Menge</th><th>Herkunft</th></tr></thead>
      <tbody>{list.items.map((item, index) => {
        const row = record(item);
        const sources = Array.isArray(row?.sourceRecipes) ? row.sourceRecipes : [];
        const metadata = Array.isArray(row?.sourceRecipeMetadata) ? row.sourceRecipeMetadata : [];
        return <tr key={index}>
          <td>{value(row?.displayName, "Position fehlt")}</td>
          <td>{quantity(row?.purchaseQty, row?.purchaseUnit)}</td>
          <td>{quantity(row?.normalizedQty, row?.normalizedUnit)}</td>
          <td>{sources.length ? sources.map((source, sourceIndex) => {
            const matches = metadata.map(record).filter(item => text(source) && item?.recipeId === source);
            if (matches.length === 1) {
              const item = matches[0];
              return <p key={sourceIndex}>{value(item?.recipeName)} · Quelle: {value(item?.reference)} · Rezeptstatus: {approvalLabel(item?.approvalState)}</p>;
            }
            const purchased = matches.length === 0 ? procurementName(source, list, draft) : undefined;
            return purchased ? <p key={sourceIndex}>Zukauf: {purchased}</p> : <Warning key={sourceIndex}>unvollständig: Herkunft klären</Warning>;
          }) : <Warning>unvollständig: Herkunft fehlt</Warning>}
          </td>
        </tr>;
      })}</tbody>
    </table></div></>}
    <p className="helper-text">Mengen und Herkunft belegen keine reale Einkaufsdeckung. Zukaufsspezifikation, Gebinde und Lieferant fachlich prüfen.</p>
  </>;
}
function RecipeContent({ recipe, draft }: { recipe: RecordValue; draft: ProductionDraft }) {
  const source = record(recipe.source);
  const baseYield = record(recipe.baseYield);
  const plan = record(draft.draftArtifacts?.productionPlan);
  const spec = record(draft.draftArtifacts?.eventSpec);
  const batches = plan?.eventSpecId === spec?.specId && text(spec?.specId) && Array.isArray(plan?.productionBatches)
    ? plan.productionBatches.map(record).filter(batch => batch?.recipeId === recipe.recipeId) : [];
  return <>
    <p>Rezept: <strong>{value(recipe.name)}</strong></p>
    <p>Basisertrag: {quantity(baseYield?.servings, baseYield?.unit)}</p>
    <p>Quelle: {value(source?.reference)} · Herkunft: {label(source?.originType, { internal_db: "Interne Rezeptsammlung", approved_import: "Importierte Rezeptsammlung", cookbook: "Kochbuch", web: "Internet" }, "Rezeptherkunft klären")} · Rezeptstatus: {approvalLabel(source?.approvalState)}</p>
    <p><strong>Basiszutaten</strong></p><Ingredients items={recipe.ingredients} />
    <p><strong>Skalierung im selben Entwurf</strong></p>
    {batches.length ? batches.map((batch, index) => <Batch key={index} batch={batch} draft={draft} />) : <Warning>Verknüpfte Skalierung nicht verfügbar.</Warning>}
    <p className="helper-text">Eine synthetische technische Prüfung ersetzt keine reale menschliche Küchenprüfung. Diese Entscheidung ist keine globale Rezept- oder Allergenfreigabe; ausstehende Rezeptprüfungen bleiben offen.</p>
  </>;
}

function Technical({ draft, card, target }: { draft: ProductionDraft; card: ProductionDraftReviewCard; target?: RecordValue }) {
  const entries = [`Unveränderlicher Entwurf: ${draft.draftId} · Revision ${value(draft.revision)}`];
  if (target && card.kind === "event_data") {
    entries.push(`Veranstaltung: ${value(target.specId)}`);
    if (Array.isArray(target.menuPlan)) for (const item of target.menuPlan) {
      const component = record(item);
      entries.push(`Menüposition: ${value(component?.componentId)} · Kategorie: ${value(component?.menuCategory)}`);
    }
  } else if (target && card.kind === "timeline") {
    entries.push(`Produktionsplan: ${value(target.planId)} · Berechnungsstand: ${value(record(target.readiness)?.status)}`);
    if (Array.isArray(target.productionBatches)) for (const item of target.productionBatches) {
      const batch = record(item);
      entries.push(`Produktionscharge: ${value(batch?.batchId)} · Menüposition: ${value(batch?.componentId)} · Rezept: ${value(batch?.recipeId)}`);
    }
    if (Array.isArray(target.kitchenSheets)) for (const item of target.kitchenSheets) entries.push(`Küchenblatt-Menüposition: ${value(record(item)?.componentId)}`);
  } else if (target && card.kind === "purchase_item") {
    entries.push(`Einkaufsliste: ${value(target.purchaseListId)}`);
    if (Array.isArray(target.items)) for (const item of target.items) {
      const row = record(item);
      if (Array.isArray(row?.sourceRecipes)) entries.push(`Position ${value(row?.displayName)} · Herkunft: ${row.sourceRecipes.map(source => value(source, "Herkunft fehlt")).join(", ")}`);
      if (Array.isArray(row?.sourceRecipeMetadata)) for (const input of row.sourceRecipeMetadata) {
        const source = record(input);
        entries.push(`Rezept: ${value(source?.recipeId)} · Status: ${value(source?.approvalState)}`);
      }
    }
  } else if (target && card.kind === "recipe") {
    const source = record(target.source);
    entries.push(`Rezept: ${value(target.recipeId)} · Herkunft: ${value(source?.originType)} · Status: ${value(source?.approvalState)}`);
    const plan = record(draft.draftArtifacts?.productionPlan);
    const spec = record(draft.draftArtifacts?.eventSpec);
    if (text(spec?.specId) && plan?.eventSpecId === spec?.specId && Array.isArray(plan?.productionBatches)) for (const input of plan.productionBatches) {
      const batch = record(input);
      if (batch?.recipeId === target.recipeId) entries.push(`Produktionscharge: ${value(batch?.batchId)} · Menüposition: ${value(batch?.componentId)}`);
    }
  }
  return <details><summary>Technische Details</summary><ul>{entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>;
}

export function ProductionDraftFrozenContent({ draft, card }: { draft: ProductionDraft; card: ProductionDraftReviewCard }) {
  if (!["event_data", "timeline", "purchase_item", "recipe"].includes(card.kind)) return null;
  const target = resolveTarget(draft, card);
  return <section aria-label={`Eingefrorener Inhalt: ${card.title}`}>
    <p className="helper-text">Gespeicherter Prüfstand · Fassung {value(draft.revision)}. Die Entscheidung gilt nur für diese Fassung.</p>
    {!target ? <Warning /> : card.kind === "event_data" ? <EventContent spec={target} />
      : card.kind === "timeline" ? <PlanContent plan={target} draft={draft} />
        : card.kind === "purchase_item" ? <PurchaseContent list={target} draft={draft} />
          : <RecipeContent recipe={target} draft={draft} />}
    <Technical draft={draft} card={card} target={target} />
  </section>;
}
