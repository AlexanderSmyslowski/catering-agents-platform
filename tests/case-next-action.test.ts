import { describe, expect, it } from "vitest";
import {
  buildCaseNextAction,
  type CaseNextActionInput
} from "../backoffice-ui/src/case-next-action.js";

const base = (overrides: Partial<CaseNextActionInput> = {}): CaseNextActionInput => ({
  product: "offer",
  caseStatus: "open",
  hasSource: false,
  ...overrides
});

describe("case next action state machine", () => {
  it.each([
    [base(), "add_source"],
    [base({ hasSource: true, currentDraftId: "draft-1", draftState: "pending_review", nextReviewTargetId: "card-1" }), "review_draft"],
    [base({ hasSource: true, currentDraftId: "draft-1", draftState: "change_requested" }), "request_revision"],
    [base({ hasSource: true, currentDraftId: "draft-1", draftState: "ready_for_approval", selectedVariantId: "variant-1" }), "approve_offer"],
    [base({ hasSource: true, approvedOfferId: "offer-1" }), "send_handoff"]
  ])("returns one deterministic action for %s", (input, kind) => {
    expect(buildCaseNextAction(input)).toMatchObject({ kind });
  });

  it("does not offer handoff creation again when a handoff already exists", () => {
    expect(buildCaseNextAction(base({ hasSource: true, approvedOfferId: "offer-1", handoffId: "handoff-1" })))
      .toMatchObject({ kind: "inspect_handoff", handoffId: "handoff-1" });
  });

  it("prioritizes an existing result over applying an approved production spec", () => {
    expect(buildCaseNextAction({
      product: "production",
      caseStatus: "open",
      hasSource: true,
      approvedProductionSpecId: "spec-1",
      resultArtifactId: "result-1"
    })).toMatchObject({ kind: "inspect_result", artifactId: "result-1" });
  });

  it("renders an archived case as terminal, not actionable", () => {
    expect(buildCaseNextAction(base({ caseStatus: "archived", hasSource: false })))
      .toMatchObject({ kind: "complete" });
  });
});
