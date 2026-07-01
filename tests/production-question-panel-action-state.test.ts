import { describe, expect, it } from "vitest";
import { buildProductionQuestionPanelActionState } from "../backoffice-ui/src/production-question-panel-action-state.js";

describe("production question panel action state", () => {
  it("keeps focused-spec actions in read/start mode while no focused edit is active", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-2",
        questionCount: 0,
        submitting: false,
        hasFocusedSpecEditChanges: false
      })
    ).toEqual({
      focusedSpecId: "spec-1",
      isFocusedSpecEditing: false,
      editAnswersDisabled: false,
      showSaveAnswersButton: false,
      saveAnswersDisabled: true,
      primaryActionLabel: "Berechnung starten",
      primaryActionDisabled: false
    });
  });

  it("blocks direct calculation while open questions are still visible", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: undefined,
        questionCount: 2,
        submitting: false,
        hasFocusedSpecEditChanges: false
      })
    ).toEqual({
      focusedSpecId: "spec-1",
      isFocusedSpecEditing: false,
      editAnswersDisabled: false,
      showSaveAnswersButton: false,
      saveAnswersDisabled: true,
      primaryActionLabel: "Rückfragen zuerst beantworten",
      primaryActionDisabled: true,
      primaryActionHint: "Bitte offene Rückfragen beantworten, bevor die Berechnung gestartet wird."
    });
  });

  it("switches the focused-spec actions into save-and-run mode while editing the current spec", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-1",
        questionCount: 2,
        submitting: false,
        hasFocusedSpecEditChanges: true
      })
    ).toEqual({
      focusedSpecId: "spec-1",
      isFocusedSpecEditing: true,
      editAnswersDisabled: true,
      showSaveAnswersButton: true,
      saveAnswersDisabled: false,
      primaryActionLabel: "Speichern und Berechnung starten",
      primaryActionDisabled: false
    });
  });

  it("keeps save actions disabled while submitting or without focused changes", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-1",
        questionCount: 0,
        submitting: true,
        hasFocusedSpecEditChanges: true
      }).saveAnswersDisabled
    ).toBe(true);

    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-1",
        questionCount: 0,
        submitting: false,
        hasFocusedSpecEditChanges: false
      }).saveAnswersDisabled
    ).toBe(true);
  });

  it("stays inert when no focused spec exists", () => {
    expect(
      buildProductionQuestionPanelActionState({
        editingSpecId: "spec-1",
        questionCount: 0,
        submitting: false,
        hasFocusedSpecEditChanges: true
      })
    ).toEqual({
      focusedSpecId: undefined,
      isFocusedSpecEditing: false,
      editAnswersDisabled: false,
      showSaveAnswersButton: false,
      saveAnswersDisabled: false,
      primaryActionLabel: "Berechnung starten",
      primaryActionDisabled: false
    });
  });
});
