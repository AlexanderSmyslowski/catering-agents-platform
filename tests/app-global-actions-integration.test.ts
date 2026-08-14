// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppOfferRouteAppBoundary } from "../backoffice-ui/src/app-offer-route-app-boundary.js";
import { OfferConversationalWorkbench } from "../backoffice-ui/src/offer-workbench.js";
import {
  buildOfferApprovalBinding,
  type OfferApprovalBinding
} from "../backoffice-ui/src/offer-approval-action.js";
import {
  productionDraftNextState,
  runProductWorkspaceNextAction
} from "../backoffice-ui/src/App.js";
import type { ApprovedOffer, ProductionHandoff } from "@catering/shared-core";
import type { ProductionDraft } from "../backoffice-ui/src/api.js";

afterEach(() => {
  document.body.innerHTML = "";
});

function boundaryInput(overrides: Record<string, unknown> = {}) {
  return {
    createOfferCase: vi.fn(async () => ({ case: { caseId: "offer-case" } })),
    createOfferFromText: vi.fn(async () => ({ draftId: "offer-draft" })),
    getOrCreateOfferRequestId: vi.fn(() => "request-1"),
    completeOfferRequestId: vi.fn(),
    activeOfferCaseId: "offer-case",
    setActiveOfferCaseId: vi.fn(),
    decideOfferDraft: vi.fn(async () => ({ approvedOffer: { approvedOfferId: "approved-1" } })),
    createProductionHandoff: vi.fn(async () => ({ handoff: { handoffId: "handoff-1" } })),
    createProductionCaseFromHandoff: vi.fn(async () => ({ case: { caseId: "production-case" } })),
    createProductionDraftFromHandoff: vi.fn(async () => ({ draft: { draftId: "production-draft" } })),
    setActiveProductionCaseId: vi.fn(),
    clearActiveOfferCaseId: vi.fn(),
    openProductionEntry: vi.fn(),
    submitting: false,
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    latestSourceLabel: "request-1",
    offerText: "Anfrage",
    setOfferText: vi.fn(),
    intakeText: "",
    setIntakeText: vi.fn(),
    submitIntakeText: vi.fn(async () => undefined),
    intakeChannel: "pdf_upload" as const,
    setIntakeChannel: vi.fn(),
    intakeFile: null,
    setIntakeFile: vi.fn(),
    submitIntakeDocument: vi.fn(async () => undefined),
    manualInput: {
      eventType: "lunch",
      eventDate: "2026-08-20",
      attendeeCount: "20",
      serviceForm: "buffet",
      menuItems: "Salat",
      customerName: "Kunde",
      venueName: "Ort",
      notes: ""
    },
    manualActions: {
      setEventType: vi.fn(),
      setEventDate: vi.fn(),
      setAttendeeCount: vi.fn(),
      setServiceForm: vi.fn(),
      setMenuItems: vi.fn(),
      setCustomerName: vi.fn(),
      setVenueName: vi.fn(),
      setNotes: vi.fn(),
      submitManualSpec: vi.fn(async () => undefined)
    },
    filteredOfferDrafts: [],
    activeDraft: undefined,
    selectedDraft: undefined,
    setSelectedDraftId: vi.fn(),
    approveDraft: vi.fn(async () => undefined),
    approvalBinding: undefined,
    filteredSpecs: [],
    activeSpec: undefined,
    completeSpecCount: 0,
    partialSpecCount: 0,
    miniPilotRawResult: "",
    setMiniPilotRawResult: vi.fn(),
    miniPilotReportState: {
      statusLabel: "noch kein Ergebnis",
      reasonLabel: "",
      nextStepLabel: "",
      commandLabel: "",
      errorLabels: []
    },
    editingSpecId: undefined,
    eventType: "",
    eventDate: "",
    attendeeCount: "",
    serviceForm: "",
    menuItems: "",
    beginSpecEdit: vi.fn(),
    setEventType: vi.fn(),
    setEventDate: vi.fn(),
    setAttendeeCount: vi.fn(),
    setServiceForm: vi.fn(),
    setMenuItems: vi.fn(),
    saveSpecEdit: vi.fn(async () => undefined),
    resetSpecEdit: vi.fn(),
    ...overrides
  };
}

function persistedApproval(): { approvedOffer: ApprovedOffer; handoff: ProductionHandoff } {
  const approvedOffer = {
    approvedOfferId: "approved-1",
    sourceDraft: { draftId: "offer-draft-1", revision: 4 },
    selectedVariantId: "variant-1"
  } as ApprovedOffer;
  const handoff = {
    handoffId: "handoff-1",
    approvedOfferId: approvedOffer.approvedOfferId,
    source: { draftId: "offer-draft-1", revision: 4, selectedVariantId: "variant-1" }
  } as ProductionHandoff;
  return { approvedOffer, handoff };
}

describe("global action integration contracts", () => {
  it("renders and records the selected offer variant through the app adapter", async () => {
    const setSelectedVariantId = vi.fn();
    const decideOfferDraft = vi.fn(async () => ({ approvedOffer: { approvedOfferId: "approved-1" } }));
    const boundary = buildAppOfferRouteAppBoundary(boundaryInput({
      activeDraft: {
        draftId: "offer-draft-1",
        revision: 2,
        eventSummary: "Business Lunch",
        variantSet: [{ variantId: "variant-1", label: "Ausgewogen" }],
        openQuestions: [],
        proposedEventSpec: {},
        reviewStatus: {
          priceReviewStatus: "review_required",
          taxReviewStatus: "review_required",
          allergenReviewStatus: "review_required",
          hygieneTemperatureReviewStatus: "review_required",
          sourceSecured: true,
          publishApproved: false
        }
      },
      setSelectedVariantId,
      decideOfferDraft
    }) as never);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(createElement(OfferConversationalWorkbench, boundary.offerWorkbenchState)));
    const variantButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Variante freigeben")
    ) as HTMLButtonElement | undefined;
    expect(variantButton).toBeDefined();
    await act(async () => variantButton?.click());
    expect(setSelectedVariantId).toHaveBeenCalledWith("variant-1");
    expect(decideOfferDraft).toHaveBeenCalledWith("offer-draft-1", 2, "variant-1");
    await act(async () => root.unmount());
  });

  it("keeps a selected offer variant in the real offer route adapter", () => {
    const state = buildAppOfferRouteAppBoundary(boundaryInput({ selectedVariantId: "variant-1" }) as never);
    expect(state.offerWorkbenchState.selectedVariantId).toBe("variant-1");
  });

  it("opens a persisted handoff through the real next-action runner after reload", async () => {
    const { approvedOffer, handoff } = persistedApproval();
    const binding: OfferApprovalBinding = buildOfferApprovalBinding(approvedOffer, handoff)!;
    const boundary = buildAppOfferRouteAppBoundary(boundaryInput({ approvalBinding: binding }) as never);
    const openProductionEntry = vi.fn();

    await runProductWorkspaceNextAction({
      route: "offer",
      action: { kind: "inspect_handoff", label: "Übergabe öffnen", handoffId: handoff.handoffId },
      offerWorkbenchState: boundary.offerWorkbenchState,
      offerApprovalBinding: binding,
      openProductionEntry,
      setNotice: vi.fn(),
      focus: vi.fn()
    });

    expect(openProductionEntry).toHaveBeenCalledWith(`production-draft-handoff-${handoff.handoffId}`);
  });

  it("creates a handoff from the persisted approval without browser-only binding state", async () => {
    const { approvedOffer } = persistedApproval();
    const binding = buildOfferApprovalBinding(approvedOffer)!;
    const createHandoff = vi.fn(async () => undefined);
    const boundary = buildAppOfferRouteAppBoundary(boundaryInput({ approvalBinding: binding }) as never);

    await runProductWorkspaceNextAction({
      route: "offer",
      action: { kind: "send_handoff", label: "An Produktion übergeben", approvedOfferId: approvedOffer.approvedOfferId },
      offerWorkbenchState: { ...boundary.offerWorkbenchState, createHandoff },
      offerApprovalBinding: binding,
      setNotice: vi.fn(),
      focus: vi.fn()
    });

    expect(createHandoff).toHaveBeenCalledWith(binding.offerDraftId, binding.offerDraftRevision, binding.approvedOfferId);
  });

  it("rejects a persisted approval whose handoff provenance does not match", () => {
    const { approvedOffer, handoff } = persistedApproval();
    expect(buildOfferApprovalBinding(approvedOffer, {
      ...handoff,
      source: { ...handoff.source, draftId: "different-draft" }
    })).toBeUndefined();
  });

  it.each(["recipe", "timeline"] as const)("does not expose unsupported %s revisions as the global action", (kind) => {
    const draft = {
      draftId: "production-draft-1",
      status: "pending_review",
      reviewCards: [{
        cardId: `${kind}-1`,
        kind,
        title: kind,
        summary: "Nicht unterstützte Änderung",
        decision: "change_requested",
        operatorComment: "Bitte ändern"
      }]
    } as unknown as ProductionDraft;

    expect(productionDraftNextState(draft)).not.toBe("change_requested");
  });

  it("refreshes the local production review panel contract after a global mutation", async () => {
    const refreshEvent = vi.fn();
    window.addEventListener("catering:production-draft-refresh", refreshEvent);
    const refreshDashboard = vi.fn(async () => undefined);

    await runProductWorkspaceNextAction({
      route: "production",
      action: { kind: "approve_production", label: "Produktionsstand freigeben", draftId: "draft-1" },
      offerWorkbenchState: boundaryInput() as never,
      decideProductionDraft: vi.fn(async () => undefined),
      refreshDashboard,
      setNotice: vi.fn(),
      focus: vi.fn()
    });

    expect(refreshDashboard).toHaveBeenCalled();
    expect(refreshEvent).toHaveBeenCalledTimes(1);
    window.removeEventListener("catering:production-draft-refresh", refreshEvent);
  });
});
