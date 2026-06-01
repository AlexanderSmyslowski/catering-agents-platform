import type { MenuComponent } from "@catering/shared-core";
import { dishArchetypeForComponent } from "./recipe-dish-archetypes.js";

export function genericSearchSeeds(
  component: MenuComponent,
  locale: "de" | "en"
): string[] {
  const normalized = component.label.toLowerCase();
  const archetype = dishArchetypeForComponent(component, locale);
  const seeds = new Set<string>();

  if (archetype) {
    seeds.add(archetype);
  }

  if (/schokoladenkuchen|schokokuchen/.test(normalized)) {
    seeds.add(locale === "de" ? "schokoladenkuchen" : "chocolate cake");
    seeds.add(locale === "de" ? "veganer schokoladenkuchen" : "vegan chocolate cake");
    if (component.serviceStyle === "buffet") {
      seeds.add(locale === "de" ? "schokoladen blechkuchen" : "chocolate sheet cake");
    }
  }
  if (/kraut|karott/.test(normalized)) {
    seeds.add(locale === "de" ? "karotten krautsalat" : "coleslaw cabbage carrot");
  }
  if (/wildkräuter|wildkraeuter|wild.*salat|kräutersalat|kraeutersalat/.test(normalized)) {
    seeds.add(locale === "de" ? "wildkräutersalat" : "herb salad");
    seeds.add(
      locale === "de"
        ? "wildkräutersalat petersilien vinaigrette"
        : "wild herb salad parsley vinaigrette"
    );
  }
  if (/zucchini|pilze|pilz|pak-choi|zuckerschoten/.test(normalized)) {
    seeds.add(locale === "de" ? "gemüsepfanne" : "vegetable stir fry");
  }
  if (/curry/.test(normalized)) {
    seeds.add(locale === "de" ? "veganes curry" : "vegan curry");
  }

  return [...seeds].filter(Boolean);
}
