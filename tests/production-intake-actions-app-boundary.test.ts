import { describe, expect, it, vi } from "vitest";
import {
  buildProductionIntakeActionsAppBoundary,
  type ProductionIntakeActionsAppBoundaryInput
} from "../backoffice-ui/src/production-intake-actions-app-boundary.js";
import type { ProductionDraft } from "../backoffice-ui/src/api.js";

function file(name = "angebot.pdf") {
  return new File(["Lunch fuer 40 Personen"], name, { type: "application/pdf" });
}

function draft(): ProductionDraft {
  return {
    draftId: "production-draft-upload-1",
    status: "pending_review",
    reviewCards: [],
    createdAt: "2026-07-10T10:00:00.000Z"
  };
}

function manualInput() {
  return {
    eventType: "conference",
    eventDate: "2026-06-15",
    attendeeCount: "40",
    serviceForm: "buffet",
    menuItems: "Tomatensuppe",
    customerName: "Demo Kunde",
    venueName: "Demo Ort",
    notes: "Synthetisch"
  };
}

function input(
  overrides: Partial<ProductionIntakeActionsAppBoundaryInput> = {}
): ProductionIntakeActionsAppBoundaryInput {
  const selectedFile = file();

  return {
    createAcceptedSpecFromText: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-text-1" } })),
    intakeText: "Lunch fuer 40 Personen mit Tomatensuppe.",
    createAcceptedSpecFromDocument: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-upload-1" } })),
    createProductionDraftFromDocument: vi.fn(async () => ({ draft: draft() })),
    intakeFile: selectedFile,
    intakeChannel: "pdf_upload",
    createAcceptedSpecFromManualForm: vi.fn(async () => ({ acceptedEventSpec: { specId: "spec-manual-1" } })),
    buildCurrentManualSpecInput: vi.fn(() => manualInput()),
    setSubmitting: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    clearMessages: vi.fn(),
    startIncomingProductionFile: vi.fn(),
    startDocumentProgress: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    completeIncomingProductionFile: vi.fn(),
    completeDocumentProgress: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    failIncomingProductionFile: vi.fn(),
    failDocumentProgress: vi.fn(),
    clearFocusedProductionSpecId: vi.fn(),
    clearSelectedPlanId: vi.fn(),
    resetPlanProgress: vi.fn(),
    resetIntakeRequestDetail: vi.fn(),
    resetSpecEdit: vi.fn(),
    resetManualSpecDraft: vi.fn(),
    setError: vi.fn(),
    manualSpecForm: {
      manualEventType: "conference",
      manualEventDate: "2026-06-15",
      manualAttendeeCount: "40",
      manualServiceForm: "buffet",
      manualMenuItems: "Tomatensuppe",
      manualCustomerName: "Demo Kunde",
      manualVenueName: "Demo Ort",
      manualNotes: "Synthetisch",
      setManualEventType: vi.fn(),
      setManualEventDate: vi.fn(),
      setManualAttendeeCount: vi.fn(),
      setManualServiceForm: vi.fn(),
      setManualMenuItems: vi.fn(),
      setManualCustomerName: vi.fn(),
      setManualVenueName: vi.fn(),
      setManualNotes: vi.fn()
    },
    ...overrides
  };
}

describe("production intake actions app boundary", () => {
  it("wires text, document, manual actions, and manual form state through one app boundary", async () => {
    const selectedFile = file("kundendokument.pdf");
    const boundaryInput = input({ intakeFile: selectedFile });
    const boundary = buildProductionIntakeActionsAppBoundary(boundaryInput);

    expect(boundary.manualSpecInput).toEqual({
      eventType: "conference",
      eventDate: "2026-06-15",
      attendeeCount: "40",
      serviceForm: "buffet",
      menuItems: "Tomatensuppe",
      customerName: "Demo Kunde",
      venueName: "Demo Ort",
      notes: "Synthetisch"
    });

    boundary.manualSpecActions.setEventType("lunch");
    await boundary.handleIntakeSubmit();
    await boundary.submitSelectedDocument();
    await boundary.submitSelectedIntakeDocument();
    await boundary.handleManualSpecSubmit();

    expect(boundaryInput.manualSpecForm.setManualEventType).toHaveBeenCalledWith("lunch");
    expect(boundaryInput.createAcceptedSpecFromText).toHaveBeenCalledWith(boundaryInput.intakeText);
    expect(boundaryInput.createAcceptedSpecFromDocument).toHaveBeenCalledWith(selectedFile, "pdf_upload");
    expect(boundaryInput.createProductionDraftFromDocument).toHaveBeenCalledWith(selectedFile);
    expect(boundaryInput.createAcceptedSpecFromManualForm).toHaveBeenCalledWith(manualInput());
    expect(boundaryInput.resetManualSpecDraft).toHaveBeenCalledTimes(1);
    expect(boundaryInput.setError).not.toHaveBeenCalled();
  });

  it("keeps dropped file processing available for window and source input handlers", async () => {
    const droppedFile = file("drop.pdf");
    const boundaryInput = input();
    const boundary = buildProductionIntakeActionsAppBoundary(boundaryInput);

    await boundary.processIncomingProductionFile(droppedFile, "email");

    expect(boundaryInput.startIncomingProductionFile).toHaveBeenCalledWith(droppedFile, "email");
    expect(boundaryInput.createProductionDraftFromDocument).toHaveBeenCalledWith(droppedFile);
    expect(boundaryInput.createAcceptedSpecFromDocument).not.toHaveBeenCalled();
  });
});
