// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { ProductionQuestionPanel } from "../backoffice-ui/src/production-question-panel.js";
import { buildProductionQuestionEditorState } from "../backoffice-ui/src/production-question-editor-state.js";
import { canEditProductionDraftQuantities, type ProductionDraftEditContext } from "../backoffice-ui/src/production-spec-edit-persist-action.js";
import { useProductionSpecEditor } from "../backoffice-ui/src/use-production-spec-editor.js";

const roots: Array<ReturnType<typeof createRoot>> = [];
afterEach(() => { roots.splice(0).forEach(root => act(() => root.unmount())); document.body.innerHTML = ""; });
const spec = { specId: "quantity-edit-spec", attendees: { expected: 35 }, menuPlan: [{ componentId: "water", label: "Wasser", productionDecision: { mode: "convenience_purchase", purchasedElements: ["Wasser"] } }] };
const canonical: ProductionDraftEditContext = { caseId: "quantity-case", draft: { draftId: "quantity-draft", revision: 2, createdAt: "2026-09-19", status: "pending_review", source: { sourceRef: "offer-handoff:synthetic" }, reviewCards: [], draftArtifacts: { eventSpec: spec } } };
function renderContext(productionDraftContext?: ProductionDraftEditContext) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); roots.push(root);
  let editor: ReturnType<typeof useProductionSpecEditor>;
  function Probe() {
    editor = useProductionSpecEditor({ focusedProductionSpec: spec });
    return createElement(ProductionQuestionPanel, {
      submitting: false,
      questionState: { focusedProductionSpec: spec, focusedSpecReadinessLabel: "offen", currentSpecPurchaseLists: [], productionQuestions: [], productionAssumptions: [], productionConversationProjection: { sessionId: "synthetic", messages: [] }, workbenchSpecFacts: [], intakeRequestDetail: null, filteredSpecs: [], documentPhase: "idle", productionWorkspaceCleared: false },
      questionActions: { openSpecForQuestions: () => {} },
      editorState: buildProductionQuestionEditorState({ ...editor, recipes: [], canEditPurchasedQuantities: canEditProductionDraftQuantities(editor.editingSpecId, productionDraftContext) }),
      editorActions: { ...editor, beginSpecEdit: editor.beginSpecEdit, saveSpecEdit: async () => {}, createPlan: async () => {} }
    });
  }
  act(() => root.render(createElement(Probe)));
  act(() => editor.beginSpecEdit(spec));
  return { container, get editor() { return editor; } };
}
function inputValue(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
it.each([
  ["legacy", undefined],
  ["nonhandoff", { ...canonical, draft: { ...canonical.draft, source: { sourceRef: "intake:synthetic" } } }],
  ["another spec", { ...canonical, draft: { ...canonical.draft, draftArtifacts: { eventSpec: { ...spec, specId: "other-spec" } } } }],
  ["closed revision", { ...canonical, draft: { ...canonical.draft, status: "superseded" as const } }]
] as Array<[string, ProductionDraftEditContext | undefined]>)("does not offer an unsaveable quantity form in %s context", (_name, context) => {
  const { container, editor } = renderContext(context);
  expect(Array.from(container.querySelectorAll("button")).some(button => button.textContent?.includes("Zukaufmengen pro Person festlegen"))).toBe(false);
  expect(container.querySelector('input[aria-label="Wasser Menge pro Person"]')).toBeNull();
  expect(editor.buildCurrentSpecUpdateInput().componentUpdates![0]).not.toHaveProperty("purchasedQuantities");
  expect(container.textContent).toContain("Zugekaufte Bestandteile");
});
it("offers quantity editing only with canonical context and preserves edits through the actual panel/hook tree", () => {
  const probe = renderContext(canonical);
  const start = Array.from(probe.container.querySelectorAll("button")).find(button => button.textContent?.includes("Zukaufmengen pro Person festlegen"));
  expect(start).toBeDefined();
  act(() => start!.click());
  const amount = probe.container.querySelector<HTMLInputElement>('input[aria-label="Wasser Menge pro Person"]')!;
  const unit = probe.container.querySelector<HTMLInputElement>('input[aria-label="Wasser Einheit"]')!;
  act(() => inputValue(amount, "0.5"));
  act(() => inputValue(unit, "l"));
  expect(probe.container.textContent).toContain("17.5 l");
  act(() => probe.editor.updateEditingComponentState("water", { notes: "synthetisch" }));
  expect(probe.editor.buildCurrentSpecUpdateInput().componentUpdates![0]).toMatchObject({ notes: "synthetisch", purchasedQuantities: [{ element: "Wasser", amountPerPerson: 0.5, unit: "l" }] });
});

it("keeps a legacy note edit saveable without adding structured quantities", async () => {
  const { buildProductionSpecEditPersistAction } = await import("../backoffice-ui/src/production-spec-edit-persist-action.js");
  const probe = renderContext();
  act(() => probe.editor.updateEditingComponentState("water", { notes: "legacy note" }));
  const saved = await buildProductionSpecEditPersistAction({ editingSpecId: spec.specId,
    buildCurrentSpecUpdateInput: () => probe.editor.buildCurrentSpecUpdateInput(),
    updateAcceptedSpec: async (id, input) => {
      expect(id).toBe(spec.specId);
      expect(input.componentUpdates![0]).not.toHaveProperty("purchasedQuantities");
      expect(input.componentUpdates![0]!.notes).toBe("legacy note");
      return { acceptedEventSpec: { ...spec, menuPlan: [{ ...spec.menuPlan[0]!, productionDecision: { ...spec.menuPlan[0]!.productionDecision, notes: input.componentUpdates![0]!.notes } }] } };
    },
    setProductionWorkspaceCleared: () => {}, setFocusedProductionSpecId: () => {}, resetSpecEdit: () => {}, refreshDashboard: async () => {}, setNotice: () => {}
  })();
  act(() => probe.editor.beginSpecEdit(saved!));
  expect(probe.editor.editingComponentStates.water!.notes).toBe("legacy note");
  expect(probe.editor.editingComponentStates.water!.purchasedQuantities).toBeUndefined();
});
