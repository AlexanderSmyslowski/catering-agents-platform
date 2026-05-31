import { createElement } from "react";
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

  it("keeps the footer loading and loaded copy unchanged", () => {
    expect(renderFeedback({ loading: true })).toContain("Aktuelle Plattformdaten werden geladen...");
    expect(renderFeedback({ loading: false })).toContain(
      "Aktuelle Daten aus Erfassung, Angebot und Produktion wurden geladen."
    );
  });
});
