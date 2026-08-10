import {
  buildAppOfferRouteState,
  type AppOfferRouteState,
  type AppOfferRouteStateInput
} from "./app-offer-route-state.js";
import { buildOfferApprovalAction, type OfferApprovalActionInput } from "./offer-approval-action.js";
import {
  buildOfferTextSubmitAction,
  type OfferTextSubmitActionInput
} from "./offer-text-submit-action.js";

export type AppOfferRouteAppBoundaryInput =
  Omit<AppOfferRouteStateInput, "submitOfferText" | "approveDraft" | "createHandoff"> & {
    createOfferFromText: OfferTextSubmitActionInput["createOfferFromText"];
    decideOfferDraft: OfferApprovalActionInput["decideOfferDraft"];
    createProductionHandoff: OfferApprovalActionInput["createProductionHandoff"];
    createProductionDraftFromHandoff: OfferApprovalActionInput["createProductionDraftFromHandoff"];
    setSubmitting: OfferTextSubmitActionInput["setSubmitting"];
    clearMessages: OfferTextSubmitActionInput["clearMessages"];
    refreshDashboard: OfferTextSubmitActionInput["refreshDashboard"];
    setNotice: OfferTextSubmitActionInput["setNotice"];
    setError: OfferTextSubmitActionInput["setError"];
    setApprovalBinding?: OfferApprovalActionInput["setApprovalBinding"];
    openProductionEntry: OfferApprovalActionInput["openProductionEntry"];
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
  const approvalAction = buildOfferApprovalAction({
    decideOfferDraft: input.decideOfferDraft,
    createProductionHandoff: input.createProductionHandoff,
    createProductionDraftFromHandoff: input.createProductionDraftFromHandoff,
    setSubmitting: input.setSubmitting,
    clearMessages: input.clearMessages,
    refreshDashboard: input.refreshDashboard,
    setNotice: input.setNotice,
    setError: input.setError,
    setApprovalBinding: input.setApprovalBinding,
    openProductionEntry: input.openProductionEntry
  });

  return buildAppOfferRouteState({
    ...input,
    submitOfferText,
    approveDraft: approvalAction.approve,
    createHandoff: approvalAction.createHandoff
  });
}
