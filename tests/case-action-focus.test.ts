// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { focusCaseAction } from "../backoffice-ui/src/case-action-focus.js";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

it("reveals the production stage before focusing its newly rendered control", () => {
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1; });
  const reveal = vi.fn((event: Event) => {
    expect((event as CustomEvent).detail.selector).toBe("#target");
    document.body.innerHTML = '<details><button id="target">Öffnen</button></details>';
  });
  window.addEventListener("production:reveal", reveal, { once: true });
  focusCaseAction("production", "#target");
  expect(reveal).toHaveBeenCalledOnce();
  expect(document.activeElement?.id).not.toBe("target");
  frame!(0);
  expect(document.activeElement?.id).toBe("target");
  expect(document.querySelector("details")?.open).toBe(true);
});

it("focuses offers immediately without a production event", () => {
  document.body.innerHTML = '<button id="target">Öffnen</button>';
  const reveal = vi.fn();
  window.addEventListener("production:reveal", reveal, { once: true });
  focusCaseAction("offer", "#target");
  expect(document.activeElement?.id).toBe("target");
  expect(reveal).not.toHaveBeenCalled();
  window.removeEventListener("production:reveal", reveal);
});
