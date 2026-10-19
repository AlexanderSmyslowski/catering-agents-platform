import { describe, expect, it } from "vitest";
import { createEventRequestFromText, normalizeEventRequestToSpec } from "@catering/shared-core";
import { recordSpecialDietResponse } from "../shared-core/src/special-diet-response.js";
describe("bounded special diet clarification", () => {
  it("answers only the known extraction question and retains menu, source constraints and independent risks", () => {
    const source = normalizeEventRequestToSpec(createEventRequestFromText({requestId:"special-diet",channel:"text",
      rawText:"100 Gäste am 12.11.2026. 55 Portionen Hähnchen, 25 Portionen Bratlinge, 20 Portionen Linsen. 4 Gäste benötigen glutenfreie Sonderkost und 3 Gäste keine Schalenfrüchte; Gruppen können sich überschneiden."}));
    const independent = {field:"productionConstraints",message:"Lieferantenfreigabe fehlt",severity:"high" as const};
    source.uncertainties = [...source.uncertainties ?? [], independent];
    const original = structuredClone(source);
    const result = recordSpecialDietResponse(source, "SYNTHETISCH: eine Überschneidung; getrennte Portionen; Freigaben offen.", "Test-Koordination");
    expect(source).toEqual(original);
    expect(result.menuPlan).toEqual(original.menuPlan);
    expect(result.uncertainties).toContainEqual(independent);
    expect(result.productionConstraints!.slice(0,-1)).toEqual(source.productionConstraints);
    expect(result.productionConstraints!.at(-1)).toContain("Keine Allergen- oder Küchenfreigabe");
    expect(result.productionConstraints).not.toContain("gluten_free");
    expect(()=>recordSpecialDietResponse(result,"Neue Antwort","Test")).toThrow("keine");
    for(const value of [""," ", "x".repeat(501),null,{answer:"nicht erlaubt"}]) {
      expect(()=>recordSpecialDietResponse(source,value,"Test")).toThrow();
    }
  });
});
