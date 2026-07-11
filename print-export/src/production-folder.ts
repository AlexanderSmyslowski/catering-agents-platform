import {
  buildProductionClarificationQuestions,
  checkPurchaseCoverage,
  formatEventTypeLabel,
  formatMetroGroupLabel,
  formatRecipeApprovalStateLabel,
  formatServiceFormLabel,
  metroGroupSortIndex,
  type AcceptedEventSpec,
  type IngredientLine,
  type ProductionClarificationAnswer,
  type ProductionBatch,
  type ProductionPlan,
  type PurchaseItem,
  type PurchaseList,
  type Recipe,
  type RecipeStep
} from "@catering/shared-core";

export interface RenderProductionFolderInput {
  plan: ProductionPlan;
  spec: AcceptedEventSpec;
  purchaseLists?: PurchaseList[];
  recipes?: Recipe[];
  clarificationAnswers?: ProductionClarificationAnswer[];
}

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("de-DE")
    : value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function formatUnit(unit: string): string {
  return unit === "servings" ? "Portionen" : unit;
}

function formatQuantity(quantity?: { amount: number; unit: string }): string {
  if (!quantity) {
    return "offen";
  }

  return `${formatNumber(quantity.amount)} ${formatUnit(quantity.unit)}`;
}

function formatMoney(value?: { amount: number; currency: string }): string | undefined {
  if (!value) {
    return undefined;
  }

  return `${formatNumber(value.amount)} ${value.currency}`;
}

function row(label: string, value: string | undefined): string {
  if (!value) {
    return "";
  }

  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function componentLabel(spec: AcceptedEventSpec, componentId: string): string {
  return spec.menuPlan.find((component) => component.componentId === componentId)?.label ?? componentId;
}

function recipeIdsForPlan(plan: ProductionPlan): string[] {
  return [
    ...new Set(
      [
        ...plan.kitchenSheets.flatMap((sheet) => sheet.recipeId ?? []),
        ...plan.recipeSelections.flatMap((selection) => selection.recipeId ?? [])
      ].filter(Boolean)
    )
  ];
}

function linkedRecipeLabel(
  recipeById: Map<string, Recipe>,
  recipeId: string | undefined
): string {
  if (!recipeId) {
    return "offen";
  }

  return recipeById.get(recipeId)?.name ?? `Rezept nicht gefunden (${recipeId})`;
}

function productionQuantityFor(
  sheet: { productionQty?: ProductionPlan["kitchenSheets"][number]["productionQty"] } | undefined,
  batch: ProductionBatch | undefined
) {
  return batch?.scaledYield ?? sheet?.productionQty;
}

function ingredientsFor(
  sheet: ProductionPlan["kitchenSheets"][number] | undefined,
  batch: ProductionBatch | undefined,
  recipe: Recipe | undefined
): IngredientLine[] {
  if (batch?.ingredients.length) {
    return batch.ingredients;
  }
  if (sheet?.ingredients.length) {
    return sheet.ingredients;
  }
  return recipe?.ingredients ?? [];
}

function stepsFor(
  recipe: Recipe | undefined,
  sheet: ProductionPlan["kitchenSheets"][number] | undefined,
  batch: ProductionBatch | undefined
): RecipeStep[] {
  if (recipe?.steps.length) {
    return recipe.steps;
  }
  if (batch?.steps.length) {
    return batch.steps;
  }
  return sheet?.steps ?? [];
}

function batchFor(
  plan: ProductionPlan,
  componentId: string,
  recipeId?: string
): ProductionBatch | undefined {
  return plan.productionBatches.find((batch) =>
    batch.componentId === componentId && (!recipeId || batch.recipeId === recipeId)
  );
}

function formatBudgetContext(spec: AcceptedEventSpec): string | undefined {
  const budget = spec.budgetContext;
  if (!budget) {
    return undefined;
  }

  return [
    budget.targetBudget ? `Zielbudget ${formatMoney(budget.targetBudget)}` : undefined,
    budget.pricingSummary?.perPerson ? `pro Person ${formatMoney(budget.pricingSummary.perPerson)}` : undefined,
    budget.pricingSummary?.subtotal ? `gesamt ${formatMoney(budget.pricingSummary.subtotal)}` : undefined
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderSection1(spec: AcceptedEventSpec): string {
  const customer = spec.customer?.name;
  const venue = [spec.venue?.name, spec.venue?.address].filter(Boolean).join(" · ");
  const eventType = formatEventTypeLabel(spec.servicePlan.eventType) ?? spec.event.type;
  const serviceForm =
    formatServiceFormLabel(spec.event.serviceForm ?? spec.servicePlan.serviceForm) ??
    spec.event.serviceForm ??
    spec.servicePlan.serviceForm;

  return `<section><h2>1. Eckpunkte</h2><table class="facts"><tbody>${[
    row("Eventtyp", eventType),
    row("Serviceform", serviceForm),
    row("Datum", spec.event.date),
    row("Personenzahl", spec.attendees.expected ? String(spec.attendees.expected) : undefined),
    row("Kunde", customer),
    row("Ort", venue || undefined),
    row("Preisrahmen", formatBudgetContext(spec))
  ].join("")}</tbody></table></section>`;
}

function renderSection2(input: RenderProductionFolderInput, recipeById: Map<string, Recipe>): string {
  if (input.spec.menuPlan.length === 0) {
    return `<section><h2>2. Verständnis des Angebots</h2><p>Keine Menükomponenten im Spec.</p></section>`;
  }

  const rows = input.spec.menuPlan.map((component) => {
    const selection = input.plan.recipeSelections.find((candidate) => candidate.componentId === component.componentId);
    const portions = component.servings ?? input.spec.attendees.expected;

    return `<tr><td>${escapeHtml(component.label)}</td><td>${escapeHtml(linkedRecipeLabel(recipeById, selection?.recipeId))}</td><td>${escapeHtml(portions ? String(portions) : "offen")}</td></tr>`;
  });

  return `<section><h2>2. Verständnis des Angebots</h2><table><thead><tr><th>Menükomponente</th><th>zugeordnetes Rezept</th><th>Portionen</th></tr></thead><tbody>${rows.join("")}</tbody></table></section>`;
}

function renderSection3(input: RenderProductionFolderInput): string {
  const questions = buildProductionClarificationQuestions({
    spec: input.spec as unknown as Record<string, unknown>
  });
  const questionById = new Map(questions.map((question) => [question.questionId, question.prompt]));
  const uncertaintyRows = (input.spec.uncertainties ?? []).map((uncertainty) =>
    `Offen: ${uncertainty.suggestedQuestion ?? uncertainty.message}`
  );
  const answerRows = (input.clarificationAnswers ?? [])
    .filter((answer) => answer.context.specId === input.spec.specId && answer.status === "submitted")
    .map((answer) => {
      const question = questionById.get(answer.questionId) ?? answer.questionKey.reasonCode;
      return `${question} → ${answer.answerText.value}`;
    });
  const entries = [...uncertaintyRows, ...answerRows];

  return `<section><h2>3. Rückfragen</h2>${
    entries.length > 0 ? list(entries) : "<p>Keine blockierenden Rückfragen.</p>"
  }</section>`;
}

function renderSection4(input: RenderProductionFolderInput): string {
  const assumptions = (input.spec.assumptions ?? []).map((assumption) =>
    `${assumption.applied ? "angewendet" : "offen"}: ${assumption.message}`
  );
  const warnings = (input.plan.warnings ?? []).map((warning) => `Warnung: ${warning}`);
  const entries = [...assumptions, ...warnings];

  return `<section><h2>4. Fachliche Festlegungen</h2>${
    entries.length > 0 ? list(entries) : "<p>Keine fachlichen Festlegungen hinterlegt.</p>"
  }</section>`;
}

function renderSection5(spec: AcceptedEventSpec): string {
  const budget = spec.budgetContext;
  const priceRows = budget
    ? [
        row("Speisenpreis pro Person", formatMoney(budget.pricingSummary?.perPerson)),
        row("Speisenpreis gesamt", formatMoney(budget.pricingSummary?.subtotal)),
        row("Zielbudget", formatMoney(budget.targetBudget))
      ].join("")
    : "";

  return `<section><h2>5. Kalkulationsübersicht</h2><table class="facts"><tbody>${[
    row("Personen", spec.attendees.expected ? String(spec.attendees.expected) : "offen"),
    priceRows,
    row("Wirtschaftliche Plausibilität", "manuell zu bewerten — prüfbedürftig")
  ].join("")}</tbody></table></section>`;
}

function renderSection6(input: RenderProductionFolderInput, recipeById: Map<string, Recipe>): string {
  const sources = input.plan.kitchenSheets.length > 0
    ? input.plan.kitchenSheets
    : input.plan.productionBatches.map((batch) => ({
        componentId: batch.componentId,
        recipeId: batch.recipeId,
        productionQty: batch.scaledYield
      }));

  if (sources.length === 0) {
    return `<section><h2>6. Mengenkalkulation je Gericht</h2><p>Keine Produktionsmengen im Plan.</p></section>`;
  }

  const pax = input.spec.attendees.expected;
  const rows = sources.map((source) => {
    const batch = batchFor(input.plan, source.componentId, source.recipeId);
    const recipe = source.recipeId ? recipeById.get(source.recipeId) : undefined;
    const total = productionQuantityFor("productionQty" in source ? source : undefined, batch);
    const perPerson = pax && total
      ? `${formatNumber(total.amount / pax)} ${formatUnit(total.unit)} p. P.`
      : "offen";
    const lossFactor = recipe?.scalingRules.defaultLossFactor ?? batch?.lossFactor ?? 1;
    const lossNote = lossFactor > 1 ? `Verlustfaktor ${formatNumber(lossFactor)}` : "";

    return `<tr><td>${escapeHtml(componentLabel(input.spec, source.componentId))}</td><td>${escapeHtml(linkedRecipeLabel(recipeById, source.recipeId))}</td><td>${escapeHtml(perPerson)}</td><td>${escapeHtml(formatQuantity(total))}</td><td>${escapeHtml(lossNote)}</td></tr>`;
  });

  return `<section><h2>6. Mengenkalkulation je Gericht</h2><table><thead><tr><th>Gericht</th><th>Rezept</th><th>Menge pro Person</th><th>Gesamtmenge</th><th>Verlustfaktor</th></tr></thead><tbody>${rows.join("")}</tbody></table></section>`;
}

function renderIngredientRows(ingredients: IngredientLine[]): string {
  if (ingredients.length === 0) {
    return `<tr><td colspan="3">Keine skalierte Zutaten-Tabelle im Plan.</td></tr>`;
  }

  return ingredients.map((ingredient) =>
    `<tr><td>${escapeHtml(ingredient.name)}</td><td>${escapeHtml(formatQuantity(ingredient.quantity))}</td><td>${escapeHtml(formatMetroGroupLabel(ingredient.group))}</td></tr>`
  ).join("");
}

function renderSteps(steps: RecipeStep[]): string {
  if (steps.length === 0) {
    return "<p>Keine Arbeitsschritte hinterlegt.</p>";
  }

  return `<ol>${steps
    .sort((left, right) => left.index - right.index)
    .map((step) => `<li>${escapeHtml(step.instruction)}</li>`)
    .join("")}</ol>`;
}

function renderSection7(input: RenderProductionFolderInput, recipeById: Map<string, Recipe>): string {
  const linkedRecipeIds = recipeIdsForPlan(input.plan);
  const recipeCards = linkedRecipeIds.flatMap((recipeId) => {
    const recipe = recipeById.get(recipeId);
    if (!recipe) {
      return [];
    }

    const sheet = input.plan.kitchenSheets.find((candidate) => candidate.recipeId === recipeId);
    const batch = input.plan.productionBatches.find((candidate) => candidate.recipeId === recipeId);
    const ingredients = ingredientsFor(sheet, batch, recipe);

    const approvalStateLabel = formatRecipeApprovalStateLabel(recipe.source.approvalState) ?? "Status offen";

    return [`<article class="recipe-card"><h3>${escapeHtml(recipe.name)}</h3><p>Quelle: ${escapeHtml(recipe.source.reference)} · Status: ${escapeHtml(approvalStateLabel)}</p><table><thead><tr><th>Zutat</th><th>Menge</th><th>Warengruppe</th></tr></thead><tbody>${renderIngredientRows(ingredients)}</tbody></table>${renderSteps(stepsFor(recipe, sheet, batch))}</article>`];
  });
  const missingRecipeIds = linkedRecipeIds.filter((recipeId) => !recipeById.has(recipeId));

  if (recipeCards.length === 0) {
    return `<section><h2>7. Rezeptkarten</h2><p>keine freigegebenen Rezeptkarten verknüpft.</p></section>`;
  }

  const missingHint = missingRecipeIds.length > 0
    ? `<p>Fehlende Rezeptkarten: ${escapeHtml(missingRecipeIds.join(", "))}</p>`
    : "";

  return `<section><h2>7. Rezeptkarten</h2>${missingHint}${recipeCards.join("")}</section>`;
}

function recipeUseLabel(
  sourceRecipe: string,
  recipeById: Map<string, Recipe>,
  spec: AcceptedEventSpec
): string {
  const procurementMatch = sourceRecipe.match(/^procurement:(.+)$/);
  if (procurementMatch) {
    return componentLabel(spec, procurementMatch[1]);
  }

  return recipeById.get(sourceRecipe)?.name ?? sourceRecipe;
}

function purchaseItemUsage(
  item: PurchaseItem,
  recipeById: Map<string, Recipe>,
  spec: AcceptedEventSpec
): string {
  return item.sourceRecipes.map((sourceRecipe) => recipeUseLabel(sourceRecipe, recipeById, spec)).join(", ");
}

function groupPurchaseItems(items: PurchaseItem[]): Array<{ group: string; items: PurchaseItem[] }> {
  const grouped = new Map<string, PurchaseItem[]>();
  for (const item of [...items].sort((left, right) =>
    metroGroupSortIndex(left.group) - metroGroupSortIndex(right.group) ||
    left.group.localeCompare(right.group, "de") ||
    left.displayName.localeCompare(right.displayName, "de")
  )) {
    grouped.set(item.group, [...(grouped.get(item.group) ?? []), item]);
  }

  return [...grouped.entries()].map(([group, groupItems]) => ({ group, items: groupItems }));
}

function renderSection8(
  purchaseList: PurchaseList | undefined,
  recipeById: Map<string, Recipe>,
  spec: AcceptedEventSpec
): string {
  if (!purchaseList) {
    return `<section><h2>8. Einkaufsliste nach Metro-Logik</h2><p>Keine Einkaufsliste verknüpft.</p></section>`;
  }

  const groups = groupPurchaseItems(purchaseList.items);
  if (groups.length === 0) {
    return `<section><h2>8. Einkaufsliste nach Metro-Logik</h2><p>Keine Einkaufspositionen hinterlegt.</p></section>`;
  }

  const content = groups.map(({ group, items }) =>
    `<h3>${escapeHtml(formatMetroGroupLabel(group))}</h3><table><thead><tr><th>Artikel</th><th>Menge</th><th>Einkaufshinweis</th><th>Verwendung</th></tr></thead><tbody>${items.map((item) =>
      `<tr><td>${escapeHtml(item.displayName)}</td><td>${escapeHtml(`${formatNumber(item.purchaseQty)} ${item.purchaseUnit}`)}</td><td>${escapeHtml(item.supplierHint ?? "")}</td><td>${escapeHtml(purchaseItemUsage(item, recipeById, spec))}</td></tr>`
    ).join("")}</tbody></table>`
  ).join("");

  return `<section><h2>8. Einkaufsliste nach Metro-Logik</h2>${content}</section>`;
}

function timelineGroup(
  entry: ProductionPlan["timeline"][number],
  eventDate?: string
): "Vortag" | "Veranstaltungstag" | undefined {
  if (!eventDate || !entry.at.includes(eventDate)) {
    return undefined;
  }
  if (/\bT-1\b/.test(entry.at)) {
    return "Vortag";
  }
  return "Veranstaltungstag";
}

function renderTimeline(plan: ProductionPlan, eventDate?: string): string {
  if (plan.timeline.length === 0) {
    return "<p>Keine Mise-en-Place-Slots im Plan.</p>";
  }

  const sorted = [...plan.timeline].sort((left, right) =>
    left.at.localeCompare(right.at, "de") || left.label.localeCompare(right.label, "de")
  );
  const grouped = sorted.map((entry) => ({ entry, group: timelineGroup(entry, eventDate) }));
  const canGroup = grouped.every((item) => item.group);

  if (!canGroup) {
    return `<ul>${sorted.map((entry) => `<li>${escapeHtml(entry.at)} · ${escapeHtml(entry.label)}</li>`).join("")}</ul>`;
  }

  return ["Vortag", "Veranstaltungstag"].map((group) => {
    const entries = grouped.filter((item) => item.group === group).map((item) => item.entry);
    return entries.length > 0
      ? `<h3>${group}</h3><ul>${entries.map((entry) => `<li>${escapeHtml(entry.at)} · ${escapeHtml(entry.label)}</li>`).join("")}</ul>`
      : "";
  }).join("");
}

const COVERAGE_ROWS_PER_BLOCK = 20;

function renderCoverageRow(result: string, check: string, purchaseItem: string): string {
  return `<div class="coverage-row" role="row"><div class="coverage-cell" role="cell">${escapeHtml(result)}</div><div class="coverage-cell" role="cell">${escapeHtml(check)}</div><div class="coverage-cell" role="cell">${escapeHtml(purchaseItem)}</div></div>`;
}

function renderCoverage(plan: ProductionPlan, purchaseList: PurchaseList | undefined): string {
  if (!purchaseList) {
    return "<p>Zutatenabgleich: keine Einkaufsliste verknüpft.</p>";
  }

  const coverage = checkPurchaseCoverage(plan, purchaseList);
  const rows = [
    ...coverage.coveredIngredients.map((item) =>
      renderCoverageRow("gedeckt", item.name, item.displayName)
    ),
    ...coverage.missingIngredients.map((item) =>
      renderCoverageRow("fehlend", item.name, "")
    )
  ];

  if (rows.length === 0) {
    return "<p>Zutatenabgleich: keine Zutatenprüfpunkte im Plan.</p>";
  }

  const blocks: string[] = [];
  // Chromium can drop cells when one table spans several printed pages. Small
  // semantic grid blocks keep every audit result visible and repeat the head.
  for (let index = 0; index < rows.length; index += COVERAGE_ROWS_PER_BLOCK) {
    const blockRows = rows.slice(index, index + COVERAGE_ROWS_PER_BLOCK);
    blocks.push(`<div class="coverage-table" role="table" aria-label="Zutatenabgleich"><div role="rowgroup"><div class="coverage-row coverage-head" role="row"><div class="coverage-cell" role="columnheader">Ergebnis</div><div class="coverage-cell" role="columnheader">Prüfpunkt</div><div class="coverage-cell" role="columnheader">Einkaufsposition</div></div></div><div role="rowgroup">${blockRows.join("")}</div></div>`);
  }

  return blocks.join("");
}

function renderSection9(plan: ProductionPlan, purchaseList: PurchaseList | undefined, eventDate?: string): string {
  return `<section><h2>9. Mise-en-Place &amp; Abschlussprüfung</h2>${renderTimeline(plan, eventDate)}<h3>Zutatenabgleich</h3>${renderCoverage(plan, purchaseList)}</section>`;
}

function primaryPurchaseListFor(spec: AcceptedEventSpec, purchaseLists: PurchaseList[]): PurchaseList | undefined {
  return [...purchaseLists]
    .filter((listItem) => listItem.eventSpecId === spec.specId)
    .sort((left, right) => left.purchaseListId.localeCompare(right.purchaseListId, "de"))[0];
}

function headerMeta(spec: AcceptedEventSpec): string {
  return [
    spec.customer?.name,
    spec.venue?.name ?? spec.venue?.address,
    spec.event.date,
    spec.attendees.expected ? `${spec.attendees.expected} Personen` : undefined
  ]
    .filter(Boolean)
    .join(" | ");
}

export function renderProductionFolderHtml(input: RenderProductionFolderInput): string {
  const recipes = input.recipes ?? [];
  const recipeById = new Map(recipes.map((recipe) => [recipe.recipeId, recipe]));
  const purchaseList = primaryPurchaseListFor(input.spec, input.purchaseLists ?? []);

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Produktionsmappe – Rezeptkarten und aufsummierte Einkaufsliste</title><style>
@page { size: A4; margin: 18mm; }
body { color: #1f2933; font-family: Inter, Arial, sans-serif; font-size: 12px; line-height: 1.45; margin: 0; }
header.document-header { border-bottom: 1px solid #cbd5df; margin-bottom: 18px; padding-bottom: 10px; }
h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
h2 { border-bottom: 1px solid #d9e2ec; font-size: 15px; margin: 22px 0 8px; padding-bottom: 4px; }
h3 { font-size: 13px; margin: 14px 0 6px; }
p { margin: 6px 0; }
table { border-collapse: collapse; margin: 8px 0 12px; width: 100%; }
th, td { border: 1px solid #d9e2ec; padding: 5px 6px; text-align: left; vertical-align: top; }
th { background: #f4f7fa; font-weight: 700; }
.facts th { width: 32%; }
.recipe-card { break-inside: auto; margin: 12px 0; }
.coverage-table { border-left: 1px solid #d9e2ec; margin: 8px 0 12px; }
.coverage-row { display: grid; grid-template-columns: minmax(78px, .55fr) minmax(0, 2fr) minmax(0, 2fr); }
.coverage-cell { border-bottom: 1px solid #d9e2ec; border-right: 1px solid #d9e2ec; padding: 5px 6px; }
.coverage-head .coverage-cell { background: #f4f7fa; border-top: 1px solid #d9e2ec; font-weight: 700; }
footer { border-top: 1px solid #cbd5df; color: #52616f; margin-top: 24px; padding-top: 8px; }
@media print {
  body { font-size: 11px; }
  h2, h3, .recipe-card > h3, .recipe-card > h3 + p { break-after: avoid-page; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .coverage-table { break-inside: avoid; page-break-inside: avoid; }
}
</style></head><body><header class="document-header"><h1>Produktionsmappe – Rezeptkarten und aufsummierte Einkaufsliste</h1><p>${escapeHtml(headerMeta(input.spec))}</p></header>${[
    renderSection1(input.spec),
    renderSection2(input, recipeById),
    renderSection3(input),
    renderSection4(input),
    renderSection5(input.spec),
    renderSection6(input, recipeById),
    renderSection7(input, recipeById),
    renderSection8(purchaseList, recipeById, input.spec),
    renderSection9(input.plan, purchaseList, input.spec.event.date)
  ].join("")}<footer>Arbeitsdokument – Mengen, Allergene und Preise vor Produktion prüfen.</footer></body></html>`;
}
