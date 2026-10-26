// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProductionInputPanel,
  type ProductionManualInputActions,
  type ProductionSourceInputActions,
  type ProductionSourceInputValues
} from "../backoffice-ui/src/production-input-panel.js";

import { ProductionConversationalWorkbench, type ProductionWorkbenchSummary } from "../backoffice-ui/src/production-workbench.js";

const noop = () => undefined;
const noopAsync = async () => undefined;
const originalFetch = globalThis.fetch;
const activeCaseId = "case-production-input-transition";

const sourceInputActions: ProductionSourceInputActions = {
  uploadInputRef: { current: null },
  setDragActive: noop,
  setIntakeChannel: noop,
  setIntakeText: noop,
  openFilePicker: noop,
  clearWorkspace: noop,
  archiveCurrentIntake: noopAsync,
  handleDrop: noop,
  handleFileSelection: noop,
  submitDocument: noopAsync,
  submitText: noopAsync
};

const manualInputActions: ProductionManualInputActions = {
  setEventType: noop,
  setEventDate: noop,
  setAttendeeCount: noop,
  setServiceForm: noop,
  setMenuItems: noop,
  setCustomerName: noop,
  setVenueName: noop,
  setNotes: noop,
  submitManualSpec: noopAsync
};

const focusedSpec = {
  specId: "spec-upload-review",
  event: { type: "reception", date: "2026-09-18" },
  attendees: { expected: 45 },
  servicePlan: { serviceForm: "buffet" },
  readiness: { status: "partial" },
  menuPlan: [{ componentId: "vitello", label: "Vitello tonnato" }]
};

function sourceInput(file: File, documentPhase: ProductionSourceInputValues["documentPhase"]): ProductionSourceInputValues {
  return {
    dragActive: false,
    intakeFile: file,
    intakeChannel: "pdf_upload",
    documentPhase,
    activeDocumentName: file.name,
    documentProgress: documentPhase === "done" ? 100 : 60,
    intakeText: "",
    canClearWorkspace: true,
    canArchiveCurrentIntake: false,
    clearWorkspaceTitle: "Arbeitsbereich leeren",
    archiveCurrentIntakeTitle: "Kein Intake-Kontext"
  };
}

function panel(
  file: File,
  documentPhase: ProductionSourceInputValues["documentPhase"],
  includeFocusedSpec = true
) {
  return createElement(ProductionInputPanel, {
    submitting: documentPhase === "analysing",
    sourceInput: sourceInput(file, documentPhase),
    sourceInputActions,
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
    manualInputActions,
    activeCaseId,
    focusedProductionSpec: includeFocusedSpec ? focusedSpec : undefined,
    productionQuestions: ["Welche Herstellungsart gilt für Vitello tonnato?"],
    productionAssumptions: []
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("production input panel upload transition", () => {
  it("distinguishes an applied plan from its still open professional questions", async () => {
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(ProductionConversationalWorkbench, {
        summary: { approvalState: "applied", hasActiveContext: true, activeSpecLabel: "Synthetischer Testauftrag",
          readinessLabel: "unzureichend", planStatusLabel: "vollständig", purchaseStatusLabel: "1 Liste · 29 Positionen",
          questionCount: 4, answeredQuestionCount: 0, unansweredQuestionCount: 4,
          productionObjectCount: 1, productionObjectStatusLabel: "1 Plan · vollständig", purchaseListCount: 1 },
        nextStep: { title: "Unterlagen", description: "Unterlagen prüfen" },
        miniPilotRawResult: "", setMiniPilotRawResult: noop, miniPilotReportState: { status: "empty", summary: "" } as never,
        slots: { inputSlot: null, questionsSlot: null, productionObjectsSlot: null, purchaseListSlot: null, lowerSlots: null }
      })));
      expect(container.textContent).toContain("Plan übernommen · 4 fachliche Rückfragen offen");
      expect(container.textContent).toContain("erteilt · übernommen");
      expect(container.textContent).not.toContain("Küchenfreigabe erteilt");
    } finally { await act(async () => root.unmount()); }
  });
  it("preserves the input DOM and user value when a production context arrives", async () => {
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    const summary: ProductionWorkbenchSummary = {
      activeSpecLabel: "Testauftrag", readinessLabel: "offen", planStatusLabel: "offen", purchaseStatusLabel: "noch keine Liste",
      questionCount: 0, answeredQuestionCount: 0, unansweredQuestionCount: 0,
      productionObjectCount: 0, productionObjectStatusLabel: "noch kein Plan", purchaseListCount: 0
    };
    const render = (hasActiveContext: boolean) => createElement(ProductionConversationalWorkbench, {
      summary: { ...summary, hasActiveContext }, nextStep: { title: "Prüfen", description: "Prüfen" },
      miniPilotRawResult: "", setMiniPilotRawResult: noop, miniPilotReportState: { status: "empty", summary: "" } as never,
      slots: { inputSlot: createElement("input", { "aria-label": "Begonnene Eingabe", defaultValue: "" }), questionsSlot: null, productionObjectsSlot: null, purchaseListSlot: null, lowerSlots: null }
    });
    await act(async () => root.render(render(false)));
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Begonnene Eingabe"]')!;
    input.value = "Eingabe erhalten";
    await act(async () => root.render(render(true)));
    expect(container.querySelector('input[aria-label="Begonnene Eingabe"]')).toBe(input);
    expect(input.value).toBe("Eingabe erhalten");
    await act(async () => root.unmount());
  });

  it("collapses an empty source when the selected case context resolves asynchronously", async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ items: [] }));
    const file = new File(["synthetic"], "request.txt", { type: "text/plain" });
    const base = panel(file, "idle", false).props;
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    const render = (resolved: boolean) => createElement(ProductionInputPanel, { ...base,
      hasActiveProductionContext: resolved, sourceInput: { ...base.sourceInput, intakeFile: null }
    });
    await act(async () => { root.render(render(false)); await Promise.resolve(); });
    expect(document.querySelector<HTMLDetailsElement>(".production-source-entry")?.open).toBe(true);
    await act(async () => root.render(render(true)));
    expect(document.querySelector<HTMLDetailsElement>(".production-source-entry")?.open).toBe(false);
    await act(async () => root.unmount());
  });

  it("keeps a manually opened source and focused field visible when text is cleared", async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ items: [] }));
    const file = new File(["synthetic"], "request.txt", { type: "text/plain" });
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    const base = panel(file, "idle").props;
    const render = (text: string) => createElement(ProductionInputPanel, {
      ...base, sourceInput: { ...base.sourceInput, intakeFile: null, intakeText: text }, hasActiveProductionContext: true
    });
    await act(async () => { root.render(render("")); await Promise.resolve(); });
    const disclosure = container.querySelector<HTMLDetailsElement>(".production-source-entry")!;
    expect(disclosure.open).toBe(false);
    disclosure.open = true;
    const text = container.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Beispiel: Bitte"]')!;
    text.focus();
    await act(async () => root.render(render("Zwischenstand")));
    await act(async () => root.render(render("")));
    expect(disclosure.open).toBe(true);
    expect(document.activeElement).toBe(text);
    await act(async () => root.unmount());
  });

  it("moves a completed PDF analysis to the review start and exposes the local original on demand", async () => {
    const file = new File(["%PDF-1.4 fixture"], "angebot.pdf", { type: "application/pdf" });
    const createObjectUrl = vi.fn(() => "blob:production-upload-review");
    const revokeObjectUrl = vi.fn();
    const scrollIntoView = vi.fn();
    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(panel(file, "analysing"));
        await Promise.resolve();
      });
      await act(async () => {
        root.render(panel(file, "done"));
        await Promise.resolve();
        await Promise.resolve();
      });

      const review = container.querySelector<HTMLElement>("#production-upload-review");
      expect(review).not.toBeNull();
      expect(document.activeElement).toBe(review);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", inline: "nearest", behavior: "auto" });
      expect(container.textContent).toContain("KI-Entwurf prüfen");
      expect(container.textContent).toContain("Noch nichts ist berechnet oder freigegeben.");
      expect(container.textContent).toContain("Originalangebot anzeigen");
      expect(container.querySelector("iframe")?.getAttribute("src")).toBe("blob:production-upload-review");
      expect(createObjectUrl).toHaveBeenCalledWith(file);

      await act(async () => root.unmount());
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:production-upload-review");
    } finally {
      if (createObjectUrlDescriptor) {
        Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
      } else {
        Reflect.deleteProperty(URL, "createObjectURL");
      }
      if (revokeObjectUrlDescriptor) {
        Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
      } else {
        Reflect.deleteProperty(URL, "revokeObjectURL");
      }
      if (scrollDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  it("does not render a document viewer for non-PDF sources", async () => {
    const file = new File(["Anfrage per E-Mail"], "anfrage.eml", { type: "message/rfc822" });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(panel(file, "done"));
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Originalangebot anzeigen");
    expect(container.querySelector("iframe")).toBeNull();
    await act(async () => root.unmount());
  });

  it("shows the newest pending draft instead of invented production data before approval", async () => {
    const file = new File(["%PDF-1.4 fixture"], "angebot.pdf", { type: "application/pdf" });
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
      }
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{
        draftId: "draft-from-upload",
        status: "pending_review",
        createdAt: "2026-07-10T12:00:00.000Z",
        source: { kind: "ai_provider" },
        reviewCards: [{
          cardId: "card-menu",
          kind: "menu_component",
          title: "12 Angebotspositionen prüfen",
          summary: "Jede kulinarische Position wurde dem Entwurf einmal zugeordnet.",
          decision: "pending"
        }],
        draftArtifacts: {
          eventSpec: { event: { title: "Flying Buffet · 45 Personen" } }
        }
      }]
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })) as typeof fetch;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(panel(file, "done", false));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("KI-Entwurf prüfen");
    expect(container.textContent).toContain("Flying Buffet · 45 Personen");
    expect(container.textContent).toContain("12 Angebotspositionen prüfen");
    expect(container.textContent).toContain("wartet auf Prüfung");
    expect(container.textContent).not.toContain("Noch keine Produktionsdaten erkannt");
    await act(async () => root.unmount());
  });

  it("shows a persisted pending draft after reload without requiring the original upload state", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
      }
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{
        draftId: "draft-after-reload",
        status: "pending_review",
        createdAt: "2026-07-12T20:00:00.000Z",
        source: { kind: "ai_provider" },
        reviewCards: [{
          cardId: "card-menu",
          kind: "menu_component",
          title: "Kokos-Cheesecake | Brombeere",
          summary: "Als Angebotskomponente erkannt.",
          decision: "pending"
        }],
        draftArtifacts: {
          eventSpec: { event: { title: "Flying Buffet · 45 Personen" } }
        }
      }]
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })) as typeof fetch;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(ProductionInputPanel, {
        submitting: false,
        sourceInput: {
          dragActive: false,
          intakeFile: null,
          intakeChannel: "pdf_upload",
          documentPhase: "idle",
          documentProgress: 0,
          intakeText: "",
          canClearWorkspace: false,
          canArchiveCurrentIntake: false,
          clearWorkspaceTitle: "Kein aktiver Produktionsarbeitsbereich",
          archiveCurrentIntakeTitle: "Kein Intake-Kontext"
        },
        sourceInputActions,
        activeCaseId,
        hasActiveProductionContext: true,
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
        manualInputActions,
        productionQuestions: [],
        productionAssumptions: []
      }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Offenen KI-Entwurf weiter prüfen");
    expect(container.textContent).toContain("Flying Buffet · 45 Personen");
    expect(container.textContent).toContain("Kokos-Cheesecake | Brombeere");
    expect(container.querySelector<HTMLDetailsElement>(".production-source-entry")?.open).toBe(false);
    const review = container.querySelector('[aria-label="Produktionsentwurf-Prüfung"]');
    expect(review).not.toBeNull();
    expect(review?.closest("details.production-source-entry")).toBeNull();
    await act(async () => root.unmount());
  });
});
