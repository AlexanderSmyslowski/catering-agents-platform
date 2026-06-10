// @vitest-environment jsdom
import { act, createElement, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMiniPilotCheckReportState } from "../backoffice-ui/src/mini-pilot-check-report-state.js";
import { OfferConversationalWorkbench } from "../backoffice-ui/src/offer-workbench.js";
import { ProductionRouteMainLayout } from "../backoffice-ui/src/production-route-main-layout.js";

function setNativeValue(element: HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function MiniPilotFlowHarness() {
  const [route, setRoute] = useState<"offer" | "production">("offer");
  const [miniPilotRawResult, setMiniPilotRawResult] = useState("");
  const miniPilotReportState = useMemo(() => buildMiniPilotCheckReportState(miniPilotRawResult), [miniPilotRawResult]);

  return (
    <div>
      <button type="button" onClick={() => setRoute("offer")}>
        show offer
      </button>
      <button type="button" onClick={() => setRoute("production")}>
        show production
      </button>
      {route === "offer" ? (
        <OfferConversationalWorkbench
          submitting={false}
          latestSourceLabel="request-1"
          offerText="Lunch fuer 35 Personen."
          setOfferText={() => undefined}
          submitOfferText={async () => undefined}
          intakeText=""
          setIntakeText={() => undefined}
          submitIntakeText={async () => undefined}
          intakeChannel="pdf_upload"
          setIntakeChannel={() => undefined}
          intakeFile={null}
          setIntakeFile={() => undefined}
          submitIntakeDocument={async () => undefined}
          manualInput={{
            eventType: "",
            eventDate: "",
            attendeeCount: "",
            serviceForm: "",
            menuItems: "",
            customerName: "",
            venueName: "",
            notes: ""
          }}
          manualActions={{
            setEventType: () => undefined,
            setEventDate: () => undefined,
            setAttendeeCount: () => undefined,
            setServiceForm: () => undefined,
            setMenuItems: () => undefined,
            setCustomerName: () => undefined,
            setVenueName: () => undefined,
            setNotes: () => undefined,
            submitManualSpec: async () => undefined
          }}
          filteredOfferDrafts={[
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
          ]}
          activeDraft={{
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
          }}
          selectedDraft={undefined}
          setSelectedDraftId={() => undefined}
          promoteDraft={async () => undefined}
          filteredSpecs={[]}
          activeSpec={{ specId: "spec-1", readiness: { status: "complete" } }}
          completeSpecCount={1}
          partialSpecCount={0}
          miniPilotRawResult={miniPilotRawResult}
          setMiniPilotRawResult={setMiniPilotRawResult}
          miniPilotReportState={miniPilotReportState}
          specEdit={{
            editingSpecId: undefined,
            eventType: "",
            eventDate: "",
            attendeeCount: "",
            serviceForm: "",
            menuItems: ""
          }}
          specEditActions={{
            beginSpecEdit: () => undefined,
            setEventType: () => undefined,
            setEventDate: () => undefined,
            setAttendeeCount: () => undefined,
            setServiceForm: () => undefined,
            setMenuItems: () => undefined,
            saveSpecEdit: async () => undefined,
            resetSpecEdit: () => undefined
          }}
        />
      ) : (
        <ProductionRouteMainLayout
          workbenchSummary={{
            activeSpecLabel: "Lunch",
            readinessLabel: "vollständig",
            planStatusLabel: "vollständig",
            purchaseStatusLabel: "1 Liste",
            questionCount: 0,
            answeredQuestionCount: 0,
            unansweredQuestionCount: 0,
            productionObjectCount: 1,
            productionObjectStatusLabel: "1 Plan(e) · vollständig",
            purchaseListCount: 1
          }}
          workbenchNextStep={{
            title: "Produktionsarbeit prüfen",
            description: "Plan, Einkaufsliste und Exporte prüfen."
          }}
          submitting={false}
          sourceInput={{
            dragActive: false,
            intakeFile: null,
            intakeChannel: "pdf_upload",
            documentPhase: "idle",
            documentProgress: 0,
            intakeText: "",
            canClearWorkspace: false,
            canArchiveCurrentIntake: false,
            clearWorkspaceTitle: "Kein aktiver Produktionsarbeitsbereich zum lokalen Leeren.",
            archiveCurrentIntakeTitle: "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv."
          }}
          sourceInputActions={{
            uploadInputRef: { current: null },
            setDragActive: () => undefined,
            setIntakeChannel: () => undefined,
            setIntakeText: () => undefined,
            openFilePicker: () => undefined,
            clearWorkspace: () => undefined,
            archiveCurrentIntake: async () => undefined,
            handleDrop: () => undefined,
            handleFileSelection: () => undefined,
            submitDocument: async () => undefined,
            submitText: async () => undefined
          }}
          manualInput={{
            eventType: "",
            eventDate: "",
            attendeeCount: "",
            serviceForm: "",
            menuItems: "",
            customerName: "",
            venueName: "",
            notes: ""
          }}
          manualInputActions={{
            setEventType: () => undefined,
            setEventDate: () => undefined,
            setAttendeeCount: () => undefined,
            setServiceForm: () => undefined,
            setMenuItems: () => undefined,
            setCustomerName: () => undefined,
            setVenueName: () => undefined,
            setNotes: () => undefined,
            submitManualSpec: async () => undefined
          }}
          questionState={{
            focusedSpecReadinessLabel: "vollständig",
            currentSpecPurchaseLists: [],
            productionQuestions: [],
            productionAssumptions: [],
            productionConversationProjection: { sessionId: "session-1", messages: [] },
            workbenchSpecFacts: [],
            intakeRequestDetail: null,
            filteredSpecs: [],
            documentPhase: "idle",
            productionWorkspaceCleared: false
          }}
          questionActions={{ openSpecForQuestions: () => undefined }}
          editorState={{
            editingEventType: "",
            editingEventDate: "",
            editingAttendeeCount: "",
            editingServiceForm: "",
            editingMenuItems: "",
            editingComponentStates: {},
            hasFocusedSpecEditChanges: false,
            recipes: []
          }}
          editorActions={{
            setEditingEventType: () => undefined,
            setEditingEventDate: () => undefined,
            setEditingAttendeeCount: () => undefined,
            setEditingServiceForm: () => undefined,
            setEditingMenuItems: () => undefined,
            updateEditingComponentState: () => undefined,
            beginSpecEdit: () => undefined,
            saveSpecEdit: async () => undefined,
            createPlan: async () => undefined,
            resetSpecEdit: () => undefined
          }}
          objectPanelProgress={{ planPhase: "idle", planProgress: 0 }}
          objectPanelState={{
            focusedProductionSpec: undefined,
            productionWorkspaceCleared: false,
            currentSpecPlans: [
              {
                planId: "plan-1",
                eventSpecId: "spec-1",
                readiness: { status: "complete" },
                unresolvedItems: [],
                kitchenSheets: [{ title: "Küchenblatt" }],
                productionBatches: [{ batchId: "batch-1", title: "Rezeptblatt" }],
                recipeSelections: [{ componentId: "soup-1" }]
              }
            ],
            selectedPlan: {
              planId: "plan-1",
              eventSpecId: "spec-1",
              readiness: { status: "complete" },
              unresolvedItems: [],
              kitchenSheets: [{ title: "Küchenblatt" }],
              productionBatches: [{ batchId: "batch-1", title: "Rezeptblatt" }],
              recipeSelections: [{ componentId: "soup-1" }]
            },
            selectedPlanSpec: {
              specId: "spec-1",
              event: { type: "lunch" },
              readiness: { status: "complete" },
              servicePlan: { serviceForm: "buffet" }
            },
            selectedPlanComponentsById: new Map<string, Record<string, unknown>>(),
            archivedPlans: [],
            specById: new Map<string, Record<string, unknown>>()
          }}
          objectPanelActions={{ setSelectedPlanId: () => undefined }}
          purchaseListState={{
            currentPurchaseLists: [],
            archivedPurchaseLists: [],
            specById: new Map<string, Record<string, unknown>>(),
            statusLabel: "noch keine Liste"
          }}
          handoffState={{
            intakeOriginLabel: "kein Intake-Ursprung verknüpft",
            auditTrailLabel: "keine Audit-Ereignisse geladen",
            exportLabel: "Produktionsblatt offen · Einkaufsliste offen"
          }}
          recipeStatus={{
            recipeReviewStatusLabel: "keine Rezepte",
            recipeUsageStatusLabel: "keine Rezeptprüfung offen",
            recipeReviewCounts: { approved: 0, reviewRequired: 0, rejected: 0 },
            recipeCount: 0
          }}
          recipeUpload={{ recipeName: "", recipeFile: null }}
          recipeLibrary={{ filteredRecipes: [] }}
          recipeActions={{
            setRecipeName: () => undefined,
            setRecipeFile: () => undefined,
            uploadRecipe: async () => undefined,
            reviewRecipe: async () => undefined
          }}
          miniPilotRawResult={miniPilotRawResult}
          setMiniPilotRawResult={setMiniPilotRawResult}
          miniPilotReportState={miniPilotReportState}
        />
      )}
    </div>
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  document.body.innerHTML = "";
});

describe("shared mini pilot workbench flow", () => {
  it("hides the mini-pilot editor panel by default in workbench routes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(MiniPilotFlowHarness));
    });

    expect(document.querySelector('textarea[aria-label="Mini-Pilot-Check JSON"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps one ready mini-pilot result across offer and production views", async () => {
    vi.stubEnv("VITE_SHOW_MINI_PILOT_PANEL", "1");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(MiniPilotFlowHarness));
    });

    const textarea = document.querySelector('textarea[aria-label="Mini-Pilot-Check JSON"]') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await act(async () => {
      setNativeValue(
        textarea!,
        JSON.stringify({
          ok: true,
          errors: [],
          summary: {
            status: "ready",
            reason: "mini_pilot_ready",
            nextStep: "Export nur manuell pruefen."
          },
          preflight: {
            preferredMiniPilotCommand: "npm run llm:synthetic-live:check:mini-pilot"
          }
        })
      );
    });

    const showProduction = Array.from(document.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("show production")
    ) as HTMLButtonElement | undefined;
    expect(showProduction).toBeDefined();

    await act(async () => {
      showProduction?.click();
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Produktions-Export ist jetzt fachlich pruefbar");
    expect(text).toContain("Status: ready");
    expect(text).toContain("Export nur manuell pruefen.");

    await act(async () => {
      root.unmount();
    });
  });
});
