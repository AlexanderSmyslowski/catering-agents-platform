import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentClassificationFields } from "./production-component-classification-fields.js";
import { ProductionComponentDetailFields } from "./production-component-detail-fields.js";
import { ProductionRecipeOverrideSelect } from "./production-recipe-override-select.js";

type ProductionComponentAnswerCardProps = {
  componentId: string;
  componentLabel: string;
  recipes: Array<Record<string, unknown>>;
  state: ComponentEditState;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
};

export function ProductionComponentAnswerCard({
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
        notes={state.notes}
        onPurchasedElementsChange={(purchasedElements) =>
          updateEditingComponentState(componentId, {
            purchasedElements
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
