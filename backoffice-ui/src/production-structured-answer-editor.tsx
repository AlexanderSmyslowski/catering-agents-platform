import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentAnswerList } from "./production-component-answer-list.js";
import { ProductionEventAnswerFields } from "./production-event-answer-fields.js";

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
        <ProductionEventAnswerFields
          editingEventType={editingEventType}
          editingEventDate={editingEventDate}
          editingAttendeeCount={editingAttendeeCount}
          editingServiceForm={editingServiceForm}
          editingMenuItems={editingMenuItems}
          setEditingEventType={setEditingEventType}
          setEditingEventDate={setEditingEventDate}
          setEditingAttendeeCount={setEditingAttendeeCount}
          setEditingServiceForm={setEditingServiceForm}
          setEditingMenuItems={setEditingMenuItems}
        />
        <ProductionComponentAnswerList
          menuPlan={focusedProductionSpec.menuPlan}
          editingComponentStates={editingComponentStates}
          recipes={recipes}
          updateEditingComponentState={updateEditingComponentState}
        />
      </div>
    </article>
  );
}
