import type { ProductionDraft, ProductionDraftReviewCard } from "./api.js";

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
  return `${number(amount) ?? "unvollständig: Menge fehlt"} ${text(unit) ?? "unvollständig: Einheit fehlt"}`;
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
    <p>Event-Spec: {value(spec.specId)} | Datum: {value(event?.date)} | Personen: {value(attendees?.expected ?? attendees?.guaranteed)}</p>
    <p><strong>Zeitfenster</strong></p>
    {Array.isArray(event?.schedule) && event.schedule.length ? <ul>{event.schedule.map((item, index) => {
      const slot = record(item);
      return <li key={index}>{value(slot?.label)}: {value(slot?.start)} – {value(slot?.end)}</li>;
    })}</ul> : <Warning>Zeitfenster nicht verfügbar.</Warning>}
    <p><strong>Komponenten</strong></p>
    {Array.isArray(spec.menuPlan) && spec.menuPlan.length ? <ul>{spec.menuPlan.map((item, index) => {
      const component = record(item);
      const decision = record(component?.productionDecision);
      const mode = text(decision?.mode);
      return <li key={index}>{value(component?.label)} ({value(component?.componentId)}) · Kategorie: {value(component?.menuCategory)} · Herstellung: {mode && Object.hasOwn(modeLabels, mode) ? modeLabels[mode] : value(undefined, "Herstellungsweg unbekannt")} · Portionen: {value(component?.servings)}
        <Strings items={decision?.purchasedElements} label="Zukauf" />
        {decision?.notes !== undefined && <p>{value(decision.notes)}</p>}
      </li>;
    })}</ul> : <Warning>Komponenten nicht verfügbar.</Warning>}
  </>;
}
function Batch({ batch }: { batch: RecordValue | undefined }) {
  if (!batch) return <Warning>Produktionsbatch unvollständig.</Warning>;
  return <div>
    <p>Batch: {value(batch.batchId)} · Komponente: {value(batch.componentId)} · Rezept: {value(batch.recipeId)}</p>
    <p>Skalierte Zielmenge: {quantityObject(batch.scaledYield)} · {value(batch.batchCount)} Chargen (batchCount)</p>
    <p>Station: {value(batch.station)} · Zeitfenster: {value(batch.prepWindow)}</p>
    <Ingredients items={batch.ingredients} /><Steps items={batch.steps} />
  </div>;
}
function PlanContent({ plan }: { plan: RecordValue }) {
  const readiness = record(plan.readiness);
  return <>
    <p>Plan: {value(plan.planId)} · Planungsstand: {value(readiness?.status)}</p>
    <Strings items={readiness?.reasons} label="Begründungen" />
    {Array.isArray(plan.productionBatches) ? <>
      <p>{plan.productionBatches.length} {plan.productionBatches.length === 1 ? "Produktionsbatch" : "Produktionsbatches"}</p>
      {plan.productionBatches.map((batch, index) => <Batch key={index} batch={record(batch)} />)}
    </> : <Warning>Produktionsbatches nicht verfügbar.</Warning>}
    <p><strong>Küchenblätter</strong></p>
    {Array.isArray(plan.kitchenSheets) ? plan.kitchenSheets.map((item, index) => {
      const sheet = record(item);
      return <div key={index}>
        <p><strong>{value(sheet?.title, "Küchenblatt fehlt")}</strong> · Komponente: {value(sheet?.componentId)}</p>
        <p>Produktionsmenge: {quantityObject(sheet?.productionQty)} · Station: {value(sheet?.station)} · Zeitfenster: {value(sheet?.prepWindow)}</p>
        <Ingredients items={sheet?.ingredients} /><Strings items={sheet?.instructions} label="Anweisungen" /><Steps items={sheet?.steps} />
        <Strings items={sheet?.procurementNotes} label="Beschaffungshinweise" /><Strings items={sheet?.blockingNotes} label="Offene Küchenprüfung" />
      </div>;
    }) : <Warning>Küchenblätter nicht verfügbar.</Warning>}
    {Array.isArray(plan.timeline) ? <ul>{plan.timeline.map((item, index) => <li key={index}>{value(record(item)?.label)}: {value(record(item)?.at)}</li>)}</ul> : <Warning>Ablauf unvollständig.</Warning>}
    <Strings items={plan.unresolvedItems} label="Offene Punkte" /><Strings items={plan.warnings} label="Warnungen" /><Strings items={plan.blockingIssues} label="Planungshindernisse" />
  </>;
}
function PurchaseContent({ list }: { list: RecordValue }) {
  return <>
    <p>Einkaufsliste: {value(list.purchaseListId)}</p>
    {!Array.isArray(list.items) ? <Warning>Einkaufspositionen nicht verfügbar.</Warning> : <table>
      <thead><tr><th>Position</th><th>Einkaufsmenge</th><th>Normalisierte Menge</th><th>Herkunft</th></tr></thead>
      <tbody>{list.items.map((item, index) => {
        const row = record(item);
        const sources = Array.isArray(row?.sourceRecipes) ? row.sourceRecipes : [];
        const metadata = Array.isArray(row?.sourceRecipeMetadata) ? row.sourceRecipeMetadata : [];
        return <tr key={index}>
          <td>{value(row?.displayName, "Position fehlt")}</td>
          <td>{quantity(row?.purchaseQty, row?.purchaseUnit)}</td>
          <td>{quantity(row?.normalizedQty, row?.normalizedUnit)}</td>
          <td>{sources.length ? <ul>{sources.map((source, sourceIndex) => <li key={sourceIndex}>{value(source, "Herkunft fehlt")}</li>)}</ul> : <Warning>unvollständig: Herkunft fehlt</Warning>}
            {metadata.map((input, metadataIndex) => {
              const source = record(input);
              return <p key={metadataIndex}>{value(source?.recipeName)} ({value(source?.recipeId)}) · Quelle: {value(source?.reference)} · Status: {value(source?.approvalState)}</p>;
            })}
          </td>
        </tr>;
      })}</tbody>
    </table>}
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
    <p>Rezept: {value(recipe.name)} ({value(recipe.recipeId)})</p>
    <p>Basisertrag: {quantity(baseYield?.servings, baseYield?.unit)}</p>
    <p>Quelle: {value(source?.reference)} · Herkunft: {value(source?.originType)} · Rezeptstatus: {value(source?.approvalState)}</p>
    <p><strong>Basiszutaten</strong></p><Ingredients items={recipe.ingredients} />
    <p><strong>Skalierung im selben Entwurf</strong></p>
    {batches.length ? batches.map((batch, index) => <Batch key={index} batch={batch} />) : <Warning>Verknüpfte Skalierung nicht verfügbar.</Warning>}
    <p className="helper-text">Eine synthetische technische Prüfung ersetzt keine reale menschliche Küchenprüfung. Diese Entscheidung ist keine globale Rezept- oder Allergenfreigabe; ein Rezept mit review_required bleibt prüfpflichtig.</p>
  </>;
}

export function ProductionDraftFrozenContent({ draft, card }: { draft: ProductionDraft; card: ProductionDraftReviewCard }) {
  if (!["event_data", "timeline", "purchase_item", "recipe"].includes(card.kind)) return null;
  const target = resolveTarget(draft, card);
  return <section aria-label={`Eingefrorener Inhalt: ${card.title}`}>
    <p className="helper-text">Unveränderlicher Entwurf {draft.draftId} · Revision {value(draft.revision)}</p>
    {!target ? <Warning /> : card.kind === "event_data" ? <EventContent spec={target} />
      : card.kind === "timeline" ? <PlanContent plan={target} />
        : card.kind === "purchase_item" ? <PurchaseContent list={target} />
          : <RecipeContent recipe={target} draft={draft} />}
  </section>;
}
