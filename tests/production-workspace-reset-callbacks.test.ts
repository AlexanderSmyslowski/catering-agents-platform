import { describe, expect, it, vi } from "vitest";
import { buildProductionWorkspaceResetCallbacks } from "../backoffice-ui/src/production-workspace-reset-callbacks.js";

describe("production workspace reset callbacks", () => {
  it("builds the App reset callback cluster without changing reset behavior", () => {
    const uploadInputRef = { current: { value: "angebot.pdf" } };
    const calls: string[] = [];
    const callbacks = buildProductionWorkspaceResetCallbacks({
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
      uploadInputRef
    });

    callbacks.clearFocusedProductionSpecId();
    callbacks.clearSelectedPlanId();
    callbacks.resetPlanProgress();
    callbacks.resetIntakeRequestDetail();
    callbacks.resetSpecEdit(false);
    callbacks.clearUploadInput();

    expect(calls).toEqual([
      "setFocusedProductionSpecId:undefined",
      "setSelectedPlanId:undefined",
      "resetPlanProgress",
      "resetIntakeRequestDetail",
      "resetSpecEdit:false"
    ]);
    expect(uploadInputRef.current.value).toBe("");
  });

  it("keeps clearUploadInput safe when no DOM input is mounted", () => {
    const callbacks = buildProductionWorkspaceResetCallbacks({
      setFocusedProductionSpecId: vi.fn(),
      setSelectedPlanId: vi.fn(),
      resetPlanProgress: vi.fn(),
      resetIntakeRequestDetail: vi.fn(),
      resetSpecEdit: vi.fn(),
      uploadInputRef: { current: null }
    });

    expect(() => callbacks.clearUploadInput()).not.toThrow();
  });
});
