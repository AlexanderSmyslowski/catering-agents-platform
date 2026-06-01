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
