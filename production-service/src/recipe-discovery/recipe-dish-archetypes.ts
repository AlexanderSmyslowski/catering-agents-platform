import type { MenuComponent } from "@catering/shared-core";

export function dishArchetypeForComponent(
  component: MenuComponent,
  locale: "de" | "en"
): string | undefined {
  const normalized = component.label.toLowerCase();

  if (/schokoladenkuchen|schokokuchen|kuchen|cake/.test(normalized)) {
    return locale === "de" ? "kuchen" : "cake";
  }
  if (/curry/.test(normalized)) {
    return "curry";
  }
  if (/linseneintopf|eintopf|stew/.test(normalized)) {
    return locale === "de" ? "eintopf" : "stew";
  }
  if (/kraut|karott|salat|vinaigrette/.test(normalized)) {
    return locale === "de" ? "salat" : "salad";
  }
  if (/kartoffelgratin|potato.*gratin/.test(normalized)) {
    return "gratin";
  }
  if (/wildkräuter|wildkraeuter|wild.*salat|kräutersalat|kraeutersalat/.test(normalized)) {
    return locale === "de" ? "salat" : "salad";
  }
  if (/zucchini|pilze|pilz|pak-choi|zuckerschoten/.test(normalized)) {
    return locale === "de" ? "gemüsepfanne" : "vegetable stir fry";
  }
  if (/brot|baguette/.test(normalized)) {
    return locale === "de" ? "brot" : "bread";
  }
  if (/suppe/.test(normalized)) {
    return locale === "de" ? "suppe" : "soup";
  }
  return undefined;
}
