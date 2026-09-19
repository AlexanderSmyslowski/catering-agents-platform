import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentClassificationFields } from "./production-component-classification-fields.js";
import { ProductionComponentDetailFields } from "./production-component-detail-fields.js";
import { ProductionRecipeOverrideSelect } from "./production-recipe-override-select.js";

type ProductionComponentAnswerCardProps = {
  attendeeCount?: number;
  componentId: string;
  componentLabel: string;
  recipes: Array<Record<string, unknown>>;
  state: ComponentEditState;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
};

export function ProductionComponentAnswerCard({
  attendeeCount,
  componentId,
  componentLabel,
  recipes,
  state,
  updateEditingComponentState
}: ProductionComponentAnswerCardProps) {
  return (
    <article className="component-answer-card">
      <strong>{componentLabel}</strong>
      <ProductionComponentClassificationFields
        menuCategory={state.menuCategory}
        productionMode={state.productionMode}
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
    </article>
  );
}
