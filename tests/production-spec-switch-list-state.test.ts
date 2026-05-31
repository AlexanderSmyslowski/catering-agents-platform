import { describe, expect, it } from "vitest";
import { buildProductionSpecSwitchItems } from "../backoffice-ui/src/production-spec-switch-list-state.js";

describe("production spec switch list state", () => {
  it("keeps switch specs selectable while adding deterministic readiness context", () => {
    const completeSpec = {
      specId: "spec-complete",
      event: { type: "conference", date: "2026-09-18" },
      attendees: { expected: 120 },
      readiness: { status: "complete" }
    };
    const partialSpec = {
      specId: "spec-demo-production-answered-clarification",
      event: { type: "lunch", date: "2026-12-16" },
      attendees: { expected: 42 },
      readiness: { status: "partial" }
    };

    const items = buildProductionSpecSwitchItems([completeSpec, partialSpec]);

    expect(items).toEqual([
      {
        spec: completeSpec,
        specId: "spec-complete",
        label: "Konferenz · 120 Teilnehmer · 2026-09-18",
        readinessLabel: "Klarheit: vollständig"
      },
      {
        spec: partialSpec,
        specId: "spec-demo-production-answered-clarification",
        label: "Lunch · 42 Teilnehmer · 2026-12-16",
        readinessLabel: "Klarheit: teilweise vollständig"
      }
    ]);
  });

  it("keeps unknown readiness explicit without inventing state", () => {
    const [item] = buildProductionSpecSwitchItems([
      {
        specId: "spec-open",
        event: { type: "meeting" },
        attendees: {}
      }
    ]);

    expect(item).toMatchObject({
      specId: "spec-open",
      label: "Besprechung · ? Teilnehmer · offen",
      readinessLabel: "Klarheit: -"
    });
  });
});
