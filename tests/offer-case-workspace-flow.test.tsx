// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCaseNextAction } from "../backoffice-ui/src/case-next-action.js";
import { CaseNextActionBar } from "../backoffice-ui/src/case-next-action-bar.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("offer case workspace flow", () => {
  it("opens the one review action for a sourced draft without inventing an approval", async () => {
    const action = buildCaseNextAction({
      product: "offer",
      caseStatus: "open",
      hasSource: true,
      currentDraftId: "offer-draft-a",
      draftState: "pending_review"
    });
    const onAction = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(CaseNextActionBar, { action, onAction })));
    await act(async () => {
      (container.querySelector("button[data-action='case-next-action']") as HTMLButtonElement).click();
    });
    expect(action).toEqual({
      kind: "review_draft",
      label: "Nächsten Prüfpunkt öffnen",
      targetId: "offer-draft-a"
    });
    expect(onAction).toHaveBeenCalledWith(action);
    await act(async () => root.unmount());
  });
});
