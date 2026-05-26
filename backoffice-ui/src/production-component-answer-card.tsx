import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentClassificationFields } from "./production-component-classification-fields.js";
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
      <label className="field-block">
        <span>Zugekaufte Bestandteile</span>
        <input
          value={state.purchasedElements}
          onChange={(event) =>
            updateEditingComponentState(componentId, {
              purchasedElements: event.target.value
            })
          }
          placeholder="z. B. Teig, Blätterteig, fertiger Boden, Saucenbasis"
        />
      </label>
      <label className="field-block">
        <span>Interne Notiz</span>
        <input
          value={state.notes}
          onChange={(event) =>
            updateEditingComponentState(componentId, {
              notes: event.target.value
            })
          }
          placeholder="optional"
        />
      </label>
    </article>
  );
}
