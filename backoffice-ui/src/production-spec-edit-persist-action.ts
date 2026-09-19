import {
  completeProductionQuestionEditSuccess,
  type ProductionQuestionEditSuccessActions
} from "./production-question-editor-state.js";
import { buildSpecEditUpdateInput, type SpecEditUpdateInput } from "./production-spec-edit-update.js";
import { specEditSnapshotFromSpec } from "./production-spec-edit-snapshot.js";
import type { ProductionDraft, ProductionDraftClassificationUpdate } from "./api.js";

export type ProductionDraftEditContext = { caseId: string; draft: ProductionDraft };

export function isHandoffDraftContext(context?: ProductionDraftEditContext): boolean {
  return Boolean(context?.draft.source?.sourceRef?.startsWith("offer-handoff:"));
}

export function assertCurrentProductionDraftContext(
  expected: ProductionDraftEditContext,
  readCurrent: (() => ProductionDraftEditContext | undefined) | undefined,
  savedPredecessor?: ProductionDraftEditContext
): void {
  const current = readCurrent?.();
  const matches = (candidate: ProductionDraftEditContext) => Boolean(current &&
    current.caseId === candidate.caseId && current.draft.status === "pending_review" &&
    current.draft.draftId === candidate.draft.draftId && current.draft.revision === candidate.draft.revision &&
    current.draft.draftArtifacts?.eventSpec?.specId === candidate.draft.draftArtifacts?.eventSpec?.specId);
  if (!matches(expected) && !(savedPredecessor && savedPredecessor.caseId === expected.caseId && matches(savedPredecessor))) {
    throw new Error("Der geöffnete Produktionsfall oder die Revision hat sich geändert. Bitte Antworten erneut öffnen.");
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, stableValue(item)]));
  return value;
}

function buildClassificationUpdate(context: ProductionDraftEditContext, update: SpecEditUpdateInput): ProductionDraftClassificationUpdate {
  const { draft, caseId } = context;
  const spec = draft.draftArtifacts?.eventSpec;
  if (!spec || !caseId || !Number.isInteger(draft.revision) || draft.status !== "pending_review") {
    throw new Error("Der Produktionsentwurf ist nicht mehr eindeutig zur Bearbeitung geöffnet. Bitte erneut öffnen.");
  }
  const snapshot = specEditSnapshotFromSpec(spec);
  const baseline = buildSpecEditUpdateInput({ ...snapshot, componentStates: Object.fromEntries(snapshot.components) });
  const withoutCategories = (input: SpecEditUpdateInput) => ({ ...input,
    componentUpdates: input.componentUpdates?.map(({ menuCategory: _category, ...component }) => component)
      .sort((left, right) => left.componentId.localeCompare(right.componentId))
  });
  if (JSON.stringify(stableValue(withoutCategories(update))) !== JSON.stringify(stableValue(withoutCategories(baseline)))) {
    throw new Error("In diesem Handoff können hier nur Klassifikationen gespeichert werden. Andere Änderungen bitte zurücknehmen.");
  }
  const componentClassifications = (update.componentUpdates ?? []).flatMap((component) => {
    const original = baseline.componentUpdates?.find((item) => item.componentId === component.componentId);
    if (component.menuCategory === original?.menuCategory) return [];
    if (!component.menuCategory) throw new Error("Klassifikationen können hier ergänzt oder geändert, aber nicht gelöscht werden.");
    return [{ componentId: component.componentId, menuCategory: component.menuCategory }];
  });
  return { caseId, expectedRevision: draft.revision!, componentClassifications };
}

export type ProductionSpecEditPersistActionInput = ProductionQuestionEditSuccessActions & {
  editingSpecId?: string;
  productionDraftContext?: ProductionDraftEditContext;
  getCurrentProductionDraftContext?: () => ProductionDraftEditContext | undefined;
  reviseProductionDraft?: (draftId: string, input: ProductionDraftClassificationUpdate) => Promise<{ draft: ProductionDraft }>;
  onDraftRevised?: (draft: ProductionDraft) => void;
  updateAcceptedSpec: (
    specId: string,
    input: SpecEditUpdateInput
  ) => Promise<{ acceptedEventSpec: Record<string, unknown> }>;
  buildCurrentSpecUpdateInput: () => SpecEditUpdateInput;
};

export function buildProductionSpecEditPersistAction({
  editingSpecId,
  productionDraftContext,
  getCurrentProductionDraftContext,
  reviseProductionDraft,
  onDraftRevised,
  updateAcceptedSpec,
  buildCurrentSpecUpdateInput,
  setProductionWorkspaceCleared,
  setFocusedProductionSpecId,
  resetSpecEdit,
  refreshDashboard,
  setNotice
}: ProductionSpecEditPersistActionInput) {
  return async function persistCurrentSpecEdit(options?: { quiet?: boolean }) {
    if (!editingSpecId) {
      return undefined;
    }

    const update = buildCurrentSpecUpdateInput();
    let updatedSpec: Record<string, unknown>;
    const canonical = isHandoffDraftContext(productionDraftContext);
    if (canonical) {
      assertCurrentProductionDraftContext(productionDraftContext!, getCurrentProductionDraftContext);
      if (!reviseProductionDraft || productionDraftContext!.draft.draftArtifacts?.eventSpec?.specId !== editingSpecId) {
        throw new Error("Die geöffneten Antworten gehören nicht eindeutig zu diesem Produktionsentwurf.");
      }
      const command = buildClassificationUpdate(productionDraftContext!, update);
      if (command.componentClassifications.length === 0) {
        return productionDraftContext!.draft.draftArtifacts!.eventSpec;
      }
      const response = await reviseProductionDraft(productionDraftContext!.draft.draftId, command);
      if (!response.draft.draftArtifacts?.eventSpec) throw new Error("Die gespeicherte Produktionsrevision enthält keine Eventdaten.");
      const savedContext = { caseId: productionDraftContext!.caseId, draft: response.draft };
      assertCurrentProductionDraftContext(savedContext, getCurrentProductionDraftContext, productionDraftContext);
      updatedSpec = response.draft.draftArtifacts.eventSpec;
      // Refresh before resetting: remaining questions must reopen against the saved revision.
      await refreshDashboard();
      assertCurrentProductionDraftContext(savedContext, getCurrentProductionDraftContext, productionDraftContext);
      onDraftRevised?.(response.draft);
    } else {
      const response = await updateAcceptedSpec(editingSpecId, update);
      updatedSpec = response.acceptedEventSpec;
    }
    await completeProductionQuestionEditSuccess(
      updatedSpec,
      editingSpecId,
      {
        setProductionWorkspaceCleared,
        setFocusedProductionSpecId,
        resetSpecEdit,
        refreshDashboard: canonical ? async () => undefined : refreshDashboard,
        setNotice
      },
      options
    );
    return updatedSpec;
  };
}
