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
  buildOfferApprovalBinding,
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
    openProductionHandoff: async () => undefined,
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

it("keeps source entry secondary for an opened draft and puts open questions before editors", () => {
  const data=props({onMenuSaved:async()=>undefined,activeDraft:{...draft("active","SYNTHETISCH 100 Gäste"),openQuestions:["Sonderkost klären"]},selectedDraft:undefined});
  const container=document.createElement("div");container.innerHTML=renderToStaticMarkup(createElement(OfferConversationalWorkbench,data));
  const source=container.querySelector(".offer-composer") as HTMLDetailsElement;
  expect(source.tagName).toBe("DETAILS");expect(source.open).toBe(false);
  expect(source.querySelector("summary")?.textContent).toContain("diesem Auftrag");
  expect(container.querySelector(".offer-calm-summary")?.textContent).not.toContain("Jetzt:");
  expect(container.querySelector(".offer-calm-summary")?.textContent).toContain("keine externe Freigabe");
});

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
    createProductionCaseFromHandoff: async () => ({ case: { caseId: "production-case-a" } }),
    createProductionDraftFromHandoff: async () => ({ draft: { draftId: "production-a" } }),
    setActiveProductionCaseId: () => undefined,
    clearActiveOfferCaseId: () => undefined,
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

  it.each([
    [undefined, ["Noch nicht freigegeben", "Noch nicht übergeben"], true, false, false],
    [{ offerDraftId: "draft-a", offerDraftRevision: 1, approvedOfferId: "approved-a" },
      ["Intern freigegeben", "Noch nicht übergeben"], false, true, false],
    [{ offerDraftId: "draft-a", offerDraftRevision: 1, approvedOfferId: "approved-a", handoffId: "handoff-a" },
      ["Intern freigegeben", "Übergeben – Planung im Produktionsauftrag"], false, false, true]
  ] as const)("separates captured data, offer approval and production handoff (%s)", (approvalBinding, status, canApprove, canHandoff, canOpen) => {
    const html = renderToStaticMarkup(createElement(OfferConversationalWorkbench, props({
      approvalBinding,
      filteredSpecs: [draft("draft-a", "Angebot A").proposedEventSpec]
    })));
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const fact of status) expect(doc.querySelector('[role="status"]')?.textContent).toContain(fact);
    expect(doc.body.textContent).toContain("Erfasste Daten: 1 vollständig");
    expect(doc.body.textContent).not.toContain("Produktionsübergabe: 1 vollständig");
    const actions = [...doc.querySelectorAll("button")].map(button => button.textContent);
    expect(actions.includes("Variante freigeben: Klassisch")).toBe(canApprove);
    expect(actions.includes("An Produktion übergeben")).toBe(canHandoff);
    expect(actions.includes("Produktionsauftrag öffnen")).toBe(canOpen);
    expect(doc.querySelector('a[href="/produktion"]')).toBeNull();
    expect(doc.body.textContent).toContain("Erfasste Veranstaltungsdaten");
  });

  it("offers customer entry for a new text request and hides it in a bound case", async () => {
    const setCustomerName = vi.fn();
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    const unbound = props({ activeDraft: undefined, selectedDraft: undefined, filteredOfferDrafts: [] });
    unbound.manualActions = { ...unbound.manualActions, setCustomerName };
    await act(async () => root.render(createElement(OfferConversationalWorkbench, unbound)));
    const customer = document.querySelector<HTMLInputElement>('input[autocomplete="organization"]')!;
    expect(customer).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(customer, "SYNTHETISCHER Kunde");
      customer.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(setCustomerName).toHaveBeenCalledWith("SYNTHETISCHER Kunde");
    await act(async () => root.render(createElement(OfferConversationalWorkbench, { ...unbound, hasActiveOfferCase: true })));
    expect(document.querySelector('input[autocomplete="organization"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("keeps the focused draft and pending pricing inputs until saving or discarding", async () => {
    const setSelectedDraftId = vi.fn();
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    await act(async () => root.render(createElement(OfferConversationalWorkbench, props({
      onMenuSaved: async () => undefined, setSelectedDraftId
    }))));
    const begin = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Preisaufstellung erfassen");
    expect(begin).toBeDefined();
    await act(async () => begin?.click());
    const otherDraft = Array.from(document.querySelectorAll("button")).find(button => button.querySelector("strong")?.textContent === "Angebot B");
    expect(otherDraft?.disabled).toBe(true);
    await act(async () => otherDraft?.click());
    expect(setSelectedDraftId).not.toHaveBeenCalled();
    const newDraft = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Entwurf aus Text erstellen");
    expect(newDraft?.disabled).toBe(true);
    expect(document.querySelector(".order-status-facts")?.textContent).toContain("Nach dem Speichern verfügbar");
    expect(document.body.textContent).toContain("Vor dem Export Änderungen speichern oder verwerfen.");
    const discard = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Verwerfen");
    await act(async () => discard?.click());
    expect(otherDraft?.disabled).toBe(false);
    await act(async () => root.unmount());
  });


  it("resolves a persisted handoff before reopening production instead of navigating with only a draft ID", async () => {
    const openProductionHandoff = vi.fn(async (_handoffId: string) => undefined);
    const binding = buildOfferApprovalBinding(
      { approvedOfferId: "approved-a", sourceDraft: { draftId: "draft-a", revision: 1 } },
      { handoffId: "handoff-a", approvedOfferId: "approved-a", source: { draftId: "draft-a", revision: 1, selectedVariantId: "classic" } }
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(OfferConversationalWorkbench, props({ approvalBinding: binding, openProductionHandoff })));
    });

    const openButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent === "Produktionsauftrag öffnen"
    );
    expect(openButton).toBeDefined();
    expect(container.querySelector('a[href*="productionDraftId="]')).toBeNull();

    await act(async () => {
      openButton?.click();
      await flushPromises();
    });
    expect(openProductionHandoff).toHaveBeenCalledExactlyOnceWith("handoff-a");

    await act(async () => {
      root.render(createElement(OfferConversationalWorkbench, props({ approvalBinding: binding, openProductionHandoff, submitting: true })));
    });
    const busyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent === "Produktionsauftrag öffnen"
    );
    expect(busyButton?.disabled).toBe(true);
    await act(async () => busyButton?.click());
    expect(openProductionHandoff).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it.each(["", " \n\t "])(
    "disables text draft creation for blank offer input while keeping meaningful text available",
    (offerText) => {
      const blankMarkup = renderToStaticMarkup(createElement(OfferConversationalWorkbench, props({ offerText })));
      const filledMarkup = renderToStaticMarkup(
        createElement(OfferConversationalWorkbench, props({ offerText: "Business Lunch fuer 35 Personen." }))
      );

      expect(blankMarkup).toMatch(/<button[^>]*disabled=""[^>]*>Entwurf aus Text erstellen<\/button>/);
      expect(filledMarkup).toMatch(/<button(?:(?!disabled)[^>])*>Entwurf aus Text erstellen<\/button>/);
    }
  );

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
    expect(Array.from(document.querySelectorAll("button")).some((link) =>
      link.textContent === "Produktionsauftrag öffnen"
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
    expect(Array.from(document.querySelectorAll("button")).some((link) =>
      link.textContent === "Produktionsauftrag öffnen"
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
    expect(markup).not.toContain("Produktionsauftrag öffnen");
    expect(markup).not.toContain("production-a-revision-1");
  });
});

it("removes all repeated extraction questions when a revised offer answers them", async () => {
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  const repeatedTimeQuestion = "Wie lautet das verbindliche Zeitfenster?";
  const unanswered = "Allergene, Hygiene, Temperaturführung und Standzeiten prüfen.";
  const initial = { ...draft("before-edit", "Vor Bearbeitung"), openQuestions: [repeatedTimeQuestion, repeatedTimeQuestion, unanswered] };
  const revised = { ...draft("after-edit", "Nach Bearbeitung"), openQuestions: [unanswered] };
  const duplicateKeyWarning = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await act(async () => root.render(createElement(OfferConversationalWorkbench, props({ activeDraft: initial, selectedDraft: initial }))));
    await act(async () => root.render(createElement(OfferConversationalWorkbench, props({ activeDraft: revised, selectedDraft: revised }))));
    const region = document.querySelector('[aria-label="Offene Punkte"]')!;
    expect(region.querySelector("h3")?.textContent).toBe("Offene Punkte (1)");
    expect(Array.from(region.querySelectorAll("li")).map(item => item.textContent)).toEqual([unanswered]);
    expect(duplicateKeyWarning).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    duplicateKeyWarning.mockRestore();
  }
});
