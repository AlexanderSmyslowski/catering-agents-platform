import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentClassificationFields } from "./production-component-classification-fields.js";
import { ProductionComponentDetailFields } from "./production-component-detail-fields.js";
import { ProductionRecipeOverrideSelect } from "./production-recipe-override-select.js";

type ProductionComponentAnswerCardProps = {
  canEditPurchasedQuantities?: boolean;
  attendeeCount?: number;
  componentId: string;
  componentLabel: string;
  canSplit?: boolean;
  sourceServings?: number;
  productionSource?: { parentLabel: string; parentServings: number; reason: string };
  recipes: Array<Record<string, unknown>>;
  state: ComponentEditState;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
};

export function ProductionComponentAnswerCard({
  canEditPurchasedQuantities = false,
  attendeeCount,
  componentId,
  componentLabel,
  canSplit = false,
  sourceServings,
  productionSource,
  recipes,
  state,
  updateEditingComponentState
}: ProductionComponentAnswerCardProps) {
  return (
    <article className="component-answer-card">
      <strong>{componentLabel}</strong>
      {productionSource ? <p>Herkunft: {productionSource.parentLabel} · {productionSource.parentServings} Ausgabeportionen<br />Produktion: {sourceServings} Portionen · Begründung: {productionSource.reason}</p> : null}
      {canSplit && sourceServings && sourceServings > 0 ? <section>
        <p>Aus Angebotsposition: {sourceServings} Ausgabeportionen</p>
        {!state.split ? <button type="button" className="secondary-button" onClick={() => updateEditingComponentState(componentId, { split: { reason: "", children: [{ label: "", servings: "", recipeId: "" }, { label: "", servings: "", recipeId: "" }] } })}>In Produktionskomponenten aufteilen</button> : <fieldset>
          <legend>Produktionskomponenten</legend>
          <p className="helper-text">Die Aufteilung ersetzt die bisherige Produktionszuordnung dieser Position. Die Ausgabeportionen bleiben unverändert. Für jede Komponente Produktionsportionen und Rezept festlegen und anschließend neu prüfen. Andere Änderungen bitte separat speichern. Nach dem Speichern lassen sich Bezeichnung und Produktionsportionen in dieser Entwurfslinie nicht mehr ändern; bitte vorher prüfen.</p>
          <label className="field-block"><span>Begründung</span><input value={state.split.reason} onChange={event => updateEditingComponentState(componentId, { split: { ...state.split!, reason: event.target.value } })} /></label>
          {state.split.children.map((child, index) => <div key={index}>
            <strong>Komponente {index + 1}</strong>
            <label className="field-block"><span>Bezeichnung</span><input value={child.label} onChange={event => updateEditingComponentState(componentId, { split: { ...state.split!, children: state.split!.children.map((item, i) => i === index ? { ...item, label: event.target.value } : item) } })} /></label>
            <label className="field-block"><span>Produktionsportionen</span><input type="number" min="1" step="1" value={child.servings} onChange={event => updateEditingComponentState(componentId, { split: { ...state.split!, children: state.split!.children.map((item, i) => i === index ? { ...item, servings: event.target.value } : item) } })} /></label>
            <label className="field-block"><span>Rezept</span><select value={child.recipeId} onChange={event => updateEditingComponentState(componentId, { split: { ...state.split!, children: state.split!.children.map((item, i) => i === index ? { ...item, recipeId: event.target.value } : item) } })}><option value="">Rezept auswählen</option>{recipes.map(recipe => <option key={String(recipe.recipeId)} value={String(recipe.recipeId)}>{String(recipe.name ?? recipe.label ?? recipe.recipeId)}</option>)}</select></label>
            {state.split!.children.length > 2 ? <button type="button" className="secondary-button" onClick={() => updateEditingComponentState(componentId, { split: { ...state.split!, children: state.split!.children.filter((_, i) => i !== index) } })}>Komponente entfernen</button> : null}
          </div>)}
          {state.split.children.length < 10 ? <button type="button" className="secondary-button" onClick={() => updateEditingComponentState(componentId, { split: { ...state.split!, children: [...state.split!.children, { label: "", servings: "", recipeId: "" }] } })}>Komponente hinzufügen</button> : null}
          <button type="button" className="secondary-button" onClick={() => updateEditingComponentState(componentId, { split: undefined })}>Aufteilung verwerfen</button>
        </fieldset>}
      </section> : null}
      {!state.split ? <>
      <ProductionComponentClassificationFields
        isSplitComponent={Boolean(productionSource)}
        menuCategory={state.menuCategory}
        productionMode={state.productionMode}
        productionStation={state.productionStation}
        onProductionStationChange={productionStation => updateEditingComponentState(componentId, { productionStation })}
        onMenuCategoryChange={(menuCategory) =>
          updateEditingComponentState(componentId, {
            menuCategory
          })
        }
        onProductionModeChange={(productionMode) =>
          updateEditingComponentState(componentId, {
            productionMode
          })
        }
      />
      <ProductionRecipeOverrideSelect
        componentLabel={componentLabel}
        recipes={recipes}
        selectedRecipeId={state.recipeOverrideId}
        onRecipeOverrideChange={(recipeOverrideId) =>
          updateEditingComponentState(componentId, {
            recipeOverrideId
          })
        }
      />
      <ProductionComponentDetailFields
        canEditPurchasedQuantities={canEditPurchasedQuantities}
        purchasedElements={state.purchasedElements}
        purchasedElementNames={state.originalPurchasedElements?.join(", ") === state.purchasedElements ? state.originalPurchasedElements : undefined}
        purchasedQuantities={state.purchasedQuantities}
        attendeeCount={attendeeCount}
        onPurchasedQuantitiesChange={(purchasedQuantities) => updateEditingComponentState(componentId, { purchasedQuantities })}
        notes={state.notes}
        onPurchasedElementsChange={(purchasedElements) =>
          updateEditingComponentState(componentId, {
            purchasedElements,
            ...(state.purchasedQuantities !== undefined ? { purchasedQuantities: purchasedElements.split(",").map(element => element.trim()).filter(Boolean).map(element =>
              state.purchasedQuantities!.find(quantity => quantity.element === element) ?? { element, amountPerPerson: "", unit: "" }
            ) } : {})
          })
        }
        onNotesChange={(notes) =>
          updateEditingComponentState(componentId, {
            notes
          })
        }
      />
      </> : null}
    </article>
  );
}
