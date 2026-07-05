import { describe, expect, it } from "vitest";
import { buildProductionQuestionPanelVisibilityState } from "../backoffice-ui/src/production-question-panel-visibility-state.js";

describe("production question panel visibility state", () => {
  it("keeps the analysing fallback message while hiding switch list and detached editor by default", () => {
    expect(
      buildProductionQuestionPanelVisibilityState({
        documentPhase: "analysing",
        productionWorkspaceCleared: false,
        specSwitchItemCount: 1
      })
    ).toEqual({
      emptyStateMessage:
        "Der Agent wertet das hochgeladene Dokument gerade aus und erzeugt daraus operative Veranstaltungsdaten.",
      showSpecSwitch: false,
      showDetachedEditor: false
    });
  });

  it("keeps the cleared workspace fallback and hides the spec switch even if multiple specs exist", () => {
    expect(
      buildProductionQuestionPanelVisibilityState({
        documentPhase: "done",
        productionWorkspaceCleared: true,
        specSwitchItemCount: 3,
        editingSpecId: "spec-other",
        focusedProductionSpecId: "spec-current"
      })
    ).toEqual({
      emptyStateMessage:
        "Der aktuelle Vorgang wurde geleert. Nach einem neuen Upload erscheint hier die Prüfung.",
      showSpecSwitch: false,
      showDetachedEditor: true
    });
  });

  it("shows the spec switch and hides the detached editor when the focused spec is the active editor", () => {
    expect(
      buildProductionQuestionPanelVisibilityState({
        documentPhase: "idle",
        productionWorkspaceCleared: false,
        specSwitchItemCount: 2,
        editingSpecId: "spec-1",
        focusedProductionSpecId: "spec-1"
      })
    ).toEqual({
      emptyStateMessage: "Sobald ein Angebot hochgeladen oder eingegeben wurde, erscheint hier die Prüfung vor der Berechnung.",
      showSpecSwitch: true,
      showDetachedEditor: false
    });
  });
});
