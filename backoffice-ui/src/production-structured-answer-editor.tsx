import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentAnswerCard } from "./production-component-answer-card.js";

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

                return (
                  <ProductionComponentAnswerCard
                    key={componentId}
                    componentId={componentId}
                    componentLabel={componentLabel}
                    recipes={recipes}
                    state={state}
                    updateEditingComponentState={updateEditingComponentState}
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}
