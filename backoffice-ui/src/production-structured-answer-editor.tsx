import { isExtractedSpecialDietQuestion } from "../../shared-core/src/special-diet-response.js";
import type { Uncertainty } from "@catering/shared-core";
import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentAnswerList } from "./production-component-answer-list.js";
import { ProductionEventAnswerFields } from "./production-event-answer-fields.js";

type ProductionStructuredAnswerEditorProps = {
  canEditPurchasedQuantities?: boolean;
  focusedProductionSpec: Record<string, unknown>;
  editingEventType: string;
  editingEventDate: string;
  editingEventSchedule?: string;
  editingSpecialDietResponse?: string;
  editingAttendeeCount: string;
  editingServiceForm: string;
  editingMenuItems: string;
  editingComponentStates: Record<string, ComponentEditState>;
  recipes: Array<Record<string, unknown>>;
  setEditingEventType: (value: string) => void;
  setEditingEventDate: (value: string) => void;
  setEditingEventSchedule?: (value: string) => void;
  setEditingSpecialDietResponse?: (value: string) => void;
  setEditingAttendeeCount: (value: string) => void;
  setEditingServiceForm: (value: string) => void;
  setEditingMenuItems: (value: string) => void;
  updateEditingComponentState: (componentId: string, patch: Partial<ComponentEditState>) => void;
};

export function ProductionStructuredAnswerEditor({
  canEditPurchasedQuantities = false,
  focusedProductionSpec,
  editingEventType,
  editingEventDate,
  editingEventSchedule,
  editingSpecialDietResponse,
  editingAttendeeCount,
  editingServiceForm,
  editingMenuItems,
  editingComponentStates,
  recipes,
  setEditingEventType,
  setEditingEventDate,
  setEditingEventSchedule,
  setEditingSpecialDietResponse,
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
          editingEventSchedule={editingEventSchedule ?? ""}
          editingAttendeeCount={editingAttendeeCount}
          editingServiceForm={editingServiceForm}
          editingMenuItems={editingMenuItems}
          setEditingEventType={setEditingEventType}
          setEditingEventDate={setEditingEventDate}
          setEditingEventSchedule={setEditingEventSchedule}
          setEditingAttendeeCount={setEditingAttendeeCount}
          setEditingServiceForm={setEditingServiceForm}
          setEditingMenuItems={setEditingMenuItems}
        />
        {setEditingSpecialDietResponse && Array.isArray(focusedProductionSpec.uncertainties) &&
          (focusedProductionSpec.uncertainties as Uncertainty[]).some(isExtractedSpecialDietQuestion) ? <section aria-label="Sonderkost klären">
          <h4>Sonderkost klären</h4>
          <p className="helper-text">Welche Maßnahmen und Freigaben gelten? Betroffene Gäste und Überschneidungen, Menüzuordnung, getrennte Zubereitung und offene Freigaben angeben. Die Antwort ist keine Allergen- oder Küchenfreigabe; sie wird mit der neuen Produktionsfassung geprüft.</p>
          <label>Sonderkost-Antwort<textarea className="operator-input" maxLength={500} value={editingSpecialDietResponse ?? ""} onChange={e => setEditingSpecialDietResponse(e.target.value)} /></label>
        </section> : null}
        <ProductionComponentAnswerList
          canEditPurchasedQuantities={canEditPurchasedQuantities}
          attendeeCount={Number(editingAttendeeCount)}
          menuPlan={focusedProductionSpec.menuPlan}
          editingComponentStates={editingComponentStates}
          recipes={recipes}
          updateEditingComponentState={updateEditingComponentState}
        />
      </div>
    </article>
  );
}
