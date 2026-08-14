import { describe, expect, it } from "vitest";
import { buildCaseHistoryState } from "../backoffice-ui/src/case-history-state.js";
import type { CaseSummary } from "@catering/shared-core";

const cases: CaseSummary[] = [
  {
    caseId: "old-case",
    product: "offer",
    displayName: "Sommerfest - 2026",
    status: "open",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-01T09:00:00.000Z"
  },
  {
    caseId: "new-case",
    product: "offer",
    displayName: "Köppf Geburtstag - 2026",
    status: "open",
    createdAt: "2026-07-12T09:00:00.000Z",
    updatedAt: "2026-07-12T09:00:00.000Z"
  }
];

describe("case history state", () => {
  it("sorts newest first without opening a case implicitly", () => {
    const state = buildCaseHistoryState(cases, "", undefined);

    expect(state.items.map((item) => item.caseId)).toEqual(["new-case", "old-case"]);
    expect(state.activeCaseId).toBeUndefined();
  });

  it("filters human-facing case names without changing the active case", () => {
    const state = buildCaseHistoryState(cases, "köppf", "old-case");

    expect(state.items.map((item) => item.caseId)).toEqual(["new-case"]);
    expect(state.activeCaseId).toBe("old-case");
  });

  it("keeps an empty search as a stable, chronological history", () => {
    expect(buildCaseHistoryState(cases, "   ", "new-case")).toEqual({
      items: [cases[1], cases[0]],
      activeCaseId: "new-case",
      query: ""
    });
  });

  it("preserves the server's activity order and filtered source-file result", () => {
    const state = buildCaseHistoryState(
      [cases[0]!, cases[1]!],
      "sommerfest.pdf",
      undefined,
      { serverFiltered: true, serverOrdered: true }
    );

    expect(state.items.map((item) => item.caseId)).toEqual(["old-case", "new-case"]);
    expect(state.query).toBe("sommerfest.pdf");
  });
});
