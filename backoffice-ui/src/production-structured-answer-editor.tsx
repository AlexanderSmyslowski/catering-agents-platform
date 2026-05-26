export type ComponentEditState = {
  menuCategory: string;
  productionMode: string;
  purchasedElements: string;
  recipeOverrideId: string;
  notes: string;
};

type ProductionStructuredAnswerEditorProps = {
  focusedProductionSpec: Record<string, unknown>;
  editingEventType: string;
  editingEventDate: string;
  editingAttendeeCount: string;
  editingServiceForm: string;
  editingMenuItems: string;
  editingComponentStates: Record<string, ComponentEditState>;
  recipes: Array<Record<string, unknown>>;
  setEditingEventType: (value: string) => void;
  setEditingEventDate: (value: string) => void;
  setEditingAttendeeCount: (value: string) => void;
  setEditingServiceForm: (value: string) => void;
  setEditingMenuItems: (value: string) => void;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
};

function normalizeRecipeSuggestionText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function recipeSuggestionsForComponent(
  label: string,
  recipes: Array<Record<string, unknown>>
): Array<{ recipeId: string; name: string }> {
  const tokens = normalizeRecipeSuggestionText(label)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 4)
    .filter((token) => !["vegan", "classic", "klassisch", "vegetarian", "vegetarisch", "topping"].includes(token));

  return recipes
    .map((recipe) => {
      const recipeId = String(recipe.recipeId ?? "");
      const name = String(recipe.name ?? recipeId);
      const haystack = normalizeRecipeSuggestionText(
        `${name} ${String((recipe.source as Record<string, unknown> | undefined)?.reference ?? "")}`
      );
      const score = tokens.filter((token) => haystack.includes(token)).length;
      return {
        recipeId,
        name,
        score
      };
    })
    .filter((item) => item.recipeId && item.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "de"))
    .slice(0, 6)
    .map(({ recipeId, name }) => ({ recipeId, name }));
}

function resolveRecipeNameById(recipeId: string, recipes: Array<Record<string, unknown>>): string | undefined {
  const match = recipes.find((recipe) => String(recipe.recipeId ?? "") === recipeId);
  if (!match) {
    return undefined;
  }

  const recipeName = String(match.name ?? "").trim();
  return recipeName || recipeId;
}

export function ProductionStructuredAnswerEditor({
  focusedProductionSpec,
  editingEventType,
  editingEventDate,
  editingAttendeeCount,
  editingServiceForm,
  editingMenuItems,
  editingComponentStates,
  recipes,
  setEditingEventType,
  setEditingEventDate,
  setEditingAttendeeCount,
  setEditingServiceForm,
  setEditingMenuItems,
  updateEditingComponentState
}: ProductionStructuredAnswerEditorProps) {
  return (
    <article className="structured-chat-message structured-chat-message--user">
      <div className="structured-chat-avatar structured-chat-avatar--user" aria-hidden="true">
        Du
      </div>
      <div className="structured-chat-bubble structured-chat-bubble--user">
        <header className="structured-answer-anchor">
          <p className="eyebrow">Deine strukturierte Antwort im Chatfluss</p>
          <h4 className="subsection-title">Antwort direkt zur Agentenfrage</h4>
          <p className="helper-text">
            Diese Felder beantworten die Rückfragen strukturiert im bestehenden Spezifikationspfad; kein freier LLM-Chat.
          </p>
        </header>
        <div className="answer-grid">
          <label className="field-block">
            <span>Veranstaltungstyp</span>
            <select value={editingEventType} onChange={(event) => setEditingEventType(event.target.value)}>
              <option value="">Bitte wählen</option>
              <option value="meeting">Besprechung</option>
              <option value="conference">Konferenz</option>
              <option value="lunch">Lunch</option>
              <option value="reception">Empfang</option>
              <option value="dinner">Abendessen</option>
              <option value="trade_fair">Messe</option>
            </select>
          </label>
          <label className="field-block">
            <span>Datum</span>
            <input
              value={editingEventDate}
              onChange={(event) => setEditingEventDate(event.target.value)}
              placeholder="2026-06-18"
            />
          </label>
          <label className="field-block">
            <span>Teilnehmerzahl</span>
            <input
              value={editingAttendeeCount}
              onChange={(event) => setEditingAttendeeCount(event.target.value)}
              inputMode="numeric"
              placeholder="120"
            />
          </label>
          <label className="field-block">
            <span>Serviceform</span>
            <select value={editingServiceForm} onChange={(event) => setEditingServiceForm(event.target.value)}>
              <option value="">Bitte wählen</option>
              <option value="buffet">Buffet</option>
              <option value="plated">Menü am Platz</option>
              <option value="standing_reception">Empfang / Flying</option>
              <option value="grab_and_go">Ausgabe / Grab-and-go</option>
              <option value="coffee_break">Kaffeepause</option>
            </select>
          </label>
        </div>
        <label className="field-block">
          <span>Gerichte und Komponenten</span>
          <textarea
            value={editingMenuItems}
            onChange={(event) => setEditingMenuItems(event.target.value)}
            placeholder="Kalbsbuletten, Kartoffelsalat, Nudelsalat, Mandel-Curry, Schokoladenkuchen"
          />
        </label>
        <p className="helper-text">
          Mehrere Gerichte bitte durch Komma trennen. Diese Angaben aktualisieren direkt die operative Spezifikation.
        </p>
        {Array.isArray(focusedProductionSpec.menuPlan) && focusedProductionSpec.menuPlan.length > 0 ? (
          <>
            <div className="divider" />
            <header>
              <p className="eyebrow">Gericht für Gericht</p>
              <h4 className="subsection-title">Klassifikation und Herstellungsart festlegen</h4>
            </header>
            <div className="component-answer-list">
              {focusedProductionSpec.menuPlan.map((entry) => {
                const component = entry as Record<string, unknown>;
                const componentId = String(component.componentId ?? "");
                const state = editingComponentStates[componentId] ?? {
                  menuCategory: "",
                  productionMode: "",
                  purchasedElements: "",
                  recipeOverrideId: "",
                  notes: ""
                };
                const componentLabel = String(component.label ?? componentId);
                const recipeSuggestions = recipeSuggestionsForComponent(componentLabel, recipes);
                const selectedRecipeName = state.recipeOverrideId
                  ? resolveRecipeNameById(state.recipeOverrideId, recipes)
                  : undefined;
                const recipeOptions = [...recipeSuggestions];
                if (state.recipeOverrideId && !recipeOptions.some((item) => item.recipeId === state.recipeOverrideId)) {
                  recipeOptions.unshift({
                    recipeId: state.recipeOverrideId,
                    name: selectedRecipeName ?? `Rezept ${state.recipeOverrideId}`
                  });
                }

                return (
                  <article key={componentId} className="component-answer-card">
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
                      <p className="helper-text">
                        Für diese Bezeichnung wurden noch keine naheliegenden Bibliotheksrezepte gefunden.
                      </p>
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
              })}
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}
