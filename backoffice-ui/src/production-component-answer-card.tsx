import type { ComponentEditState } from "./production-answer-types.js";
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
      <div className="answer-grid">
        <label className="field-block">
          <span>Kategorie im Angebot</span>
          <select
            value={state.menuCategory}
            onChange={(event) =>
              updateEditingComponentState(componentId, {
                menuCategory: event.target.value
              })
            }
          >
            <option value="">Bitte wählen</option>
            <option value="classic">klassisch</option>
            <option value="vegetarian">vegetarisch</option>
            <option value="vegan">vegan</option>
          </select>
        </label>
        <label className="field-block">
          <span>Herstellungsart</span>
          <select
            value={state.productionMode}
            onChange={(event) =>
              updateEditingComponentState(componentId, {
                productionMode: event.target.value
              })
            }
          >
            <option value="">Bitte wählen</option>
            <option value="scratch">Eigenproduktion</option>
            <option value="hybrid">Hybrid</option>
            <option value="convenience_purchase">Convenience-Zukauf</option>
            <option value="external_finished">Fertigprodukt / extern</option>
          </select>
        </label>
      </div>
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
