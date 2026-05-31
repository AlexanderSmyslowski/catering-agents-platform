import { describe, expect, it, vi } from "vitest";
import {
  buildAppSeedDemoAction,
  type AppSeedDemoActionInput
} from "../backoffice-ui/src/app-seed-demo-action.js";

function input(overrides: Partial<AppSeedDemoActionInput> = {}): AppSeedDemoActionInput {
  return {
    seedDemoData: vi.fn(async () => ({})),
    setSubmitting: vi.fn(),
    clearMessages: vi.fn(),
    refreshDashboard: vi.fn(async () => undefined),
    setNotice: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("app seed demo action", () => {
  it("seeds demo data and refreshes dashboard state", async () => {
    const calls: string[] = [];
    const actionInput = input({
      setSubmitting: vi.fn((submitting) => {
        calls.push(`setSubmitting:${submitting}`);
      }),
      clearMessages: vi.fn(() => {
        calls.push("clearMessages");
      }),
      seedDemoData: vi.fn(async () => {
        calls.push("seedDemoData");
        return {};
      }),
      refreshDashboard: vi.fn(async () => {
        calls.push("refreshDashboard");
      }),
      setNotice: vi.fn((message) => {
        calls.push(`setNotice:${message}`);
      })
    });
    const seedDemo = buildAppSeedDemoAction(actionInput);

    await seedDemo();

    expect(actionInput.setError).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "setSubmitting:true",
      "clearMessages",
      "seedDemoData",
      "refreshDashboard",
      "setNotice:Demo-Daten wurden geladen.",
      "setSubmitting:false"
    ]);
  });

  it("surfaces seed failures and always exits submitting state", async () => {
    const actionInput = input({
      seedDemoData: vi.fn(async () => {
        throw new Error("Seed fehlgeschlagen");
      })
    });
    const seedDemo = buildAppSeedDemoAction(actionInput);

    await seedDemo();

    expect(actionInput.refreshDashboard).not.toHaveBeenCalled();
    expect(actionInput.setNotice).not.toHaveBeenCalled();
    expect(actionInput.setError).toHaveBeenCalledWith("Seed fehlgeschlagen");
    expect(actionInput.setSubmitting).toHaveBeenLastCalledWith(false);
  });
});
