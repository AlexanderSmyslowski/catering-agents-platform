import type { CaseSummary } from "@catering/shared-core";

export type CaseHistoryItem = CaseSummary & {
  /** Optional server-provided search text; it never contains technical IDs. */
  searchText?: string;
};

export interface CaseHistoryState {
  items: CaseHistoryItem[];
  activeCaseId?: string;
  query: string;
}

export interface CaseHistoryStateOptions {
  /** The server already applied the query; keep its ordered, scoped result set. */
  serverFiltered?: boolean;
  /** The server already ordered the result by latest case activity. */
  serverOrdered?: boolean;
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("de-DE");
}

function activityTimestamp(item: CaseHistoryItem): number {
  const updated = Date.parse(item.updatedAt);
  if (Number.isFinite(updated)) return updated;
  const created = Date.parse(item.createdAt);
  return Number.isFinite(created) ? created : 0;
}

/**
 * Builds the opt-in history view. The caller may provide server-filtered
 * entries for source-file searches; local filtering only narrows entries that
 * carry an explicit human-facing search text.
 */
export function buildCaseHistoryState(
  cases: readonly CaseHistoryItem[],
  query: string,
  activeCaseId?: string,
  options: CaseHistoryStateOptions = {}
): CaseHistoryState {
  const normalizedQuery = normalizeSearchText(query);
  const sorted = options.serverOrdered
    ? [...cases]
    : [...cases].sort((left, right) =>
        activityTimestamp(right) - activityTimestamp(left) || left.caseId.localeCompare(right.caseId)
      );
  const items = normalizedQuery && !options.serverFiltered
    ? sorted.filter((item) => {
        const searchText = item.searchText?.trim() || item.displayName;
        return normalizeSearchText(searchText).includes(normalizedQuery);
      })
    : sorted;

  return {
    items,
    ...(activeCaseId ? { activeCaseId } : {}),
    query: normalizedQuery,
  };
}
