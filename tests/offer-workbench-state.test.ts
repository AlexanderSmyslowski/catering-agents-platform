import { describe, expect, it } from "vitest";
import { buildOfferWorkbenchState } from "../backoffice-ui/src/offer-workbench-state.js";
import type { OfferWorkbenchStateInput } from "../backoffice-ui/src/offer-workbench-state.js";

describe("offer workbench state", () => {
  it("maps offer workbench props without changing values or callback references", () => {
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
    const specEdit = {
      editingSpecId: "spec-1",
      eventType: "meeting",
      eventDate: "2026-06-02",
      attendeeCount: "30",
      serviceForm: "flying",
      menuItems: "Canapes"
    };
    const specEditActions = {
      beginSpecEdit: (_spec: Record<string, unknown>) => undefined,
      setEventType: (_value: string) => undefined,
      setEventDate: (_value: string) => undefined,
      setAttendeeCount: (_value: string) => undefined,
      setServiceForm: (_value: string) => undefined,
      setMenuItems: (_value: string) => undefined,
      saveSpecEdit: async () => undefined,
      resetSpecEdit: () => undefined
    };
    const input: OfferWorkbenchStateInput = {
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
      specEdit,
      specEditActions
    };

    const state = buildOfferWorkbenchState(input);

    expect(state).toEqual(input);
    expect(state.manualInput).toBe(manualInput);
    expect(state.manualActions).toBe(manualActions);
    expect(state.filteredOfferDrafts).toBe(input.filteredOfferDrafts);
    expect(state.filteredSpecs).toBe(input.filteredSpecs);
    expect(state.specEdit).toBe(specEdit);
    expect(state.specEditActions).toBe(specEditActions);
  });
});
