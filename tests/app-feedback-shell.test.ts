import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppFeedbackShell } from "../backoffice-ui/src/app-feedback-shell.js";

function renderFeedback(props: { error?: string; notice?: string; loading?: boolean }): string {
  return renderToStaticMarkup(
    createElement(AppFeedbackShell, {
      loading: props.loading ?? false,
      error: props.error,
      notice: props.notice
    })
  );
}

describe("app feedback shell", () => {
  it("renders error and notice feedback in the existing toast stack", () => {
    const markup = renderFeedback({
      error: "Fehler beim Laden",
      notice: "Gespeichert"
    });

    expect(markup).toContain('class="toast-stack"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('class="error-banner"');
    expect(markup).toContain("Fehler beim Laden");
    expect(markup).toContain('class="notice-banner"');
    expect(markup).toContain("Gespeichert");
  });

  it("omits the toast stack when no feedback message is present", () => {
    const markup = renderFeedback({});

    expect(markup).not.toContain("toast-stack");
    expect(markup).not.toContain("error-banner");
    expect(markup).not.toContain("notice-banner");
  });

  it("keeps the footer loading copy and labels loaded data as context", () => {
    expect(renderFeedback({ loading: true })).toContain("Aktuelle Plattformdaten werden geladen...");
    expect(renderFeedback({ loading: false })).toContain(
      "Bestands- und Demo-Kontext ist geladen; neue Produktionsaufträge startest du oben."
    );
  });

  it("keeps feedback before route content so sticky toasts stay near the top", () => {
    const appSource = readFileSync("backoffice-ui/src/App.tsx", "utf8");

    expect(appSource.indexOf("<RouteMasthead")).toBeGreaterThan(-1);
    expect(appSource.indexOf("<AppFeedbackShell")).toBeGreaterThan(appSource.indexOf("<RouteMasthead"));
    expect(appSource.indexOf("<AppFeedbackShell")).toBeLessThan(appSource.indexOf("<AppRouteContent"));
  });
});
