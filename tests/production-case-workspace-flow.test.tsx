// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventRequestFromText, createOfferDraft, type OfferDraft } from "@catering/shared-core";
import { buildOfferNextAction, buildProductionNextAction } from "../backoffice-ui/src/App.js";
import { buildCaseNextAction } from "../backoffice-ui/src/case-next-action.js";
import { CaseNextActionBar } from "../backoffice-ui/src/case-next-action-bar.js";
import type { ProductionDraft } from "../backoffice-ui/src/api.js";

afterEach(() => {
  document.body.innerHTML = "";
});

const productionDraft = (overrides: Partial<ProductionDraft> = {}): ProductionDraft => ({
  draftId: "production-draft-a",
  status: "pending_review",
  createdAt: "2026-08-14T00:00:00.000Z",
  reviewCards: [],
  draftArtifacts: {
    eventSpec: { specId: "spec-a" },
    productionPlan: { recipeSelections: [{ recipeId: "recipe-a" }] },
    purchaseList: { items: [] },
    recipes: [{ recipeId: "recipe-a" }]
  },
  ...overrides
});

describe("App production next-action integration", () => {
  it("blocks approval when a production selection references no recipe", () => {
    const action = buildProductionNextAction({
      caseStatus: "open",
      hasSource: true,
      currentDraftId: "production-draft-a",
      draft: productionDraft({
        draftArtifacts: {
          eventSpec: { specId: "spec-a" },
          productionPlan: { recipeSelections: [{ recipeId: "recipe-missing" }] },
          purchaseList: { items: [] },
          recipes: [{ recipeId: "recipe-a" }]
        }
      })
    });

    expect(action).toMatchObject({ kind: "review_draft", targetId: "production-draft-a" });
  });

  it("allows approval for a complete production selection", () => {
    const action = buildProductionNextAction({
      caseStatus: "open",
      hasSource: true,
      currentDraftId: "production-draft-a",
      draft: productionDraft()
    });

    expect(action).toMatchObject({ kind: "approve_production", draftId: "production-draft-a" });
  });

  it("keeps a requested offer revision as the next action", () => {
    const draft: OfferDraft = {
      ...createOfferDraft(createEventRequestFromText({
        requestId: "offer-revision-a",
        channel: "text",
        rawText: "Business Lunch für 20 Personen am 2026-09-18."
      })),
      reviewStatus: {
        priceReviewStatus: "review_required",
        taxReviewStatus: "review_required",
        allergenReviewStatus: "review_required",
        hygieneTemperatureReviewStatus: "review_required",
        sourceSecured: true,
        publishApproved: false
      }
    };
    const action = buildOfferNextAction({
      product: "offer",
      caseStatus: "open",
      hasSource: true,
      currentDraftId: draft.draftId,
      draft
    });

    expect(action).toMatchObject({ kind: "review_draft", targetId: draft.draftId });
  });
});

describe("production case workspace flow", () => {
  it("keeps a persisted result as the only next action", async () => {
    const action = buildCaseNextAction({
      product: "production",
      caseStatus: "open",
      hasSource: true,
      approvedProductionSpecId: "approved-spec-a",
      resultArtifactId: "plan-a"
    });
    const onAction = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(CaseNextActionBar, { action, onAction })));
    expect(container.querySelectorAll("button[data-action='case-next-action']")).toHaveLength(1);
    await act(async () => {
      (container.querySelector("button[data-action='case-next-action']") as HTMLButtonElement).click();
    });
    expect(action).toEqual({ kind: "inspect_result", label: "Ergebnis öffnen", artifactId: "plan-a" });
    expect(onAction).toHaveBeenCalledWith(action);
    await act(async () => root.unmount());
  });
});
