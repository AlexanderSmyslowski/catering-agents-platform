import type { ComponentEditState } from "./production-answer-types.js";
import { buildRecipeOptionsForComponent } from "./production-recipe-suggestions.js";

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
  const recipeOptions = buildRecipeOptionsForComponent({
    componentLabel,
    recipes,
    selectedRecipeId: state.recipeOverrideId
  });

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
      <label className="field-block">
        <span>Rezept gezielt aus Bibliothek zuweisen</span>
        <select
          value={state.recipeOverrideId}
          onChange={(event) =>
            updateEditingComponentState(componentId, {
              recipeOverrideId: event.target.value
            })
          }
        >
          <option value="">Automatisch suchen</option>
          {recipeOptions.map((option) => (
            <option key={option.recipeId} value={option.recipeId}>
              {option.name} ({option.recipeId})
            </option>
          ))}
        </select>
      </label>
      {recipeOptions.length > 0 ? (
        <p className="helper-text">
          Vorgeschlagene Bibliotheksrezepte: {recipeOptions.map((option) => option.name).join(", ")}
        </p>
      ) : (
        <p className="helper-text">Für diese Bezeichnung wurden noch keine naheliegenden Bibliotheksrezepte gefunden.</p>
      )}
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
