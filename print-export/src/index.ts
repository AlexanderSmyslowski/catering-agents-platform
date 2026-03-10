import type { OfferDraft, ProductionPlan, PurchaseList } from "@catering/shared-core";

function escapeCsv(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function renderOfferHtml(draft: OfferDraft): string {
  return [
    "<html><body>",
    `<h1>Angebot ${draft.draftId}</h1>`,
    `<p>${draft.eventSummary}</p>`,
    "<ul>",
    ...draft.serviceModules.map((module) => `<li>${module.label}</li>`),
    "</ul>",
    `<p>Gesamt: ${draft.pricingSummary.subtotal.amount.toFixed(2)} ${draft.pricingSummary.subtotal.currency}</p>`,
    "<pre>",
    draft.customerFacingText,
    "</pre>",
    "</body></html>"
  ].join("");
}

export function renderProductionPlanHtml(plan: ProductionPlan): string {
  return [
    "<html><body>",
    `<h1>Produktionsplan ${plan.planId}</h1>`,
    `<p>Status: ${plan.readiness.status}</p>`,
    ...plan.productionBatches.map(
      (batch) =>
        `<section><h2>${batch.componentId}</h2><p>Station: ${batch.station}</p><ol>${batch.steps
          .map((step) => `<li>${step.instruction}</li>`)
          .join("")}</ol></section>`
    ),
    "</body></html>"
  ].join("");
}

export function renderPurchaseListCsv(list: PurchaseList): string {
  const header = [
    "group",
    "item",
    "normalizedQty",
    "normalizedUnit",
    "purchaseQty",
    "purchaseUnit",
    "supplierHint"
  ]
    .map(escapeCsv)
    .join(",");

  const rows = list.items.map((item) =>
    [
      item.group,
      item.displayName,
      item.normalizedQty,
      item.normalizedUnit,
      item.purchaseQty,
      item.purchaseUnit,
      item.supplierHint ?? ""
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [header, ...rows].join("\n");
}

