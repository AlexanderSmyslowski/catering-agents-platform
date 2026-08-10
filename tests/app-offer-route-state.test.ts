import { describe, expect, it } from "vitest";
import { buildAppOfferRouteState } from "../backoffice-ui/src/app-offer-route-state.js";
import type { AppOfferRouteStateInput } from "../backoffice-ui/src/app-offer-route-state.js";

describe("app offer route state", () => {
  it("builds offer edit state, edit actions and workbench props without wrapping references", () => {
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
      setEventType: (_value: string) => undefined,
      setEventDate: (_value: string) => undefined,
      setAttendeeCount: (_value: string) => undefined,
      setServiceForm: (_value: string) => undefined,
      setMenuItems: (_value: string) => undefined,
      setCustomerName: (_value: string) => undefined,
      setVenueName: (_value: string) => undefined,
      setNotes: (_value: string) => undefined,
      submitManualSpec: async () => undefined
    };
    const input: AppOfferRouteStateInput = {
      submitting: true,
      latestSourceLabel: "request-1",
      offerText: "Anfrage",
      setOfferText: (_value) => undefined,
      submitOfferText: async () => undefined,
      intakeText: "Intake",
      setIntakeText: (_value) => undefined,
      submitIntakeText: async () => undefined,
      intakeChannel: "pdf_upload",
      setIntakeChannel: (_value) => undefined,
      intakeFile: null,
      setIntakeFile: (_file) => undefined,
      submitIntakeDocument: async () => undefined,
      manualInput,
      manualActions,
      filteredOfferDrafts: [{ draftId: "draft-1" }],
      activeDraft: { draftId: "draft-active" },
      selectedDraft: { draftId: "draft-selected" },
      setSelectedDraftId: (_draftId) => undefined,
      approveDraft: async (_draftId, _variantId) => undefined,
      filteredSpecs: [{ specId: "spec-1" }],
      activeSpec: { specId: "spec-active" },
      completeSpecCount: 2,
      partialSpecCount: 1,
      miniPilotRawResult: "",
      setMiniPilotRawResult: (_value) => undefined,
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
      beginSpecEdit: (_spec) => undefined,
      setEventType: (_value) => undefined,
      setEventDate: (_value) => undefined,
      setAttendeeCount: (_value) => undefined,
      setServiceForm: (_value) => undefined,
      setMenuItems: (_value) => undefined,
      saveSpecEdit: async () => undefined,
      resetSpecEdit: () => undefined
    };

    const state = buildAppOfferRouteState(input);

    expect(state.offerSpecEdit).toEqual({
      editingSpecId: "spec-edit-1",
      eventType: "meeting",
      eventDate: "2026-06-02",
      attendeeCount: "30",
      serviceForm: "flying",
      menuItems: "Canapes"
    });
    expect(state.offerSpecEditActions.beginSpecEdit).toBe(input.beginSpecEdit);
    expect(state.offerSpecEditActions.saveSpecEdit).toBe(input.saveSpecEdit);
    expect(state.offerWorkbenchState.specEdit).toBe(state.offerSpecEdit);
    expect(state.offerWorkbenchState.specEditActions).toBe(state.offerSpecEditActions);
    expect(state.offerWorkbenchState.manualInput).toBe(manualInput);
    expect(state.offerWorkbenchState.manualActions).toBe(manualActions);
    expect(state.offerWorkbenchState.filteredOfferDrafts).toBe(input.filteredOfferDrafts);
    expect(state.offerWorkbenchState.filteredSpecs).toBe(input.filteredSpecs);
    expect(state.offerWorkbenchState.setOfferText).toBe(input.setOfferText);
    expect(state.offerWorkbenchState.approveDraft).toBe(input.approveDraft);
    expect(state.offerWorkbenchState.setMiniPilotRawResult).toBe(input.setMiniPilotRawResult);
    expect(state.offerWorkbenchState.miniPilotReportState).toBe(input.miniPilotReportState);
  });
});
