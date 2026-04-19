import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  mergeReadiness,
  normalizeEventRequestToSpec,
  type EventRequest,
  type Readiness
} from "@catering/shared-core";

function baseRequest(text: string): EventRequest {
  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: "shared-core-conflict-1",
    source: {
      channel: "text",
      receivedAt: "2026-03-10T10:00:00.000Z"
    },
    rawInputs: [
      {
        kind: "text",
        content: text
      }
    ]
  };
}

describe("shared core conflict handling", () => {
  it("keeps blocking readiness decisions ahead of softer follow-up issues", () => {
    const current: Readiness = {
      status: "complete",
      reasons: ["Alle Basisangaben sind vorhanden."]
    };

    const merged = mergeReadiness(current, ["Nachgelagerte Warnung."], ["Harte Sperre aus der Planungsregel."]);

    expect(merged.status).toBe("insufficient");
    expect(merged.reasons).toEqual([
      "Alle Basisangaben sind vorhanden.",
      "Nachgelagerte Warnung.",
      "Harte Sperre aus der Planungsregel."
    ]);
  });

  it("merges extracted and explicit production constraints instead of overwriting them", () => {
    const spec = normalizeEventRequestToSpec({
      ...baseRequest("Lunch am 2026-05-12 fuer 40 Teilnehmer. Bitte glutenfrei.") ,
      constraints: ["vegetarian"]
    });

    expect(spec.productionConstraints).toEqual(["vegetarian", "gluten_free"]);
  });
});
