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

  it("shows an optional storage hint when a carried-over local result is present", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(MiniPilotCheckPanel as never, {
          rawResult:
            '{"ok":true,"errors":[],"summary":{"status":"ready","reason":"mini_pilot_ready","nextStep":"Draft nur manuell pruefen."}}',
          onRawResultChange: () => undefined,
          reportState: {
            statusLabel: "ready",
            reasonLabel: "Mini-Pilot-Rahmen ist gruen.",
            nextStepLabel: "Draft nur manuell pruefen.",
            commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
            errorLabels: []
          },
          storageHintLabel: "Lokaler Stand übernommen · zuletzt aktualisiert 07.06.26, 18:20"
        })
      );
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Lokaler Stand übernommen · zuletzt aktualisiert 07.06.26, 18:20");
    expect(text).toContain("Übernommener lokaler Stand: bei Unsicherheit den Check lokal noch einmal frisch ausführen.");

    await act(async () => {
      root.unmount();
    });
  });

  it("strengthens the warning when the carried-over result is already stale", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(MiniPilotCheckPanel as never, {
          rawResult:
            '{"ok":true,"errors":[],"summary":{"status":"ready","reason":"mini_pilot_ready","nextStep":"Draft nur manuell pruefen."}}',
          onRawResultChange: () => undefined,
          reportState: {
            statusLabel: "ready",
            reasonLabel: "Mini-Pilot-Rahmen ist gruen.",
            nextStepLabel: "Draft nur manuell pruefen.",
            commandLabel: "npm run llm:synthetic-live:check:mini-pilot",
            errorLabels: []
          },
          storageHintLabel:
            "Lokaler Stand übernommen · zuletzt aktualisiert 07.06.26, 18:20 · älter als 30 Minuten"
        })
      );
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("älter als 30 Minuten");
    expect(text).toContain(
      "Übernommener lokaler Stand ist älter als 30 Minuten: den Check besser noch einmal frisch ausführen."
    );

    await act(async () => {
      root.unmount();
    });
  });
});
