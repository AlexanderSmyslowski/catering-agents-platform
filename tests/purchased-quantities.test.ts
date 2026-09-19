import { describe, expect, it } from "vitest";
import { createEventRequestFromText, normalizeEventRequestToSpec, validateAcceptedEventSpec, type AcceptedEventSpec } from "@catering/shared-core";
import { procurementItemsForComponent } from "../production-service/src/rules/procurement-rules.js";
import { normalizedSpecEditSnapshot, specEditSnapshotFromSpec } from "../backoffice-ui/src/production-spec-edit-snapshot.js";
import { buildSpecEditUpdateInput } from "../backoffice-ui/src/production-spec-edit-update.js";

const quantities = [{ element: "Croissants", amountPerPerson: 1, unit: "Stück" }, { element: "Wasser", amountPerPerson: 0.5, unit: "l" }];
function specWith(purchasedQuantities: unknown = quantities, purchasedElements = ["Croissants", "Wasser"]): AcceptedEventSpec {
  const spec = normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "synthetic-quantities", channel: "text", rawText: "Kaffeepause am 2026-09-22 für 35 Personen mit Croissants." }));
  return { ...spec, menuPlan: [{ componentId: "pause", label: "Kaffeepause", servings: 35, menuCategory: "vegetarian", recipeOverrideId: "unchanged", productionDecision: { mode: "convenience_purchase", purchasedElements, notes: "Unverändert", ...(purchasedQuantities === undefined ? {} : { purchasedQuantities }) } }] } as AcceptedEventSpec;
}

describe("structured purchased quantities", () => {
  it("accepts complete per-person decisions and retains legacy omission", () => {
    expect(validateAcceptedEventSpec(specWith())).toEqual(specWith());
    const legacy = specWith();
    delete (legacy.menuPlan[0]!.productionDecision as any).purchasedQuantities;
    expect(() => validateAcceptedEventSpec(legacy)).not.toThrow();
    expect(procurementItemsForComponent(legacy.menuPlan[0]!, 35)[1]).toMatchObject({ purchaseQty: 35, purchaseUnit: "portion" });
  });
  it.each([
    ["missing element", [quantities[0]]], ["extra element", [...quantities, { element: "Tee", amountPerPerson: 1, unit: "l" }]],
    ["duplicate element", [quantities[0], quantities[0]]], ["empty", []], ["null", null], ["object", {}],
    ...[0, -1, Infinity, NaN, "1", [1], {}, null].map(amountPerPerson => ["invalid amount " + String(amountPerPerson), [{ ...quantities[0], amountPerPerson }, quantities[1]]]),
    ...["", " ", "x".repeat(101), [], {}].map(unit => ["invalid unit " + String(unit), [{ ...quantities[0], unit }, quantities[1]]]),
    ["extra key", [{ ...quantities[0], price: 2 }, quantities[1]]],
    ["array element", [{ ...quantities[0], element: ["Croissants"] }, quantities[1]]],
    ["long name", [{ ...quantities[0], element: "x".repeat(501) }, quantities[1]]]
  ] as Array<[string, unknown]>)("rejects %s", (_name, value) => {
    expect(() => validateAcceptedEventSpec(specWith(value))).toThrow();
  });
  it("rejects duplicate purchased names even if quantities seem complete", () => {
    expect(() => validateAcceptedEventSpec(specWith([quantities[0], quantities[0]], ["Croissants", "Croissants"]))).toThrow();
  });
  it.each(["hybrid", "convenience_purchase", "external_finished"] as const)("multiplies exactly once with exact units for %s", mode => {
    const component = specWith().menuPlan[0]!;
    component.productionDecision!.mode = mode;
    expect(procurementItemsForComponent(component, 35)).toEqual([
      expect.objectContaining({ purchaseQty: 35, normalizedQty: 35, purchaseUnit: "Stück", normalizedUnit: "Stück", sourceRecipes: ["procurement:pause"] }),
      expect.objectContaining({ purchaseQty: 17.5, normalizedQty: 17.5, purchaseUnit: "l", normalizedUnit: "l", sourceRecipes: ["procurement:pause"] })
    ]);
  });
  it("loads, detects, converts and reopens quantity-only edits without changing other fields", () => {
    const snapshot = specEditSnapshotFromSpec(specWith() as unknown as Record<string, unknown>);
    const states = Object.fromEntries(snapshot.components);
    expect(states.pause!.purchasedQuantities).toEqual([{ element: "Croissants", amountPerPerson: "1", unit: "Stück" }, { element: "Wasser", amountPerPerson: "0.5", unit: "l" }]);
    const edited = { ...states.pause!, purchasedQuantities: [{ element: "Croissants", amountPerPerson: "2", unit: "Stück" }, { element: "Wasser", amountPerPerson: "0.5", unit: "l" }] };
    expect(normalizedSpecEditSnapshot({ ...snapshot, components: [["pause", edited]] })).not.toBe(normalizedSpecEditSnapshot(snapshot));
    const result = buildSpecEditUpdateInput({ ...snapshot, componentStates: { pause: edited } });
    expect(result.componentUpdates).toEqual([{ componentId: "pause", menuCategory: "vegetarian", productionMode: "convenience_purchase", purchasedElements: ["Croissants", "Wasser"], recipeOverrideId: "unchanged", notes: "Unverändert", purchasedQuantities: [{ ...quantities[0], amountPerPerson: 2 }, quantities[1]] }]);
    const reopened = specEditSnapshotFromSpec(specWith(result.componentUpdates![0]!.purchasedQuantities) as unknown as Record<string, unknown>);
    expect(Object.fromEntries(reopened.components).pause).toEqual(edited);
  });
  it("preserves an element containing commas through the structured editor", () => {
    const snapshot = specEditSnapshotFromSpec(specWith([{ element: "Gebäck, geschnitten", amountPerPerson: 1, unit: "Stück" }], ["Gebäck, geschnitten"]) as unknown as Record<string, unknown>);
    expect(buildSpecEditUpdateInput({ ...snapshot, componentStates: Object.fromEntries(snapshot.components) }).componentUpdates![0]!.purchasedElements).toEqual(["Gebäck, geschnitten"]);
  });
  it("preserves exact element names when structured quantities are supplied in a different order", () => {
    const quantities = [{ element: "Wasser", amountPerPerson: 0.5, unit: "l" }, { element: "Gebäck, geschnitten", amountPerPerson: 1, unit: "Stück" }];
    const snapshot = specEditSnapshotFromSpec(specWith(quantities, ["Gebäck, geschnitten", "Wasser"]) as unknown as Record<string, unknown>);
    expect(buildSpecEditUpdateInput({ ...snapshot, componentStates: Object.fromEntries(snapshot.components) }).componentUpdates![0]!.purchasedElements).toEqual(["Gebäck, geschnitten", "Wasser"]);
  });
  it.each(["", "0", "-1", "Infinity", "NaN"])("refuses invalid editor amount %s before sending", amountPerPerson => {
    const snapshot = specEditSnapshotFromSpec(specWith() as unknown as Record<string, unknown>);
    const state = Object.fromEntries(snapshot.components).pause!;
    expect(() => buildSpecEditUpdateInput({ ...snapshot, componentStates: { pause: { ...state, purchasedQuantities: [{ element: "Croissants", amountPerPerson, unit: "Stück" }, { element: "Wasser", amountPerPerson: "0.5", unit: "l" }] } } })).toThrow();
  });
});
