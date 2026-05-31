function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function recipeConstraintHaystack(recipe: unknown): { name: string; haystack: string } | undefined {
  if (!isPlainObject(recipe)) {
    return undefined;
  }

  const name = typeof recipe.name === "string" ? recipe.name : "";
  const dietTags = Array.isArray(recipe.dietTags)
    ? recipe.dietTags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const ingredientNames = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .flatMap((ingredient) => {
          if (!isPlainObject(ingredient) || typeof ingredient.name !== "string") {
            return [];
          }

          return [ingredient.name];
        })
        .join(" ")
    : "";

  return {
    name,
    haystack: `${name} ${dietTags.join(" ")} ${ingredientNames}`.toLowerCase()
  };
}

export function productionConstraintConflictReason(
  recipe: unknown,
  productionConstraints?: string[]
): string | undefined {
  if (!Array.isArray(productionConstraints) || productionConstraints.length === 0) {
    return undefined;
  }

  const recipeText = recipeConstraintHaystack(recipe);
  if (!recipeText) {
    return undefined;
  }

  const { name, haystack } = recipeText;

  if (
    productionConstraints.includes("gluten_free") &&
    /\b(brot|weizen|weissmehl|weizenmehl|mehl|gluten|baguette|pasta|nudel|spaghetti|toast|roggen|dinkel|seitan)\b/i.test(
      haystack
    )
  ) {
    return `Harte Intake-Restriktion gluten_free blockiert die Rezeptwahl für ${name || "diese Komponente"}.`;
  }

  if (
    productionConstraints.includes("vegan") &&
    /\b(milch|sahne|butter|ei|eier|joghurt|käse|kaese|quark|honig|gelatine|gelatin|parmesan|mozzarella|feta|gouda|brie|camembert|garnel|garnele|garnelen|shrimp|prawn|fish|lachs|schinken|speck|huhn|rind|kalb|puten|thunfisch)\b/i.test(
      haystack
    )
  ) {
    return `Harte Intake-Restriktion vegan blockiert die Rezeptwahl für ${name || "diese Komponente"}.`;
  }

  if (
    productionConstraints.includes("vegetarian") &&
    /\b(chicken|beef|pork|ham|bacon|sausage|salami|fish|lachs|schinken|speck|huhn|rind|kalb|puten|thunfisch|garnel|garnele|garnelen|shrimp|prawn|scampi)\b/i.test(
      haystack
    )
  ) {
    return `Harte Intake-Restriktion vegetarian blockiert die Rezeptwahl für ${name || "diese Komponente"}.`;
  }

  return undefined;
}
