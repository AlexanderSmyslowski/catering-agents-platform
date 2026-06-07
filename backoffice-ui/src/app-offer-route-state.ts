import {
  buildOfferSpecEditActions,
  buildOfferSpecEditState,
  type OfferSpecEditActions,
  type OfferSpecEditActionsInput,
  type OfferSpecEditState,
  type OfferSpecEditStateInput
} from "./offer-spec-edit-state.js";
import {
  buildOfferWorkbenchState,
  type OfferWorkbenchStateInput
} from "./offer-workbench-state.js";
import type { OfferWorkbenchProps } from "./offer-workbench.js";

export type AppOfferRouteStateInput =
  Omit<OfferWorkbenchStateInput, "specEdit" | "specEditActions"> &
  OfferSpecEditStateInput &
  OfferSpecEditActionsInput;

export type AppOfferRouteState = {
  offerSpecEdit: OfferSpecEditState;
  offerSpecEditActions: OfferSpecEditActions;
  offerWorkbenchState: OfferWorkbenchProps;
};

export function buildAppOfferRouteState(input: AppOfferRouteStateInput): AppOfferRouteState {
  const offerSpecEdit = buildOfferSpecEditState({
    editingSpecId: input.editingSpecId,
    eventType: input.eventType,
    eventDate: input.eventDate,
    attendeeCount: input.attendeeCount,
    serviceForm: input.serviceForm,
    menuItems: input.menuItems
  });
  const offerSpecEditActions = buildOfferSpecEditActions({
    beginSpecEdit: input.beginSpecEdit,
    setEventType: input.setEventType,
    setEventDate: input.setEventDate,
    setAttendeeCount: input.setAttendeeCount,
    setServiceForm: input.setServiceForm,
    setMenuItems: input.setMenuItems,
    saveSpecEdit: input.saveSpecEdit,
    resetSpecEdit: input.resetSpecEdit
  });

  return {
    offerSpecEdit,
    offerSpecEditActions,
    offerWorkbenchState: buildOfferWorkbenchState({
      submitting: input.submitting,
      latestSourceLabel: input.latestSourceLabel,
      offerText: input.offerText,
      setOfferText: input.setOfferText,
      submitOfferText: input.submitOfferText,
      intakeText: input.intakeText,
      setIntakeText: input.setIntakeText,
      submitIntakeText: input.submitIntakeText,
      intakeChannel: input.intakeChannel,
      setIntakeChannel: input.setIntakeChannel,
      intakeFile: input.intakeFile,
      setIntakeFile: input.setIntakeFile,
      submitIntakeDocument: input.submitIntakeDocument,
      manualInput: input.manualInput,
      manualActions: input.manualActions,
      filteredOfferDrafts: input.filteredOfferDrafts,
      activeDraft: input.activeDraft,
      selectedDraft: input.selectedDraft,
      setSelectedDraftId: input.setSelectedDraftId,
      promoteDraft: input.promoteDraft,
      filteredSpecs: input.filteredSpecs,
      activeSpec: input.activeSpec,
      completeSpecCount: input.completeSpecCount,
      partialSpecCount: input.partialSpecCount,
      miniPilotRawResult: input.miniPilotRawResult,
      setMiniPilotRawResult: input.setMiniPilotRawResult,
      miniPilotReportState: input.miniPilotReportState,
      specEdit: offerSpecEdit,
      specEditActions: offerSpecEditActions
    })
  };
}
