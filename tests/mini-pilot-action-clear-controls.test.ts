// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfferConversationalWorkbench } from "../backoffice-ui/src/offer-workbench.js";
import { ProductionPlanDownloadCard } from "../backoffice-ui/src/production-plan-download-card.js";

type OfferWorkbenchProps = Parameters<typeof OfferConversationalWorkbench>[0];

function offerWorkbenchProps(overrides: Partial<OfferWorkbenchProps> = {}): OfferWorkbenchProps {
  return {
    submitting: false,
    latestSourceLabel: "request-1",
    offerText: "Lunch fuer 35 Personen.",
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
    filteredOfferDrafts: [
      {
        draftId: "draft-1",
        eventSummary: "Lunch-Angebot",
        openQuestions: [],
        variantSet: [{ variantId: "classic", label: "Klassisch" }],
        customerFacingText: "Text",
        internalWorkingText: "Intern",
        proposedEventSpec: {
          specId: "spec-1",
          readiness: { status: "complete" }
        }
      }
    ],
    activeDraft: {
      draftId: "draft-1",
      eventSummary: "Lunch-Angebot",
      openQuestions: [],
      variantSet: [{ variantId: "classic", label: "Klassisch" }],
      customerFacingText: "Text",
      internalWorkingText: "Intern",
      proposedEventSpec: {
        specId: "spec-1",
        readiness: { status: "complete" }
      }
    },
    selectedDraft: undefined,
    setSelectedDraftId: () => undefined,
    approveDraft: async () => undefined,
    filteredSpecs: [],
    activeSpec: { specId: "spec-1", readiness: { status: "complete" } },
    completeSpecCount: 1,
    partialSpecCount: 0,
    miniPilotRawResult:
      '{"ok":true,"summary":{"status":"ready","reason":"mini_pilot_ready","nextStep":"Draft nur manuell pruefen."}}',
    setMiniPilotRawResult: () => undefined,
    miniPilotReportState: {
      statusLabel: "ready",
      reasonLabel: "Mini-Pilot-Rahmen ist gruen.",
      nextStepLabel: "Draft nur manuell pruefen.",
      commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
      errorLabels: []
    },
    miniPilotStorageHintLabel: "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20",
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
  vi.unstubAllEnvs();
  document.body.innerHTML = "";
});

describe("mini-pilot action clear controls", () => {
  it("shows the clear control at the offer takeover anchor when a mini-pilot result is present", () => {
    vi.stubEnv("VITE_SHOW_MINI_PILOT_PANEL", "1");

    const markup = renderToStaticMarkup(
      createElement(OfferConversationalWorkbench, offerWorkbenchProps())
    );

    expect(markup).toContain("Mini-Pilot-Stand leeren");
  });

  it("clears the offer takeover anchor via the dedicated clear control", async () => {
    vi.stubEnv("VITE_SHOW_MINI_PILOT_PANEL", "1");

    const setMiniPilotRawResult = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          OfferConversationalWorkbench,
          offerWorkbenchProps({
            setMiniPilotRawResult
          })
        )
      );
    });

    const clearButton = Array.from(document.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Mini-Pilot-Stand leeren")
    ) as HTMLButtonElement | undefined;

    expect(clearButton).toBeDefined();

    await act(async () => {
      clearButton?.click();
    });

    expect(setMiniPilotRawResult).toHaveBeenCalledWith("");
    expect(setMiniPilotRawResult).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("clears the production export anchor via the dedicated clear control", async () => {
    const onClearMiniPilotResult = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(ProductionPlanDownloadCard, {
          selectedPlan: {
            planId: "plan-1",
            eventSpecId: "spec-1",
            readiness: { status: "complete" },
            productionBatches: [],
            kitchenSheets: [],
            recipeSelections: [],
            unresolvedItems: []
          },
          selectedPlanSpec: {
            specId: "spec-1",
            event: { type: "lunch", date: "2026-06-18" },
            attendees: { expected: 40 },
            readiness: { status: "complete" },
            servicePlan: { serviceForm: "buffet" }
          },
          miniPilotActionState: {
            eyebrow: "Mini-Pilot-Status vor Export",
            title: "Produktions-Export ist jetzt fachlich pruefbar",
            statusLabel: "Status: ready",
            reasonLabel: "Grund: Mini-Pilot-Rahmen ist gruen.",
            trustLabel: "Vertrauenslage: frisch lokal gesetzt.",
            provenanceLabel: "Lokal gespeichert · zuletzt aktualisiert 07.06.26, 18:20",
            cautionLabel: undefined,
            helperText: "Draft nur manuell pruefen.",
            commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
          },
          onClearMiniPilotResult
        })
      );
    });

    const clearButton = Array.from(document.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Mini-Pilot-Stand leeren")
    ) as HTMLButtonElement | undefined;

    expect(clearButton).toBeDefined();

    await act(async () => {
      clearButton?.click();
    });

    expect(onClearMiniPilotResult).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("hides the production clear control when no clear action is wired", () => {
    const markup = renderToStaticMarkup(
      createElement(ProductionPlanDownloadCard, {
        selectedPlan: {
          planId: "plan-1",
          eventSpecId: "spec-1",
          readiness: { status: "complete" },
          productionBatches: [],
          kitchenSheets: [],
          recipeSelections: [],
          unresolvedItems: []
        },
        selectedPlanSpec: {
          specId: "spec-1",
          event: { type: "lunch", date: "2026-06-18" },
          attendees: { expected: 40 },
          readiness: { status: "complete" },
          servicePlan: { serviceForm: "buffet" }
        },
        miniPilotActionState: {
          eyebrow: "Mini-Pilot-Status vor Export",
          title: "Export erst nach gruenem Mini-Pilot-Check",
          statusLabel: "Status: noch kein Ergebnis",
          reasonLabel: "Grund: JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.",
          helperText: "Check lokal ausfuehren und dann weiterarbeiten.",
          commandLabel: "npm run llm:synthetic-live:check:mini-pilot"
        }
      })
    );

    expect(markup).not.toContain("Mini-Pilot-Stand leeren");
  });
});
