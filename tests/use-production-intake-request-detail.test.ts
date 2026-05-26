// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntakeRequestDetail } from "../backoffice-ui/src/api.js";
import {
  useProductionIntakeRequestDetail,
  type ProductionIntakeRequestDetailLoader
} from "../backoffice-ui/src/use-production-intake-request-detail.js";

type IntakeDetailHookState = ReturnType<typeof useProductionIntakeRequestDetail>;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

function renderIntakeDetailHook(options: {
  currentIntakeRequestId?: string;
  loadDetail: ProductionIntakeRequestDetailLoader;
}) {
  let state: IntakeDetailHookState | undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  function Probe(props: { currentIntakeRequestId?: string }) {
    state = useProductionIntakeRequestDetail({
      currentIntakeRequestId: props.currentIntakeRequestId,
      loadDetail: options.loadDetail
    });
    return null;
  }

  act(() => {
    root.render(createElement(Probe, { currentIntakeRequestId: options.currentIntakeRequestId }));
  });

  return {
    rerender(currentIntakeRequestId?: string) {
      act(() => {
        root.render(createElement(Probe, { currentIntakeRequestId }));
      });
    },
    get state() {
      if (!state) {
        throw new Error("Intake detail hook did not render.");
      }
      return state;
    }
  };
}

describe("useProductionIntakeRequestDetail", () => {
  it("loads detail for the active intake request", async () => {
    const detail: IntakeRequestDetail = {
      requestId: "intake-1",
      rawInputs: [{ kind: "text", content: "Lunch" }]
    };
    const loadDetail = vi.fn<ProductionIntakeRequestDetailLoader>(async () => detail);
    const probe = renderIntakeDetailHook({
      currentIntakeRequestId: "intake-1",
      loadDetail
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadDetail).toHaveBeenCalledWith("intake-1");
    expect(probe.state.intakeRequestDetail).toBe(detail);
    expect(probe.state.intakeRequestDetailError).toBeUndefined();
  });

  it("reports loader errors and clears state when the active request disappears", async () => {
    const loadDetail = vi.fn<ProductionIntakeRequestDetailLoader>(async () => {
      throw new Error("not found");
    });
    const probe = renderIntakeDetailHook({
      currentIntakeRequestId: "intake-missing",
      loadDetail
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(probe.state.intakeRequestDetail).toBeNull();
    expect(probe.state.intakeRequestDetailError).toContain("not found");

    probe.rerender(undefined);

    expect(probe.state.intakeRequestDetail).toBeNull();
    expect(probe.state.intakeRequestDetailError).toBeUndefined();
  });

  it("allows callers to clear stale detail immediately", async () => {
    const detail: IntakeRequestDetail = {
      requestId: "intake-1",
      rawInputs: [{ kind: "text", content: "Lunch" }]
    };
    const probe = renderIntakeDetailHook({
      currentIntakeRequestId: "intake-1",
      loadDetail: async () => detail
    });

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      probe.state.resetIntakeRequestDetail();
    });

    expect(probe.state.intakeRequestDetail).toBeNull();
    expect(probe.state.intakeRequestDetailError).toBeUndefined();
  });
});
