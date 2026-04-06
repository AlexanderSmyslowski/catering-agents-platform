import { describe, expect, it } from "vitest";
import { applyApprovalTrigger } from "../approval-trigger.js";
import type { ClassifiedChangeItem } from "../impact-classifier.js";

function buildItem(overrides: Partial<ClassifiedChangeItem> = {}): ClassifiedChangeItem {
  return {
    fieldPath: "attendees.expected",
    fieldGroupKey: "guest_count",
    oldValue: 100,
    newValue: 110,
    oldValuePreview: "100",
    newValuePreview: "110",
    impactLevel: "L3",
    semanticMessage: "Gaeste-/Mengenbasis geaendert.",
    thresholdMatched: true,
    triggers: ["RequireReapproval"],
    pointOfNoReturnResults: [],
    affectedAggregates: ["AcceptedEventSpec", "ShoppingList", "ProductionPlan"],
    ...overrides
  };
}

describe("ApprovalTrigger", () => {
  it("keeps approved status for L1 changes", () => {
    const result = applyApprovalTrigger({
      currentApprovalStatus: "approved",
      items: [
        buildItem({
          fieldGroupKey: "notes",
          impactLevel: "L1",
          triggers: ["LogOnly"]
        })
      ]
    });

    expect(result.newApprovalStatus).toBe("approved");
    expect(result.requiredConfirmations).toEqual([]);
    expect(result.blockingErrors).toEqual([]);
  });

  it("keeps approved status for L2 changes", () => {
    const result = applyApprovalTrigger({
      currentApprovalStatus: "approved",
      items: [
        buildItem({
          fieldGroupKey: "prices",
          impactLevel: "L2",
          triggers: ["WarnSales"]
        })
      ]
    });

    expect(result.newApprovalStatus).toBe("approved");
    expect(result.requiredConfirmations).toEqual([]);
  });

  it("switches to pending reapproval for L3 changes", () => {
    const result = applyApprovalTrigger({
      currentApprovalStatus: "approved",
      items: [buildItem()]
    });

    expect(result.newApprovalStatus).toBe("pending_reapproval");
  });

  it("collects warnings without blocking", () => {
    const result = applyApprovalTrigger({
      currentApprovalStatus: "approved",
      items: [
        buildItem({
          pointOfNoReturnResults: [
            {
              milestone: "ShoppingCompleted",
              severity: "warn",
              prompt: "Einkauf und Kennzeichnung pruefen.",
              active: true
            }
          ]
        })
      ]
    });

    expect(result.warnings).toEqual(["Einkauf und Kennzeichnung pruefen."]);
    expect(result.requiredConfirmations).toEqual([]);
    expect(result.blockingErrors).toEqual([]);
  });

  it("collects stop confirmations as blocking errors", () => {
    const result = applyApprovalTrigger({
      currentApprovalStatus: "approved",
      items: [
        buildItem({
          fieldGroupKey: "allergens",
          pointOfNoReturnResults: [
            {
              milestone: "ProductionStarted",
              severity: "stop",
              prompt: "Kueche muss sofort bestaetigen.",
              active: true
            }
          ]
        })
      ]
    });

    expect(result.requiredConfirmations).toEqual([
      {
        milestone: "production_started",
        severity: "stop",
        prompt: "Kueche muss sofort bestaetigen."
      }
    ]);
    expect(result.blockingErrors).toEqual(["Kueche muss sofort bestaetigen."]);
  });
});
