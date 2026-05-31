import type { MenuComponent, Recipe, WebRecipeCandidate } from "@catering/shared-core";

export type MenuCategoryCompatibility = {
  compatible: boolean;
  inferredDietTags: string[];
  confidence: "explicit" | "ingredients" | "none";
};

const veganCuePattern = /\b(vegan|pflanzlich|plant[- ]based|dairy[- ]free|eggless)\b/i;
const vegetarianCuePattern = /\b(vegetarisch|vegetarian)\b/i;
const nonVeganIngredientPattern =
  /\b(milch|sahne|butter|ei|eier|joghurt|käse|kaese|quark|honig|gelatine|gelatin|parmesan|mozzarella|feta|gouda|brie|camembert|shrimp|prawn|prawns|garnel|garnele|garnelen|arnele|scampi|chicken|beef|pork|ham|bacon|sausage|salami|fish|lachs|schinken|speck|huhn|rind|kalb|puten|thunfisch|anchov|worcestershire)\b/i;
const meatIngredientPattern =
  /\b(chicken|beef|pork|ham|bacon|sausage|salami|fish|lachs|schinken|speck|huhn|rind|kalb|puten|thunfisch|garnel|garnele|garnelen|arnele|shrimp|prawn|prawns|scampi|anchov)\b/i;

export function hasCategoryCue(
  text: string,
  category: MenuComponent["menuCategory"] | undefined
): boolean {
  if (!category) {
    return true;
  }

  if (category === "vegan") {
    return veganCuePattern.test(text);
  }

  if (category === "vegetarian") {
    return vegetarianCuePattern.test(text) || veganCuePattern.test(text);
  }

  return true;
}

export function categoryBoostForText(text: string, component: MenuComponent): number {
  if (!component.menuCategory) {
    return 0;
  }

  return hasCategoryCue(text, component.menuCategory) ? 0.2 : -0.05;
}

export function evaluateMenuCategoryCompatibility(
  candidate: WebRecipeCandidate,
  component: MenuComponent
): MenuCategoryCompatibility {
  if (!component.menuCategory) {
    return {
      compatible: true,
      inferredDietTags: [],
      confidence: "none"
    };
  }

  const text = `${candidate.title} ${candidate.url} ${(candidate.recipe?.dietTags ?? []).join(" ")}`;
  if (hasCategoryCue(text, component.menuCategory)) {
    return {
      compatible: true,
      inferredDietTags: [component.menuCategory],
      confidence: "explicit"
    };
  }

  const ingredientNames = (candidate.recipe?.ingredients ?? [])
    .map((ingredient) => ingredient.name)
    .join(" ")
    .toLowerCase();

  if (!ingredientNames) {
    return {
      compatible: false,
      inferredDietTags: [],
      confidence: "none"
    };
  }

  if (component.menuCategory === "vegan") {
    if (nonVeganIngredientPattern.test(ingredientNames)) {
      return {
        compatible: false,
        inferredDietTags: [],
        confidence: "none"
      };
    }

    return {
      compatible: true,
      inferredDietTags: ["vegan"],
      confidence: "ingredients"
    };
  }

  if (component.menuCategory === "vegetarian") {
    if (meatIngredientPattern.test(ingredientNames)) {
      return {
        compatible: false,
        inferredDietTags: [],
        confidence: "none"
      };
    }

    return {
      compatible: true,
      inferredDietTags: ["vegetarian"],
      confidence: "ingredients"
    };
  }

  return {
    compatible: true,
    inferredDietTags: [],
    confidence: "none"
  };
}

export function candidateSupportsMenuCategory(
  candidate: WebRecipeCandidate,
  component: MenuComponent
): boolean {
  return evaluateMenuCategoryCompatibility(candidate, component).compatible;
}

export function recipeSupportsMenuCategory(recipe: Recipe, component: MenuComponent): boolean {
  if (!component.menuCategory) {
    return true;
  }

  const text = `${recipe.name} ${recipe.source.reference} ${(recipe.dietTags ?? []).join(" ")}`;
  if (hasCategoryCue(text, component.menuCategory)) {
    return true;
  }

  const ingredientNames = recipe.ingredients.map((ingredient) => ingredient.name).join(" ").toLowerCase();
  if (!ingredientNames) {
    return false;
  }

  if (component.menuCategory === "vegan") {
    return !nonVeganIngredientPattern.test(ingredientNames);
  }

  if (component.menuCategory === "vegetarian") {
    return !meatIngredientPattern.test(ingredientNames);
  }

  return true;
}
