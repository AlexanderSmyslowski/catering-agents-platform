import { describe, expect, it } from "vitest";
import { buildProductionQuestionPanelActionState } from "../backoffice-ui/src/production-question-panel-action-state.js";

describe("production question panel action state", () => {
  it("keeps focused-spec actions in read/start mode while no focused edit is active", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-2",
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
      primaryActionDisabled: false,
      sourceReviewHelperText: undefined
    });
  });

  it("switches the focused-spec actions into save-and-run mode while editing the current spec", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-1",
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
      primaryActionDisabled: false,
      sourceReviewHelperText: undefined
    });
  });

  it("keeps save actions disabled while submitting or without focused changes", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-1",
        submitting: true,
        hasFocusedSpecEditChanges: true
      }).saveAnswersDisabled
    ).toBe(true);

    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-1",
        submitting: false,
        hasFocusedSpecEditChanges: false
      }).saveAnswersDisabled
    ).toBe(true);
  });

  it("stays inert when no focused spec exists", () => {
    expect(
      buildProductionQuestionPanelActionState({
        editingSpecId: "spec-1",
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
      primaryActionDisabled: false,
      sourceReviewHelperText: undefined
    });
  });

  it("blocks the primary calculation action until unsafe upload sources are confirmed", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        submitting: false,
        hasFocusedSpecEditChanges: false,
        sourceReviewRequired: true,
        sourceReviewConfirmed: false
      })
    ).toMatchObject({
      primaryActionDisabled: true,
      sourceReviewHelperText: "Quellenprüfung bestätigen, bevor Mengen, Rezepte und Einkaufsliste berechnet werden."
    });

    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        submitting: false,
        hasFocusedSpecEditChanges: false,
        sourceReviewRequired: true,
        sourceReviewConfirmed: true
      }).primaryActionDisabled
    ).toBe(false);
  });

  it("blocks calculation from read mode until open production questions are answered", () => {
    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: undefined,
        submitting: false,
        hasFocusedSpecEditChanges: false,
        openQuestionCount: 2
      })
    ).toMatchObject({
      primaryActionLabel: "Berechnung starten",
      primaryActionDisabled: true,
      sourceReviewHelperText: "Rückfragen beantworten, bevor Mengen, Rezepte und Einkaufsliste berechnet werden."
    });

    expect(
      buildProductionQuestionPanelActionState({
        focusedProductionSpec: { specId: "spec-1" },
        editingSpecId: "spec-1",
        submitting: false,
        hasFocusedSpecEditChanges: true,
        openQuestionCount: 2
      })
    ).toMatchObject({
      primaryActionLabel: "Speichern und Berechnung starten",
      primaryActionDisabled: false,
      sourceReviewHelperText: undefined
    });
  });
});
