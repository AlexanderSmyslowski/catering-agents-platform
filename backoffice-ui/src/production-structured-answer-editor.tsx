import { isExtractedSpecialDietQuestion } from "../../shared-core/src/special-diet-response.js";
import type { ReactNode } from "react";
import type { Uncertainty } from "@catering/shared-core";
import type { ComponentEditState } from "./production-answer-types.js";
import { ProductionComponentAnswerList } from "./production-component-answer-list.js";
import { ProductionEventAnswerFields } from "./production-event-answer-fields.js";

type ProductionStructuredAnswerEditorProps = {
  footer?: ReactNode;
  canEditPurchasedQuantities?: boolean;
  canSplitComponents?: boolean;
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
  footer,
  canEditPurchasedQuantities = false,
  canSplitComponents = false,
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
  // Open the sections the open questions concern; the others stay available
  // but folded. Without a recognisable field everything stays open.
  const openFields = [
    ...(Array.isArray(focusedProductionSpec.uncertainties) ? (focusedProductionSpec.uncertainties as Array<{ field?: unknown }>).map(item => String(item?.field ?? "")) : []),
    ...(Array.isArray(focusedProductionSpec.missingFields) ? (focusedProductionSpec.missingFields as unknown[]).map(String) : [])
  ].filter(Boolean);
  const isEventField = (field: string) => /^(?:event|attendees|servicePlan|venue)(?:\.|$)/.test(field);
  const eventSectionOpen = openFields.length === 0 || openFields.some(isEventField);
  const componentSectionOpen = openFields.length === 0 || openFields.some(field => !isEventField(field));
  const componentCount = Array.isArray(focusedProductionSpec.menuPlan) ? focusedProductionSpec.menuPlan.length : 0;
  return (
    <article id="production-answer-editor" tabIndex={-1} className="structured-chat-message structured-chat-message--user">
      <div className="structured-chat-avatar structured-chat-avatar--user" aria-hidden="true">
        Du
      </div>
      <div className="structured-chat-bubble structured-chat-bubble--user">
        <header className="structured-answer-anchor">
          <h4 className="subsection-title">Antworten zu den Rückfragen</h4>
          <p className="helper-text">
            Trage die fehlenden Angaben in die passenden Felder ein. Gespeichert wird erst mit „Antworten speichern“ am Ende des Formulars.
          </p>
        </header>
        <details className="answer-section" open={eventSectionOpen}>
        <summary>Veranstaltungsdaten{eventSectionOpen ? "" : " – keine offene Rückfrage"}</summary>
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
        </details>
        {setEditingSpecialDietResponse && Array.isArray(focusedProductionSpec.uncertainties) &&
          (focusedProductionSpec.uncertainties as Uncertainty[]).some(isExtractedSpecialDietQuestion) ? <section aria-label="Sonderkost klären">
          <h4>Sonderkost klären</h4>
          <p className="helper-text">Welche Maßnahmen und Freigaben gelten? Betroffene Gäste und Überschneidungen, Menüzuordnung, getrennte Zubereitung und offene Freigaben angeben. Die Antwort ist keine Allergen- oder Küchenfreigabe; sie wird mit der neuen Produktionsfassung geprüft.</p>
          <label>Sonderkost-Antwort<textarea className="operator-input" maxLength={500} value={editingSpecialDietResponse ?? ""} onChange={e => setEditingSpecialDietResponse(e.target.value)} /></label>
        </section> : null}
        <details className="answer-section" open={componentSectionOpen}>
        <summary>{componentCount === 1 ? "1 Komponente" : `${componentCount} Komponenten`}: Herstellung, Rezept und Mengen{componentSectionOpen ? "" : " – keine offene Rückfrage"}</summary>
        <ProductionComponentAnswerList
          canEditPurchasedQuantities={canEditPurchasedQuantities}
          canSplitComponents={canSplitComponents}
          attendeeCount={Number(editingAttendeeCount)}
          menuPlan={focusedProductionSpec.menuPlan}
          editingComponentStates={editingComponentStates}
          recipes={recipes}
          updateEditingComponentState={updateEditingComponentState}
        />
        </details>
        {footer}
      </div>
    </article>
  );
}
