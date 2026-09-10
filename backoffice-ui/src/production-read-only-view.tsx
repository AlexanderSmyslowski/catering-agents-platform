import type { ProductionPlan, PurchaseList, Quantity } from "@catering/shared-core";

const ALLERGEN_LABELS: Readonly<Record<string, string>> = {
  egg: "Ei",
  mustard: "Senf",
  milk: "Milch",
  nuts: "Nüsse"
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(value);
}

function formatQuantity(quantity: Quantity): string {
  return `${formatNumber(quantity.amount)} ${quantity.unit}`;
}

export type ProductionReadOnlyViewProps = {
  productionPlans: ProductionPlan[];
  purchaseLists: PurchaseList[];
};

/**
 * This view deliberately has no callbacks or links. Its input has already
 * crossed the server-side read projection, so it only presents stored kitchen
 * and purchasing facts and never derives permissions or commercial values.
 */
export function ProductionReadOnlyView({
  productionPlans,
  purchaseLists
}: ProductionReadOnlyViewProps) {
  return (
    <main aria-label="Produktionsunterlagen – nur lesen">
      <header>
        <p>Nur-Lese-Zugriff</p>
        <h2>Produktionsunterlagen</h2>
      </header>

      {productionPlans.length === 0 ? <p>Keine Produktionspläne vorhanden.</p> : null}
      {productionPlans.map((plan) => (
        <section key={plan.planId} aria-labelledby={`plan-${plan.planId}`}>
          <h3 id={`plan-${plan.planId}`}>Produktionsplan</h3>
          <p>Status: {plan.readiness.status}</p>
          {plan.kitchenSheets.map((sheet, index) => (
            <article key={`${plan.planId}-${sheet.componentId}-${index}`}>
              <h4>{sheet.title}</h4>
              <dl>
                <dt>Produktionsmenge</dt>
                <dd>{formatQuantity(sheet.productionQty)}</dd>
                <dt>Station</dt>
                <dd>{sheet.station}</dd>
                <dt>Vorbereitungsfenster</dt>
                <dd>{sheet.prepWindow}</dd>
              </dl>

              {sheet.instructions.length > 0 ? (
                <section>
                  <h5>Anweisungen</h5>
                  <ol>{sheet.instructions.map((instruction, instructionIndex) => (
                    <li key={`${sheet.componentId}-instruction-${instructionIndex}`}>{instruction}</li>
                  ))}</ol>
                </section>
              ) : null}

              {sheet.ingredients.length > 0 ? (
                <section>
                  <h5>Zutaten</h5>
                  <ul>{sheet.ingredients.map((ingredient) => (
                    <li key={ingredient.ingredientId}>
                      {ingredient.name}: {formatQuantity(ingredient.quantity)}
                    </li>
                  ))}</ul>
                </section>
              ) : null}

              {sheet.steps.length > 0 ? (
                <section>
                  <h5>Arbeitsschritte</h5>
                  <ol>{sheet.steps.map((step) => (
                    <li key={`${sheet.componentId}-step-${step.index}`}>
                      {step.instruction}{step.durationMinutes === undefined ? "" : ` (${formatNumber(step.durationMinutes)} Minuten)`}
                    </li>
                  ))}</ol>
                </section>
              ) : null}

              {(sheet.allergens?.length ?? 0) > 0 ? (
                <p>
                  Allergene: {sheet.allergens
                    ?.map((allergen) => ALLERGEN_LABELS[allergen] ?? allergen)
                    .join(", ")}
                </p>
              ) : null}
            </article>
          ))}
        </section>
      ))}

      <section aria-labelledby="read-only-purchase-lists">
        <h3 id="read-only-purchase-lists">Einkaufslisten</h3>
        {purchaseLists.length === 0 ? <p>Keine Einkaufslisten vorhanden.</p> : null}
        {purchaseLists.map((purchaseList) => (
          <article key={purchaseList.purchaseListId}>
            <h4>Einkaufsliste</h4>
            <ul>{purchaseList.items.map((item) => (
              <li key={item.ingredientId}>
                {item.displayName}: {formatNumber(item.purchaseQty)} {item.purchaseUnit}
                {` · ${item.group}`}
                {item.supplierHint ? ` · ${item.supplierHint}` : ""}
              </li>
            ))}</ul>
          </article>
        ))}
      </section>
    </main>
  );
}
