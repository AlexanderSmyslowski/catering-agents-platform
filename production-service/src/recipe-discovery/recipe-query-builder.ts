import type {
  AcceptedEventSpec,
  MenuComponent,
  Recipe
} from "@catering/shared-core";
import {
  culinaryExpansionsForToken,
  deriveCompoundStemTokens,
  normalizeTokens,
  rawComparableTokens
} from "./recipe-text-normalization.js";

const genericPrimaryTokens = new Set([
  "vegan",
  "vegetarian",
  "vegetarisch",
  "klassisch",
  "classic",
  "mit",
  "und",
  "de",
  "luxe",
  "deluxe",
  "topping",
  "frischgedons",
  "frischgedoens"
]);

export function cleanedSearchLabel(label: string): string {
  const segments = label
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const keptSegments = segments.filter((segment) => {
    const normalized = segment.toLowerCase();
    if (/^(de\s*luxe?|de\s*lux|frischged[öo]ns|topping)$/i.test(normalized)) {
      return false;
    }
    return true;
  });

  const merged = keptSegments.length > 0 ? keptSegments.join(" ") : label;
  return merged
    .replace(/[&/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function primarySearchSegment(label: string): string {
  return label.split("|")[0]?.trim() || label.trim();
}

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

export function specificPrimaryFocusTokens(component: MenuComponent): string[] {
  const primarySegment = primarySearchSegment(component.label);
  const archetypes = new Set(
    [
      dishArchetypeForComponent(component, "de"),
      dishArchetypeForComponent(component, "en")
    ]
      .filter(Boolean)
      .flatMap((value) => normalizeTokens(value as string))
  );
  const focus = new Set<string>();

  for (const token of rawComparableTokens(primarySegment)) {
    if (genericPrimaryTokens.has(token) || archetypes.has(token)) {
      continue;
    }

    focus.add(token);
    for (const stem of deriveCompoundStemTokens(token)) {
      focus.add(stem);
    }
  }

  return [...focus];
}

export function leadSpecificPrimaryToken(component: MenuComponent): string | undefined {
  return specificPrimaryFocusTokens(component)[0];
}

export function webSpecificFocusTokens(component: MenuComponent): string[] {
  const archetypes = new Set(
    [
      dishArchetypeForComponent(component, "de"),
      dishArchetypeForComponent(component, "en")
    ]
      .filter(Boolean)
      .flatMap((value) => normalizeTokens(value as string))
  );
  const expanded = new Set<string>();

  for (const token of specificPrimaryFocusTokens(component)) {
    if (genericPrimaryTokens.has(token) || archetypes.has(token)) {
      continue;
    }

    expanded.add(token);
    for (const synonym of culinaryExpansionsForToken(token)) {
      if (!genericPrimaryTokens.has(synonym) && !archetypes.has(synonym)) {
        expanded.add(synonym);
      }
    }
  }

  return [...expanded];
}

export function translateLabelForLocale(label: string, locale: "de" | "en"): string {
  if (locale !== "en") {
    return label;
  }

  let translated = label.toLowerCase();
  const replacements: Array<[RegExp, string]> = [
    [/\bschokoladenkuchen\b/g, "chocolate cake"],
    [/\bkuchen\b/g, "cake"],
    [/\bschokolade\b/g, "chocolate"],
    [/\btomatensuppe\b/g, "tomato soup"],
    [/\blinseneintopf\b/g, "lentil stew"],
    [/\blinsen\b/g, "lentils"],
    [/\beintopf\b/g, "stew"],
    [/\bsuppe\b/g, "soup"],
    [/\bkartoffelsalat\b/g, "potato salad"],
    [/\bkartoffelgratin\b/g, "potato gratin"],
    [/\bnudelsalat\b/g, "pasta salad"],
    [/\bkrautsalat\b/g, "coleslaw"],
    [/\bkarottensalat\b/g, "carrot salad"],
    [/\bkraut\b/g, "cabbage"],
    [/\bkarotten\b/g, "carrot"],
    [/\bkarotte\b/g, "carrot"],
    [/\bmöhren\b/g, "carrot"],
    [/\bmöhre\b/g, "carrot"],
    [/\bmandeln\b/g, "almonds"],
    [/\bmandel\b/g, "almond"],
    [/\bnuss-toppping\b/g, "nut topping"],
    [/\bnuss-topping\b/g, "nut topping"],
    [/\bkraut-karottensalat\b/g, "cabbage carrot salad"],
    [/\bsalat\b/g, "salad"],
    [/\bbrot\b/g, "bread"],
    [/\bbaguette\b/g, "baguette"],
    [/\bkalbsbuletten\b/g, "veal meatballs"],
    [/\bkalbsfrikadellen\b/g, "veal meatballs"],
    [/\bbuletten\b/g, "meatballs"],
    [/\bfrikadellen\b/g, "meatballs"],
    [/\bschmorzwiebeln\b/g, "braised onions"],
    [/\bblaubeeren\b/g, "blueberry"],
    [/\bblaubeere\b/g, "blueberry"],
    [/\bobstspieße\b/g, "fruit skewers"],
    [/\bobstspiesse\b/g, "fruit skewers"],
    [/\bobstspieß\b/g, "fruit skewer"],
    [/\bobstspiess\b/g, "fruit skewer"],
    [/\bobst\b/g, "fruit"],
    [/\bbasmatireis\b/g, "basmati rice"],
    [/\bkoriander\b/g, "coriander"],
    [/\bwildkräutersalat\b/g, "wild herb salad"],
    [/\bwildkraeutersalat\b/g, "wild herb salad"],
    [/\bwildkräuter\b/g, "wild herbs"],
    [/\bpetersilien-vinaigrette\b/g, "parsley vinaigrette"],
    [/\bzuckerschoten\b/g, "snow peas"],
    [/\bpilze\b/g, "mushrooms"],
    [/\bpilz\b/g, "mushroom"],
    [/\bbaby-pak-choi\b/g, "baby pak choi"],
    [/\bpak-choi\b/g, "pak choi"],
    [/\bgemüsepfanne\b/g, "vegetable stir fry"],
    [/\bgemuesepfanne\b/g, "vegetable stir fry"]
  ];

  for (const [pattern, replacement] of replacements) {
    translated = translated.replace(pattern, replacement);
  }

  return translated.replace(/\s+/g, " ").trim();
}

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

export function normalizeSearchQuery(query: string): string {
  return query
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((token, index, tokens) => token && token !== tokens[index - 1])
    .join(" ");
}

export function uniqueNormalizedSearchQueries(queries: string[]): string[] {
  return [...new Set(queries.map(normalizeSearchQuery).filter((query) => query.length > 0))];
}

export function buildSearchQueries(
  component: MenuComponent,
  eventSpec: AcceptedEventSpec,
  locale: "de" | "en"
): string[] {
  const cleanedLabel = translateLabelForLocale(cleanedSearchLabel(component.label), locale);
  const primaryLabel = translateLabelForLocale(primarySearchSegment(component.label), locale);
  const classificationHint =
    component.menuCategory === "vegan"
      ? locale === "de"
        ? "vegan"
        : "vegan"
      : component.menuCategory === "vegetarian"
        ? locale === "de"
          ? "vegetarisch"
          : "vegetarian"
        : "";
  const genericSeeds = genericSearchSeeds(component, locale);
  const archetype = dishArchetypeForComponent(component, locale);
  const baseQueries =
    locale === "de"
      ? [
          `${cleanedLabel} ${classificationHint} rezept`,
          `${primaryLabel} ${classificationHint} rezept`,
          `${classificationHint} ${archetype ?? primaryLabel} rezept`,
          ...genericSeeds.flatMap((seed) => [
            `${seed} rezept`,
            `${classificationHint} ${seed} rezept`
          ]),
          `${primaryLabel} ${classificationHint} rezept ${eventSpec.servicePlan.serviceForm}`,
          `${primaryLabel} ${classificationHint} ${eventSpec.servicePlan.eventType} rezept`
        ]
      : [
          `${cleanedLabel} ${classificationHint} recipe`,
          `${primaryLabel} ${classificationHint} recipe`,
          `${classificationHint} ${archetype ?? primaryLabel} recipe`,
          ...genericSeeds.flatMap((seed) => [
            `${seed} recipe`,
            `${classificationHint} ${seed} recipe`
          ]),
          `${primaryLabel} ${classificationHint} recipe ${eventSpec.servicePlan.serviceForm}`,
          `${primaryLabel} ${classificationHint} catering recipe`
        ];

  return uniqueNormalizedSearchQueries(baseQueries);
}

export function recipeSearchText(recipe: Recipe): string {
  const ingredients = recipe.ingredients.map((ingredient) => ingredient.name).join(" ");
  return `${recipe.name} ${recipe.source.reference} ${(recipe.dietTags ?? []).join(" ")} ${ingredients}`;
}

export function componentSearchTokens(component: MenuComponent): string[] {
  const combined = new Set<string>(normalizeTokens(component.label));
  const archetypes = [
    dishArchetypeForComponent(component, "de"),
    dishArchetypeForComponent(component, "en")
  ].filter(Boolean) as string[];

  for (const archetype of archetypes) {
    for (const token of normalizeTokens(archetype)) {
      combined.add(token);
    }
  }

  return [...combined];
}
