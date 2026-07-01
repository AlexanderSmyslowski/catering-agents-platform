import { describe, expect, it } from "vitest";
import {
  buildProductionObjectsActions,
  buildProductionQuestionActions,
  buildProductionQuestionEditorActions,
  buildProductionRecipeActions,
  type ProductionObjectsActionsInput,
  type ProductionQuestionActionsInput,
  type ProductionQuestionEditorActionsInput,
  type ProductionRecipeActionsInput
} from "../backoffice-ui/src/production-route-actions.js";

describe("production route actions", () => {
  it("maps question action references without wrapping callbacks", () => {
    const actions: ProductionQuestionActionsInput = {
      openSpecForQuestions: (_specId) => undefined
    };

    expect(buildProductionQuestionActions(actions)).toEqual(actions);
  });

  it("maps question editor action references without wrapping callbacks", () => {
    const actions: ProductionQuestionEditorActionsInput = {
      setEditingEventType: (_value) => undefined,
      setEditingEventDate: (_value) => undefined,
      setEditingEventSchedule: (_value) => undefined,
      setEditingAttendeeCount: (_value) => undefined,
      setEditingServiceForm: (_value) => undefined,
      setEditingMenuItems: (_value) => undefined,
      updateEditingComponentState: (_componentId, _patch) => undefined,
      beginSpecEdit: (_spec) => undefined,
      saveSpecEdit: async () => undefined,
      createPlan: async (_spec) => undefined,
      resetSpecEdit: (_markDismissed) => undefined
    };

    expect(buildProductionQuestionEditorActions(actions)).toEqual(actions);
  });

  it("maps production object action references without wrapping callbacks", () => {
    const actions: ProductionObjectsActionsInput = {
      setSelectedPlanId: (_planId) => undefined
    };

    expect(buildProductionObjectsActions(actions)).toEqual(actions);
  });

  it("maps recipe action references without wrapping callbacks", () => {
    const actions: ProductionRecipeActionsInput = {
      setRecipeName: (_value) => undefined,
      setRecipeFile: (_file) => undefined,
      uploadRecipe: async (_target) => undefined,
      reviewRecipe: async (_target, _recipeId, _decision) => undefined
    };

    expect(buildProductionRecipeActions(actions)).toEqual(actions);
  });
});
