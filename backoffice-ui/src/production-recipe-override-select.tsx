import { buildRecipeOptionsForComponent } from "./production-recipe-suggestions.js";

type ProductionRecipeOverrideSelectProps = {
  componentLabel: string;
  recipes: Array<Record<string, unknown>>;
  selectedRecipeId: string;
  onRecipeOverrideChange: (recipeId: string) => void;
};

export function ProductionRecipeOverrideSelect({
  componentLabel,
  recipes,
  selectedRecipeId,
  onRecipeOverrideChange
}: ProductionRecipeOverrideSelectProps) {
  const recipeOptions = buildRecipeOptionsForComponent({
    componentLabel,
    recipes,
    selectedRecipeId
  });

  return (
    <>
      <label className="field-block">
        <span>Rezept gezielt aus Bibliothek zuweisen</span>
        <select value={selectedRecipeId} onChange={(event) => onRecipeOverrideChange(event.target.value)}>
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
    </>
  );
}
