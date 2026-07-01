import { describe, expect, it, vi } from "vitest";
import {
  buildProductionWorkspaceAppBoundary,
  type ProductionWorkspaceAppBoundaryInput
} from "../backoffice-ui/src/production-workspace-app-boundary.js";

function input(
  overrides: Partial<ProductionWorkspaceAppBoundaryInput> = {}
): ProductionWorkspaceAppBoundaryInput {
  return {
    hasFocusedProductionSpec: false,
    hasSelectedPlan: false,
    hasIntakeFile: false,
    hasActiveDocumentName: false,
    documentPhase: "idle",
    planPhase: "idle",
    hasFocusedProductionSpecId: false,
    hasSelectedPlanId: false,
    productionWorkspaceCleared: false,
    archiveIntakeRequest: vi.fn(async () => undefined),
    setSubmitting: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setError: vi.fn(),
    setNotice: vi.fn(),
    setProductionWorkspaceCleared: vi.fn(),
    resetIntakeDraft: vi.fn(),
    resetDocumentProgress: vi.fn(),
    setFocusedProductionSpecId: vi.fn(),
    setSelectedPlanId: vi.fn(),
    resetPlanProgress: vi.fn(),
    resetIntakeRequestDetail: vi.fn(),
    resetSpecEdit: vi.fn(),
    uploadInputRef: { current: null },
    ...overrides
  };
}

describe("production workspace app boundary", () => {
  it("exposes reset callbacks and workspace controls from one App boundary", () => {
    const calls: string[] = [];
    const uploadInputRef = { current: { value: "wrong-upload.pdf" } };
    const boundary = buildProductionWorkspaceAppBoundary(
      input({
        hasSelectedPlan: true,
        hasFocusedProductionSpecId: true,
        hasSelectedPlanId: true,
        uploadInputRef,
        setFocusedProductionSpecId: vi.fn((specId) => {
          calls.push(`setFocusedProductionSpecId:${String(specId)}`);
        }),
        setSelectedPlanId: vi.fn((planId) => {
          calls.push(`setSelectedPlanId:${String(planId)}`);
        }),
        resetPlanProgress: vi.fn(() => {
          calls.push("resetPlanProgress");
        }),
        resetIntakeRequestDetail: vi.fn(() => {
          calls.push("resetIntakeRequestDetail");
        }),
        resetSpecEdit: vi.fn((markDismissed) => {
          calls.push(`resetSpecEdit:${markDismissed}`);
        }),
        setProductionWorkspaceCleared: vi.fn((cleared) => {
          calls.push(`setProductionWorkspaceCleared:${cleared}`);
        }),
        setNotice: vi.fn((message) => {
          calls.push(`setNotice:${String(message)}`);
        })
      })
    );

    boundary.productionWorkspaceResetCallbacks.clearFocusedProductionSpecId();
    boundary.productionWorkspaceResetCallbacks.clearSelectedPlanId();
    boundary.productionWorkspaceResetCallbacks.resetPlanProgress();
    boundary.productionWorkspaceResetCallbacks.resetIntakeRequestDetail();
    boundary.productionWorkspaceResetCallbacks.resetSpecEdit(false);
    boundary.productionWorkspaceControls.clearProductionWorkspace();

    expect(boundary.productionWorkspaceControls.canClearProductionWorkspace).toBe(true);
    expect(calls).toEqual([
      "setFocusedProductionSpecId:undefined",
      "setSelectedPlanId:undefined",
      "resetPlanProgress",
      "resetIntakeRequestDetail",
      "resetSpecEdit:false",
      "setProductionWorkspaceCleared:true",
      "setFocusedProductionSpecId:undefined",
      "setSelectedPlanId:undefined",
      "resetPlanProgress",
      "resetIntakeRequestDetail",
      "resetSpecEdit:false",
      "setNotice:undefined",
      "setNotice:Aktueller Upload wurde lokal verworfen. Rückfragen und Ergebnisse wurden aus dem Fokus geleert."
    ]);
    expect(uploadInputRef.current.value).toBe("");
  });

  it("keeps soft-archive behavior wired through the existing workspace controls", async () => {
    const calls: string[] = [];
    const boundary = buildProductionWorkspaceAppBoundary(
      input({
        currentIntakeRequestId: "request-wrong-upload-2",
        archiveIntakeRequest: vi.fn(async (requestId, reasonCode) => {
          calls.push(`archiveIntakeRequest:${requestId}:${reasonCode}`);
        }),
        resetIntakeDraft: vi.fn(() => {
          calls.push("resetIntakeDraft");
        }),
        refreshDashboard: vi.fn(async () => {
          calls.push("refreshDashboard");
        }),
        setNotice: vi.fn((message) => {
          calls.push(`setNotice:${String(message)}`);
        })
      })
    );

    await boundary.productionWorkspaceControls.handleArchiveCurrentIntake();

    expect(boundary.productionWorkspaceControls.canArchiveCurrentIntake).toBe(true);
    expect(calls).toEqual([
      "setNotice:undefined",
      "archiveIntakeRequest:request-wrong-upload-2:wrong_upload",
      "resetIntakeDraft",
      "refreshDashboard",
      "setNotice:Fehlupload wurde per Soft-Archiv aus dem aktiven Arbeitsfokus genommen."
    ]);
  });
});
