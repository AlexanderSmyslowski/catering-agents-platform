import { describe, expect, it } from "vitest";
import { getSpecLabel } from "../backoffice-ui/src/production-language.js";

describe("production language helpers", () => {
  it("builds German labels for specs with lunch events", () => {
    const label = getSpecLabel({
      event: {
        type: "lunch",
        date: "2026-03-04"
      },
      attendees: {
        expected: 120
      }
    });

    expect(label).toBe("Lunch · 120 Teilnehmer · 2026-03-04");
  });
});
