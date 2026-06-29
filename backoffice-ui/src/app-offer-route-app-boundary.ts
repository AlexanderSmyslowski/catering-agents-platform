import {
  buildAppOfferRouteState,
  type AppOfferRouteState,
  type AppOfferRouteStateInput
} from "./app-offer-route-state.js";
import {
  buildOfferDraftPromoteAction,
  type OfferDraftPromoteActionInput
} from "./offer-draft-promote-action.js";
import {
  buildOfferTextSubmitAction,
  type OfferTextSubmitActionInput
} from "./offer-text-submit-action.js";

export type AppOfferRouteAppBoundaryInput =
  Omit<AppOfferRouteStateInput, "submitOfferText" | "promoteDraft"> & {
    createOfferFromText: OfferTextSubmitActionInput["createOfferFromText"];
    promoteOfferDraft: OfferDraftPromoteActionInput["promoteOfferDraft"];
    setSubmitting: OfferTextSubmitActionInput["setSubmitting"];
    clearMessages: OfferTextSubmitActionInput["clearMessages"];
    setFocusedProductionSpecId?: OfferDraftPromoteActionInput["setFocusedProductionSpecId"];
    refreshDashboard: OfferTextSubmitActionInput["refreshDashboard"];
    setNotice: OfferTextSubmitActionInput["setNotice"];
    setError: OfferTextSubmitActionInput["setError"];
  };

export function buildAppOfferRouteAppBoundary(
  input: AppOfferRouteAppBoundaryInput
): AppOfferRouteState {
  const submitOfferText = buildOfferTextSubmitAction({
    createOfferFromText: input.createOfferFromText,
    offerText: input.offerText,
    setSubmitting: input.setSubmitting,
    clearMessages: input.clearMessages,
    setSelectedDraftId: input.setSelectedDraftId,
    refreshDashboard: input.refreshDashboard,
    setNotice: input.setNotice,
    setError: input.setError
  });
  const promoteDraft = buildOfferDraftPromoteAction({
    promoteOfferDraft: input.promoteOfferDraft,
    setSubmitting: input.setSubmitting,
    clearMessages: input.clearMessages,
    setFocusedProductionSpecId: input.setFocusedProductionSpecId,
    refreshDashboard: input.refreshDashboard,
    setNotice: input.setNotice,
    setError: input.setError
  });

  return buildAppOfferRouteState({
    ...input,
    submitOfferText,
    promoteDraft
  });
}
