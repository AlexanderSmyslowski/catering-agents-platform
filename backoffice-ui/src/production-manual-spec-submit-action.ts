import { formatEventTypeLabel } from "../../shared-core/src/taxonomies/labels.js";
import { productionDraftEntryUrl } from "./production-entry-focus.js";
import { extractAcceptedSpecId } from "./production-api-response-ids.js";
import { formatSubmitErrorMessage } from "./submit-error-message.js";

function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export type ProductionManualSpecSubmitInput = {
  createAcceptedSpecFromManualForm: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  createProductionCase: (input?: { customerName?: string; eventTypeLabel?: string; eventDate?: string; attendeeCount?: number }) => Promise<{ case: { caseId: string } }>;
  createProductionDraftFromAcceptedEventSpec: (
    caseId: string,
    spec: Record<string, unknown>
  ) => Promise<{ draft: { draftId: string } }>;
  buildCurrentManualSpecInput: () => Record<string, unknown>;
  setSubmitting: (submitting: boolean) => void;
  setProductionWorkspaceCleared: (cleared: boolean) => void;
  clearMessages: () => void;
  setFocusedProductionSpecId: (specId: string) => void;
  setActiveProductionCaseId: (caseId: string) => void;
  setActiveProductionCaseSpecId: (specId: string) => void;
  resetManualSpecDraft: () => void;
  refreshDashboard: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function buildProductionManualSpecSubmitAction({
  createAcceptedSpecFromManualForm,
  createProductionCase,
  createProductionDraftFromAcceptedEventSpec,
  buildCurrentManualSpecInput,
  setSubmitting,
  setProductionWorkspaceCleared,
  clearMessages,
  setFocusedProductionSpecId,
  setActiveProductionCaseId,
  setActiveProductionCaseSpecId,
  resetManualSpecDraft,
  setNotice,
  setError
}: ProductionManualSpecSubmitInput) {
  return async function handleManualSpecSubmit() {
    setSubmitting(true);
    setProductionWorkspaceCleared(false);
    clearMessages();
    try {
      const response = await createAcceptedSpecFromManualForm(buildCurrentManualSpecInput());
      const specId = extractAcceptedSpecId(response);
      if (!specId?.trim()) throw new Error("Manuelle Spezifikation enthält keine gültige ID.");
      const spec = response.acceptedEventSpec as Record<string, unknown>;
      const customer = spec.customer as Record<string, unknown> | undefined;
      const event = spec.event as Record<string, unknown> | undefined;
      const servicePlan = spec.servicePlan as Record<string, unknown> | undefined;
      const attendees = spec.attendees as Record<string, unknown> | undefined;
      const customerName = typeof customer?.name === "string" ? customer.name.trim() : "";
      const eventType = typeof servicePlan?.eventType === "string" ? servicePlan.eventType : typeof event?.type === "string" ? event.type : "";
      const eventDate = typeof event?.date === "string" ? event.date : "";
      const attendeeCount = attendees?.expected;
      const productionCase = await createProductionCase({
        ...(customerName ? { customerName } : {}),
        ...(eventType ? { eventTypeLabel: formatEventTypeLabel(eventType) } : {}),
        ...(validCalendarDate(eventDate) ? { eventDate } : {}),
        ...(typeof attendeeCount === "number" && Number.isSafeInteger(attendeeCount) && attendeeCount > 0 ? { attendeeCount } : {})
      });
      const caseId = productionCase.case?.caseId;
      if (typeof caseId !== "string" || !caseId.trim()) throw new Error("Produktionsauftrag enthält keine gültige ID.");
      const result = await createProductionDraftFromAcceptedEventSpec(caseId, { specId });
      const draftId = result.draft?.draftId;
      if (typeof draftId !== "string" || !draftId.trim()) throw new Error("Produktionsentwurf enthält keine gültige ID.");
      if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", productionDraftEntryUrl(draftId, caseId));
      setActiveProductionCaseId(caseId);
      setActiveProductionCaseSpecId(specId);
      setFocusedProductionSpecId(specId);
      resetManualSpecDraft();
      setNotice("Auftrag angelegt. Bitte Angaben und Planung prüfen.");
    } catch (submitError) {
      setError(formatSubmitErrorMessage(submitError, "Manuelle Spezifikation konnte nicht erstellt werden."));
    } finally {
      setSubmitting(false);
    }
  };
}
