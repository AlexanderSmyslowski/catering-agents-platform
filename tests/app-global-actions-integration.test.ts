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
  buildOfferNextAction,
  runProductWorkspaceNextAction
} from "../backoffice-ui/src/App.js";
import { productionDraftEntryUrl } from "../backoffice-ui/src/production-entry-focus.js";
import type { ApprovedOffer, ProductionHandoff } from "@catering/shared-core";
import { loadProductionWorkspaceState } from "../backoffice-ui/src/api.js";
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
  it("prefers the persisted approved artifact over a stale ready draft", () => {
    const action = buildOfferNextAction({
      product: "offer",
      caseStatus: "open",
      hasSource: true,
      currentDraftId: "offer-draft-1",
      selectedVariantId: "variant-1",
      approvedOfferId: "approved-1",
      draft: {
        draftId: "offer-draft-1",
        revision: 4,
        eventSummary: "Business Lunch",
        variantSet: [{ variantId: "variant-1", label: "Ausgewogen" }],
        openQuestions: [],
        proposedEventSpec: {},
        reviewStatus: {
          priceReviewStatus: "verified",
          taxReviewStatus: "verified",
          allergenReviewStatus: "verified",
          hygieneTemperatureReviewStatus: "verified",
          sourceSecured: true,
          publishApproved: true
        }
      } as never
    });

    expect(action).toEqual({
      kind: "send_handoff",
      label: "An Produktion übergeben",
      approvedOfferId: "approved-1"
    });
  });

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
    const resolveProductionCaseFromHandoff = vi.fn(async () => ({ caseId: "production-case-1" }));

    await runProductWorkspaceNextAction({
      route: "offer",
      action: { kind: "inspect_handoff", label: "Übergabe öffnen", handoffId: handoff.handoffId },
      offerWorkbenchState: boundary.offerWorkbenchState,
      offerApprovalBinding: binding,
      openProductionEntry,
      resolveProductionCaseFromHandoff,
      setNotice: vi.fn(),
      focus: vi.fn()
    });

    expect(resolveProductionCaseFromHandoff).toHaveBeenCalledWith(handoff.handoffId);
    expect(openProductionEntry).toHaveBeenCalledWith(`production-draft-handoff-${handoff.handoffId}`, "production-case-1");
    expect(productionDraftEntryUrl(`production-draft-handoff-${handoff.handoffId}`, "production-case-1"))
      .toContain("productionCaseId=production-case-1");
  });

  it("reloads the resolved production case and exposes its handoff draft", async () => {
    const { approvedOffer, handoff } = persistedApproval();
    const binding: OfferApprovalBinding = buildOfferApprovalBinding(approvedOffer, handoff)!;
    const productionDraftId = `production-draft-handoff-${handoff.handoffId}`;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/production/v1/production/cases")) {
        return Response.json({ items: [{ caseId: "production-case-1", product: "production", displayName: "Fall", status: "open", createdAt: "", updatedAt: "" }] });
      }
      if (url.endsWith("/api/production/v1/production/cases/production-case-1")) {
        return Response.json({
          case: {
            caseId: "production-case-1",
            product: "production",
            displayName: "Fall",
            status: "open",
            schemaVersion: "1.0",
            businessId: "local",
            version: 1,
            createdAt: "",
            updatedAt: "",
            productionHandoffId: handoff.handoffId,
            sourceSpecId: "spec-1"
          },
          events: [{
            businessId: "local",
            eventId: "production-case-1-draft",
            caseId: "production-case-1",
            sequence: 1,
            at: "2026-08-27T12:00:00.000Z",
            role: "assistant",
            kind: "draft_created",
            text: "Produktionsentwurf erstellt.",
            artifactId: productionDraftId,
            revisionRef: {
              artifactType: "ProductionDraft",
              artifactId: productionDraftId,
              revision: 1,
              createdAt: "2026-08-27T12:00:00.000Z"
            }
          }]
        });
      }
      if (url.endsWith("/api/production/v1/production/drafts?caseId=production-case-1")) {
        return Response.json({
          items: [{
            businessId: "local",
            draftId: productionDraftId,
            revision: 1,
            status: "pending_review",
            createdAt: "2026-08-27T12:00:00.000Z",
            source: {
              kind: "handoff",
              receivedAt: "2026-08-27T12:00:00.000Z"
            },
            reviewCards: [],
            draftArtifacts: {
              eventSpec: {
                schemaVersion: "1.0",
                specId: "spec-1",
                lifecycle: { commercialState: "accepted" },
                readiness: { status: "complete", reasons: [] },
                sourceLineage: [{ sourceType: "manual_input", reference: "request-1" }],
                event: { title: "Business Lunch" },
                attendees: { expected: 20 },
                servicePlan: { eventType: "Lunch", serviceForm: "Buffet", modules: [] },
                menuPlan: []
              }
            }
          }],
          approvedProductionSpecs: []
        });
      }
      throw new Error(`unerwarteter Reload-Aufruf: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => null, setItem: () => undefined }
    });

    const openProductionEntry = vi.fn();
    await runProductWorkspaceNextAction({
      route: "offer",
      action: { kind: "inspect_handoff", label: "Übergabe öffnen", handoffId: handoff.handoffId },
      offerWorkbenchState: boundaryInput() as never,
      offerApprovalBinding: binding,
      resolveProductionCaseFromHandoff: vi.fn(async () => ({ caseId: "production-case-1" })),
      openProductionEntry,
      setNotice: vi.fn(),
      focus: vi.fn()
    });

    const productionCaseId = new URL(productionDraftEntryUrl(productionDraftId, "production-case-1"), "http://localhost")
      .searchParams.get("productionCaseId");
    const reloaded = await loadProductionWorkspaceState(productionCaseId ?? undefined);
    expect(productionCaseId).toBe("production-case-1");
    expect(reloaded.activeCase?.caseId).toBe("production-case-1");
    expect(reloaded.currentDraft?.draftId).toBe(productionDraftId);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/production/cases/production-case-1"), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/production/drafts?caseId=production-case-1"),
      expect.anything()
    );
    vi.unstubAllGlobals();
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
    expect(buildOfferApprovalBinding(approvedOffer, {
      ...handoff,
      source: undefined as never
    })).toBeUndefined();
  });

  it("does not expose a mutating action when raw approval IDs contradict the validated binding", () => {
    const action = buildOfferNextAction({
      product: "offer",
      caseStatus: "open",
      hasSource: true,
      currentDraftId: "offer-draft-1",
      selectedVariantId: "variant-1",
      approvedOfferId: "raw-untrusted-approved-id",
      handoffId: "raw-untrusted-handoff-id",
      approvalBindingState: "invalid",
      draft: {
        draftId: "offer-draft-1",
        revision: 4,
        eventSummary: "Business Lunch",
        variantSet: [{ variantId: "variant-1", label: "Ausgewogen" }],
        openQuestions: [],
        proposedEventSpec: {},
        reviewStatus: {
          priceReviewStatus: "verified",
          taxReviewStatus: "verified",
          allergenReviewStatus: "verified",
          hygieneTemperatureReviewStatus: "verified",
          sourceSecured: true,
          publishApproved: true
        }
      } as never
    });

    expect(action.kind).toBe("review_draft");
    expect(action).not.toMatchObject({ kind: "approve_offer" });
    expect(action).not.toMatchObject({ kind: "send_handoff" });
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
