// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MiniPilotCheckPanel } from "../backoffice-ui/src/mini-pilot-check-panel.js";

function setNativeValue(element: HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("MiniPilotCheckPanel", () => {
  it("updates the visible summary when a local mini-pilot result is pasted", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(MiniPilotCheckPanel));
    });

    const textarea = document.querySelector('textarea[aria-label="Mini-Pilot-Check JSON"]') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await act(async () => {
      setNativeValue(
        textarea!,
        JSON.stringify({
          ok: true,
          errors: [],
          summary: {
            status: "ready",
            reason: "mini_pilot_ready",
            nextStep: "Draft nur manuell pruefen."
          },
          preflight: {
            preferredMiniPilotCommand: "npm run llm:synthetic-live:check:mini-pilot"
          }
        })
      );
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Status: ready");
    expect(text).toContain("Grund: Mini-Pilot-Rahmen ist gruen.");
    expect(text).toContain("Naechster Schritt: Draft nur manuell pruefen.");

    await act(async () => {
      root.unmount();
    });
  });

  it("clears the pasted result and falls back to the waiting state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(MiniPilotCheckPanel));
    });

    const textarea = document.querySelector('textarea[aria-label="Mini-Pilot-Check JSON"]') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await act(async () => {
      setNativeValue(
        textarea!,
        JSON.stringify({
          ok: true,
          errors: [],
          summary: {
            status: "ready",
            reason: "mini_pilot_ready",
            nextStep: "Draft nur manuell pruefen."
          },
          preflight: {
            preferredMiniPilotCommand: "npm run llm:synthetic-live:check:mini-pilot"
          }
        })
      );
    });

    const clearButton = Array.from(document.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Ergebnis leeren")
    ) as HTMLButtonElement | undefined;
    expect(clearButton).toBeDefined();

    await act(async () => {
      clearButton?.click();
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Status: noch kein Ergebnis");
    expect(text).toContain("Grund: JSON-Ausgabe aus dem lokalen Mini-Pilot-Check fehlt noch.");
    expect(document.body.textContent ?? "").not.toContain("Status: ready");

    await act(async () => {
      root.unmount();
    });
  });
});
