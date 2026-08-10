// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OfferConversationalWorkbench,
  type OfferWorkbenchProps
} from "../backoffice-ui/src/offer-workbench.js";
import {
  buildOfferApprovalAction,
  type OfferApprovalBinding
} from "../backoffice-ui/src/offer-approval-action.js";

function draft(draftId: string, eventSummary: string, revision = 1) {
  return {
    draftId,
    revision,
    eventSummary,
    openQuestions: [],
    variantSet: [{ variantId: "classic", label: "Klassisch" }],
    customerFacingText: "Text",
    internalWorkingText: "Intern",
    proposedEventSpec: {
      specId: `spec-${draftId}`,
      readiness: { status: "complete" }
    }
  };
}

function props(overrides: Partial<OfferWorkbenchProps> = {}): OfferWorkbenchProps {
  const draftA = draft("draft-a", "Angebot A");
  const draftB = draft("draft-b", "Angebot B");
  return {
    submitting: false,
    latestSourceLabel: "request-a",
    offerText: "",
    setOfferText: () => undefined,
    submitOfferText: async () => undefined,
    intakeText: "",
    setIntakeText: () => undefined,
    submitIntakeText: async () => undefined,
    intakeChannel: "pdf_upload",
    setIntakeChannel: () => undefined,
    intakeFile: null,
    setIntakeFile: () => undefined,
    submitIntakeDocument: async () => undefined,
    manualInput: {
      eventType: "",
      eventDate: "",
      attendeeCount: "",
      serviceForm: "",
      menuItems: "",
      customerName: "",
      venueName: "",
      notes: ""
    },
    manualActions: {
      setEventType: () => undefined,
      setEventDate: () => undefined,
      setAttendeeCount: () => undefined,
      setServiceForm: () => undefined,
      setMenuItems: () => undefined,
      setCustomerName: () => undefined,
      setVenueName: () => undefined,
      setNotes: () => undefined,
      submitManualSpec: async () => undefined
    },
    filteredOfferDrafts: [draftA, draftB],
    activeDraft: draftA,
    selectedDraft: draftA,
    setSelectedDraftId: () => undefined,
    approveDraft: async () => undefined,
    createHandoff: async () => undefined,
    filteredSpecs: [],
    activeSpec: draftA.proposedEventSpec,
    completeSpecCount: 1,
    partialSpecCount: 0,
    miniPilotRawResult: "",
    setMiniPilotRawResult: () => undefined,
    miniPilotReportState: {
      statusLabel: "noch kein Ergebnis",
      reasonLabel: "Kein Ergebnis.",
      nextStepLabel: "Prüfen.",
      commandLabel: "npm run check",
      errorLabels: []
    },
    specEdit: {
      editingSpecId: undefined,
      eventType: "",
      eventDate: "",
      attendeeCount: "",
      serviceForm: "",
      menuItems: ""
    },
    specEditActions: {
      beginSpecEdit: () => undefined,
      setEventType: () => undefined,
      setEventDate: () => undefined,
      setAttendeeCount: () => undefined,
      setServiceForm: () => undefined,
      setMenuItems: () => undefined,
      saveSpecEdit: async () => undefined,
      resetSpecEdit: () => undefined
    },
    ...overrides
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function ApprovalBindingHarness() {
  const draftA = draft("draft-a", "Angebot A");
  const draftB = draft("draft-b", "Angebot B");
  const [selectedDraftId, setSelectedDraftId] = useState("draft-a");
  const [approvalBinding, setApprovalBinding] = useState<OfferApprovalBinding>();
  const approvalAction = buildOfferApprovalAction({
    decideOfferDraft: async () => ({ approvedOffer: { approvedOfferId: "approved-a" } }),
    createProductionHandoff: async () => ({ handoff: { handoffId: "handoff-a" } }),
    createProductionDraftFromHandoff: async () => ({ draft: { draftId: "production-a" } }),
    setSubmitting: () => undefined,
    clearMessages: () => undefined,
    refreshDashboard: async () => undefined,
    setNotice: () => undefined,
    setError: () => undefined,
    setApprovalBinding,
    openProductionEntry: () => undefined
  });

  return createElement(OfferConversationalWorkbench, props({
    activeDraft: draftA,
    selectedDraft: selectedDraftId === "draft-a" ? draftA : draftB,
    setSelectedDraftId,
    approveDraft: approvalAction.approve,
    approvalBinding,
    createHandoff: approvalAction.createHandoff
  }));
}

describe("offer workbench approval binding", () => {
  it("hides draft A's handoff and production entry after draft B receives focus", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ApprovalBindingHarness));
    });

    const approveButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "Variante freigeben: Klassisch"
    );
    await act(async () => {
      approveButton?.click();
      await flushPromises();
    });
    expect(Array.from(document.querySelectorAll("button")).some((button) =>
      button.textContent === "An Produktion übergeben"
    )).toBe(true);

    const handoffButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent === "An Produktion übergeben"
    );
    await act(async () => {
      handoffButton?.click();
      await flushPromises();
    });
    expect(Array.from(document.querySelectorAll("a")).some((link) =>
      link.textContent === "Produktionsentwurf öffnen"
    )).toBe(true);

    const draftBButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.querySelector("strong")?.textContent === "Angebot B"
    );
    await act(async () => {
      draftBButton?.click();
    });

    expect(Array.from(document.querySelectorAll("button")).some((button) =>
      button.textContent === "An Produktion übergeben"
    )).toBe(false);
    expect(Array.from(document.querySelectorAll("a")).some((link) =>
      link.textContent === "Produktionsentwurf öffnen"
    )).toBe(false);
    expect(document.body.textContent ?? "").not.toContain("approved-a");
    expect(document.body.textContent ?? "").not.toContain("handoff-a");
    expect(document.body.textContent ?? "").not.toContain("production-a");

    await act(async () => root.unmount());
  });

  it("hides revision 1 handoff state while revision 2 of the same draft is focused", () => {
    const revisionTwo = draft("draft-a", "Angebot A, korrigiert", 2);
    const revisionOneBinding = {
      offerDraftId: "draft-a",
      offerDraftRevision: 1,
      approvedOfferId: "approved-a-revision-1",
      handoffId: "handoff-a-revision-1",
      productionDraftId: "production-a-revision-1"
    } as OfferApprovalBinding & { offerDraftRevision: number };

    const markup = renderToStaticMarkup(createElement(OfferConversationalWorkbench, props({
      activeDraft: revisionTwo,
      selectedDraft: revisionTwo,
      approvalBinding: revisionOneBinding
    })));

    expect(markup).toContain("Angebot A, korrigiert");
    expect(markup).not.toContain("An Produktion übergeben");
    expect(markup).not.toContain("Produktionsentwurf öffnen");
    expect(markup).not.toContain("production-a-revision-1");
  });
});
