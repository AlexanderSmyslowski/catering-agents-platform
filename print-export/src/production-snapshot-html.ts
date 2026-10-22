import { formatRecipeApprovalStateLabel, productionContextNotes, recipeSourceOriginLabel, recipeSourceReferenceLabel, type AcceptedEventSpec, type KitchenSheet, type ProductionPlan, type PurchaseList } from "@catering/shared-core";
import type { AppliedProductionSnapshot } from "./applied-production-snapshot.js";
import { formatPreparationWindow, formatProductionStation } from "./document-labels.js";

function escapeHtml(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function quantity(value: { amount: number; unit: string } | undefined): string {
  return value ? `${value.amount.toLocaleString("de-DE", { maximumSignificantDigits: 15 })} ${value.unit === "servings" ? "Portionen" : value.unit}` : "offen";
}

export function renderAppliedProductionContext(snapshot?: AppliedProductionSnapshot): string {
  if (!snapshot) return "";
  const { productionCase, approvedSpec, manifest } = snapshot;
  return `<section><h2>Freigegebener Produktionsstand</h2><ul>${[
    `Fall: ${productionCase.caseId}`, `ApprovedProductionSpec: ${approvedSpec.approvedProductionSpecId}`,
    `Quelldraft: ${approvedSpec.sourceDraft.draftId} · Revision ${approvedSpec.sourceDraft.revision}`,
    `Apply: ${manifest.approvedProductionSpecId} · ${manifest.appliedAt}`,
    `Produktionsplan: ${manifest.planId}`, `Einkaufsliste: ${manifest.purchaseListId}`
  ].map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></section>`;
}

export function renderFrozenKitchenAllergens(sheet?: KitchenSheet): string {
  const labels: Record<string, string> = { egg: "Ei", mustard: "Senf", milk: "Milch", nuts: "Nüsse", gluten: "Gluten" };
  const allergens = sheet?.allergens;
  const label = allergens === undefined ? "Allergene nicht hinterlegt – vor Produktion prüfen"
    : allergens.length === 0 ? "Keine ausgewiesenen Allergene"
    : [...new Set(allergens.map(value => labels[value.toLowerCase()] ?? value))].join(", ");
  return `<p class="recipe-allergens"><strong>Allergene:</strong> ${escapeHtml(label)}</p><p class="allergen-caution">Planangabe, keine Zusicherung von Allergenfreiheit. Lieferantendeklaration und Kreuzkontakt gesondert prüfen.</p>`;
}

export function renderProductionOrderContext(spec?: AcceptedEventSpec): string {
  const notes = productionContextNotes(spec);
  if (!notes.length) return "";
  // Individual cards may leave the folder. Keep all recorded order instructions
  // with each card; their presence does not assign a diet to this recipe.
  return `<div class="production-order-context"><p><strong>Auftrags- und Sonderkosthinweise</strong></p><p>Gelten für den gesamten Auftrag. Zuordnung vor Produktion prüfen.</p><p>Keine Sonderkost-, Allergen- oder Hygienefreigabe. Angefragte Sonderkost separat klären.</p><ul>${notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ul></div>`;
}

export function renderProductionKitchenSheets(plan: ProductionPlan, spec?: AcceptedEventSpec): string {
  return `<section><h2>Küchenblätter</h2>${plan.kitchenSheets.map(sheet => {
    const batch = plan.productionBatches.find(item => item.componentId === sheet.componentId && item.recipeId === sheet.recipeId);
    const source = sheet.recipeSource ?? batch?.recipeSource;
    const station = batch?.station ?? sheet.station;
    const explicitStation = spec?.menuPlan?.find(item => item.componentId === sheet.componentId)?.productionStation;
    const ingredients = sheet.ingredients.length ? sheet.ingredients : batch?.ingredients ?? [];
    const steps = [...sheet.steps, ...(batch?.steps ?? []).filter(step =>
      !sheet.steps.some(sheetStep => sheetStep.instruction === step.instruction)
    )];
    return `<article class="kitchen-sheet"><h3>${escapeHtml(sheet.title)}</h3>${renderProductionOrderContext(spec)}${renderFrozenKitchenAllergens(sheet)}<p>Gesamtmenge: ${escapeHtml(quantity(batch?.scaledYield ?? sheet.productionQty))}${batch ? ` · Geplante Rezeptansätze: ${escapeHtml(batch.batchCount)}` : ""}</p><p>Station: ${escapeHtml(formatProductionStation(station, explicitStation === station))} · Vorbereitung (Planangabe, prüfen): ${escapeHtml(formatPreparationWindow(batch?.prepWindow ?? sheet.prepWindow, spec?.event?.date))}</p><p>Quelle: ${escapeHtml(recipeSourceOriginLabel(source))} · ${escapeHtml(recipeSourceReferenceLabel(source))} · Status: ${escapeHtml(formatRecipeApprovalStateLabel(source?.approvalState) ?? "Status offen")}</p><ul>${ingredients.map(ingredient => `<li>${escapeHtml(ingredient.name)}: ${escapeHtml(quantity(ingredient.quantity))}</li>`).join("")}</ul><ol>${steps.map(step => `<li>${escapeHtml(step.instruction)}</li>`).join("")}</ol></article>`;
  }).join("")}</section>`;
}

export function renderAppliedPurchaseQuantities(list?: PurchaseList): string {
  return list ? `<section><h2>Einkaufsmengen</h2><ul>${list.items.map(item => `<li>${escapeHtml(item.displayName)}: ${escapeHtml(quantity({ amount: item.purchaseQty, unit: item.purchaseUnit }))}</li>`).join("")}</ul></section>` : "";
}
