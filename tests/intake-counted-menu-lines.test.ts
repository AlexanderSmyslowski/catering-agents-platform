import { describe, expect, it } from "vitest";
import { createCuratedOfferDraft, createEventRequestFromText, normalizeEventRequestToSpec } from "@catering/shared-core";

const menu = [
  ["Vegane Gurken-Canapés", 100, "vegan"],
  ["Vegetarische Tomaten-Mozzarella-Canapés", 100, "vegetarisch"],
  ["Hähnchenragout", 55, "klassisch"],
  ["Vegetarische Gemüsebratlinge", 25, "vegetarisch"],
  ["Veganes Linsenragout", 20, "vegan"],
  ["Rosmarinkartoffeln", 100, "vegan"],
  ["Ofengemüse", 100, "vegan"],
  ["Quarkcreme", 80, "vegetarisch"],
  ["Veganes Fruchtkompott", 20, "vegan"]
] as const;
const mixedMenu = menu.map(([label, portions, diet]) => `${label}: ${portions} Portionen, ${diet}.`).join("\n");
function normalize(text: string) {
  return normalizeEventRequestToSpec(createEventRequestFromText({ requestId: "synthetic-counted-menu", channel: "text", rawText: text }));
}

describe("counted dish lines from the Nürnberg browser test", () => {
  it("keeps all nine named dishes and their explicit quantities without a global vegan restriction", () => {
    const spec = normalize(`Wissenschaftliche Abendveranstaltung für 100 Gäste am 13.11.2026.\nMenü:\n${mixedMenu}\nSonderkost: 4 Gäste benötigen glutenfreie Sonderkost, 3 Gäste Schalenfruchtvermeidung.`);
    expect(spec.menuPlan.map(({ label, servings }) => [label, servings])).toEqual(menu.map(([label, count]) => [label, count]));
    expect(spec.productionConstraints).not.toContain("vegan");
    expect(spec.productionConstraints).not.toContain("vegetarian");
    expect(spec.productionConstraints).not.toContain("gluten_free");
    expect(spec.uncertainties?.some(item => item.field === "productionConstraints")).toBe(true);
  });

  it.each([
    "Das gesamte Buffet muss vegan sein.",
    "Bitte veganes Buffet.",
    "Alle Gäste erhalten ausschließlich vegane Speisen.",
    "vegan",
    "Das Buffet muss vegan sein, ohne Milch und ohne Gluten.",
    "Veganes Buffet: 100 Portionen, vegan."
  ])("retains a separate whole-event requirement beside counted dish labels: %s", mandate => {
    const spec = normalize(`${mixedMenu}\n${mandate}`);
    expect(spec.productionConstraints).toContain("vegan");
  });

  it("keeps the counted customer menu through the curated offer path instead of replacing it with package defaults", () => {
    const draft = createCuratedOfferDraft(createEventRequestFromText({ requestId: "synthetic-counted-offer", channel: "text", rawText: `Buffet für 100 Gäste am 13.11.2026.\n${mixedMenu}` }), {
      id: "synthetic-package", name: "Synthetische Paketannahme", price_band_pp: [10, 20], min_pax: 10,
      food_modules: ["Paket-Platzhalter"], service_modules: [], source_evidence: { records_cluster_total: 0, records_cluster_2025_2026: 0 }
    });
    expect(draft.proposedEventSpec.menuPlan.map(({ label, servings }) => [label, servings])).toEqual(menu.map(([label, count]) => [label, count]));
    expect(draft.proposedEventSpec.productionConstraints).not.toContain("vegan");
  });

  it("does not turn guest groups, ingredient weights or personnel counts into dishes", () => {
    const spec = normalize("Buffet für 100 Gäste am 13.11.2026.\n55 Portionen Hähnchenragout, 25 Portionen vegetarische Bratlinge, 20 Portionen veganes Linsenragout.\n4 Gäste benötigen glutenfreie Sonderkost.\nZimt: 2 g.\nService: 24 Personenstunden.");
    expect(spec.menuPlan.map(item => item.servings)).toEqual([55, 25, 20]);
    expect(spec.menuPlan).toHaveLength(3);
  });

  it.each(["Vegetarier: 25 Portionen", "Veganer: 20 Portionen, vegan", "Kinder: 15 Portionen", "Sonderkost: 4 Portionen", "Gesamt: 280 Portionen", "Summe: 280 Portionen", "Hauptgang: 100 Portionen", "Veganes Buffet: 100 Portionen, vegan"])("does not add a group, total or course heading as a dish: %s", heading => {
    const spec = normalize(`Buffet für 100 Gäste am 13.11.2026.\n55 Portionen Hähnchenragout, 25 Portionen vegetarische Bratlinge, 20 Portionen veganes Linsenragout.\n${heading}`);
    expect(spec.menuPlan.map(item => item.servings)).toEqual([55, 25, 20]);
    if (/^(Veganer|Vegetarier)/.test(heading)) {
      expect(spec.productionConstraints ?? []).not.toContain("vegan");
      expect(spec.productionConstraints ?? []).not.toContain("vegetarian");
    }
  });

  it("keeps dietary adjectives on counted dish names local without a trailing tag", () => {
    const spec = normalize("100 Gäste am 13.11.2026.\nVeganes Fruchtkompott: 20 Portionen.");
    expect(spec.menuPlan).toMatchObject([{ label: "Veganes Fruchtkompott", servings: 20, menuCategory: "vegan" }]);
    expect(spec.productionConstraints ?? []).not.toContain("vegan");
  });

  it("preserves CRLF, bullets and the order of differently formatted dish counts", () => {
    const spec = normalize("100 Gäste am 13.11.2026.\r\n• Hähnchenragout: 55 Portionen, klassisch.\r\n25 Portionen vegetarische Bratlinge.\r\n- Veganes Linsenragout: 20 Portionen, vegan.\r\n");
    expect(spec.menuPlan.map(({ label, servings }) => [label, servings])).toEqual([["Hähnchenragout", 55], ["vegetarische Bratlinge", 25], ["Veganes Linsenragout", 20]]);
    expect(spec.productionConstraints ?? []).not.toContain("vegan");
  });

  it("retains explicit vegetarian whole-event requirements beside local tags", () => {
    expect(normalize(`${mixedMenu}\nDas gesamte Buffet muss vegetarisch sein.`).productionConstraints).toContain("vegetarian");
  });

  it("asks for recipe review instead of stamping an unsupported or contradictory trailing dietary claim", () => {
    const spec = normalize("100 Gäste am 13.11.2026.\nHähnchenragout: 55 Portionen, vegan.\nVeganes Linsenragout: 20 Portionen, klassisch.");
    expect(spec.menuPlan.every(item => item.menuCategory === undefined && !item.dietaryTags?.length)).toBe(true);
    expect(spec.uncertainties?.filter(item => item.field === "menuPlan")).toHaveLength(2);
    expect(spec.uncertainties?.some(item => item.message.includes("Hähnchenragout: vegan"))).toBe(true);
  });

  it.each(["Vegetarier: 25 Portionen", "Veganer: 20 Portionen, vegan", "Gesamt: 280 Portionen", "Summe: 280 Portionen", "Vegan: 20 Portionen", "Vegetarisch: 25 Portionen", "Klassisch: 55 Portionen", "Vorspeisen: 100 Portionen", "Desserts: 100 Portionen", "Beilagen: 100 Portionen", "Hauptgänge: 100 Portionen"])("does not let an excluded heading consume the next line: %s", heading => {
    const spec = normalize(`100 Gäste am 13.11.2026.\n55 Portionen Hähnchenragout, 25 Portionen vegetarische Bratlinge, 20 Portionen veganes Linsenragout.\n${heading}\nSonderkost: 4 Gäste benötigen glutenfreie Sonderkost.\nService: 24 Personenstunden.`);
    expect(spec.menuPlan.map(item => item.servings)).toEqual([55, 25, 20]);
    expect(spec.menuPlan.some(item => item.label.includes("Sonderkost"))).toBe(false);
  });
});
