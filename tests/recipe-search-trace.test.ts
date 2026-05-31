import { describe, expect, it } from "vitest";
import { createRecipeSearchTrace } from "../production-service/src/recipe-discovery/recipe-search-trace.js";

describe("recipe search trace", () => {
  it("keeps messages in insertion order up to the default limit", () => {
    const trace = createRecipeSearchTrace();

    for (let index = 0; index < 14; index += 1) {
      trace.push(`trace-${index}`);
    }

    expect(trace.entries).toHaveLength(12);
    expect(trace.entries[0]).toBe("trace-0");
    expect(trace.entries[11]).toBe("trace-11");
  });

  it("supports a smaller explicit limit for focused tests", () => {
    const trace = createRecipeSearchTrace(2);

    trace.push("Interne Kandidaten: keine Treffer.");
    trace.push("Websuche: tomatensuppe rezept");
    trace.push("Verworfen: falsches Format");

    expect(trace.entries).toEqual([
      "Interne Kandidaten: keine Treffer.",
      "Websuche: tomatensuppe rezept"
    ]);
  });
});
