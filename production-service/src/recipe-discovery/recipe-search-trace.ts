export type RecipeSearchTrace = {
  readonly entries: string[];
  push: (message: string) => void;
};

export function createRecipeSearchTrace(limit = 12): RecipeSearchTrace {
  const entries: string[] = [];

  return {
    entries,
    push(message) {
      if (entries.length < limit) {
        entries.push(message);
      }
    }
  };
}
