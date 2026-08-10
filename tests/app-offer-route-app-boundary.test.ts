import { describe, expect, it, vi } from "vitest";
import {
  buildAppOfferRouteAppBoundary,
  type AppOfferRouteAppBoundaryInput
} from "../backoffice-ui/src/app-offer-route-app-boundary.js";

function input(
  overrides: Partial<AppOfferRouteAppBoundaryInput> = {}
): AppOfferRouteAppBoundaryInput {
  const manualInput = {
    eventType: "lunch",
    eventDate: "2026-06-01",
    attendeeCount: "42",
    serviceForm: "buffet",
    menuItems: "Salat, Dessert",
    customerName: "Demo Kunde",
    venueName: "Demo Ort",
    notes: "Synthetisch"
  };
  const manualActions = {
    setEventType: vi.fn(),
    setEventDate: vi.fn(),
    setAttendeeCount: vi.fn(),
    setServiceForm: vi.fn(),
    setMenuItems: vi.fn(),
    setCustomerName: vi.fn(),
    setVenueName: vi.fn(),
    setNotes: vi.fn(),
    submitManualSpec: vi.fn(async () => undefined)
  };

  return {
    createOfferFromText: vi.fn(async () => ({ draftId: "draft-offer-1" })),
    decideOfferDraft: vi.fn(async () => ({ approvedOffer: { approvedOfferId: "offer-1" } })),
    createProductionHandoff: vi.fn(async () => ({ handoff: { handoffId: "handoff-1" } })),
    createProductionDraftFromHandoff: vi.fn(async () => ({ draft: { draftId: "production-draft-1" } })),
    openProductionEntry: vi.fn(),
    submitting: false,
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    latestSourceLabel: "request-1",
    offerText: "Business Lunch fuer 35 Personen.",
    setOfferText: vi.fn(),
    intakeText: "Intake",
    setIntakeText: vi.fn(),
    submitIntakeText: vi.fn(async () => undefined),
    intakeChannel: "pdf_upload",
    setIntakeChannel: vi.fn(),
    intakeFile: null,
    setIntakeFile: vi.fn(),
    submitIntakeDocument: vi.fn(async () => undefined),
    manualInput,
    manualActions,
    filteredOfferDrafts: [{ draftId: "draft-1" }],
    activeDraft: { draftId: "draft-active" },
    selectedDraft: { draftId: "draft-selected" },
    setSelectedDraftId: vi.fn(),
    filteredSpecs: [{ specId: "spec-1" }],
    activeSpec: { specId: "spec-active" },
    completeSpecCount: 2,
    partialSpecCount: 1,
    miniPilotRawResult: "",
    setMiniPilotRawResult: vi.fn(),
    miniPilotReportState: {
      statusLabel: "noch kein Ergebnis",
      reasonLabel: "JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
      nextStepLabel: "Check lokal ausfuehren, JSON einfuellen und dann erst mit dem Draft weiterarbeiten.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: []
    },
    editingSpecId: "spec-edit-1",
    eventType: "meeting",
    eventDate: "2026-06-02",
    attendeeCount: "30",
    serviceForm: "flying",
    menuItems: "Canapes",
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

describe("app offer route app boundary", () => {
  it("wires offer creation into the existing offer workbench state", async () => {
    const calls: string[] = [];
    const boundaryInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      createOfferFromText: vi.fn(async (text) => {
        calls.push(`createOfferFromText:${text}`);
        return { draftId: "draft-new" };
      }),
      setSelectedDraftId: vi.fn((draftId) => {
        calls.push(`setSelectedDraftId:${draftId}`);
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const state = buildAppOfferRouteAppBoundary(boundaryInput);

    await state.offerWorkbenchState.submitOfferText();

    expect(boundaryInput.setError).not.toHaveBeenCalled();
    expect(state.offerWorkbenchState.manualInput).toBe(boundaryInput.manualInput);
    expect(state.offerWorkbenchState.filteredOfferDrafts).toBe(boundaryInput.filteredOfferDrafts);
    expect(state.offerWorkbenchState.setMiniPilotRawResult).toBe(boundaryInput.setMiniPilotRawResult);
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "createOfferFromText:Business Lunch fuer 35 Personen.",
      "setSelectedDraftId:draft-new",
      "refreshDashboard",
      "setNotice:Angebotsentwurf wurde erstellt.",
      "setSubmitting:false"
    ]);
  });

  it("wires explicit draft approval through the same app boundary", async () => {
    const calls: string[] = [];
    const boundaryInput = input({
      decideOfferDraft: vi.fn(async (draftId, variantId) => {
        calls.push(`decideOfferDraft:${draftId}:${variantId}`);
        return { approvedOffer: { approvedOfferId: "offer-approved" } };
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const state = buildAppOfferRouteAppBoundary(boundaryInput);

    await state.offerWorkbenchState.approveDraft("draft-1", "balanced");

    expect(boundaryInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "decideOfferDraft:draft-1:balanced",
      "setNotice:Angebotsvariante wurde freigegeben.",
      "refreshDashboard"
    ]);
  });

  it("wires a returned handoff into the focused production entry", async () => {
    const calls: string[] = [];
    const boundaryInput = input({
      createProductionHandoff: vi.fn(async (approvedOfferId) => {
        calls.push(`handoff:${approvedOfferId}`);
        return { handoff: { handoffId: "handoff-created" } };
      }),
      createProductionDraftFromHandoff: vi.fn(async (handoffId) => {
        calls.push(`production:${handoffId}`);
        return { draft: { draftId: "production-created" } };
      }),
      setApprovalBinding: vi.fn((binding) => calls.push(`binding:${JSON.stringify(binding)}`)),
      openProductionEntry: vi.fn((draftId) => calls.push(`open:${draftId}`))
    });
    const state = buildAppOfferRouteAppBoundary(boundaryInput);

    await state.offerWorkbenchState.createHandoff?.("draft-1", "approved-1");

    expect(calls).toEqual([
      "handoff:approved-1",
      "production:handoff-created",
      'binding:{"offerDraftId":"draft-1","approvedOfferId":"approved-1","handoffId":"handoff-created","productionDraftId":"production-created"}',
      "open:production-created"
    ]);
  });
});
