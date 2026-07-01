import { describe, expect, it, vi } from "vitest";
import {
  completeProductionStateAfterDocumentSuccess,
  type ProductionDocumentSuccessActions
} from "../backoffice-ui/src/production-document-success-state.js";

function buildActions(calls: string[]): ProductionDocumentSuccessActions {
  return {
    setFocusedProductionSpecId: vi.fn((specId) => {
      calls.push(`setFocusedProductionSpecId:${specId}`);
    }),
    completeIncomingProductionFile: vi.fn(() => {
      calls.push("completeIncomingProductionFile");
    }),
    completeDocumentProgress: vi.fn(() => {
      calls.push("completeDocumentProgress");
    }),
    refreshDashboard: vi.fn(async () => {
      calls.push("refreshDashboard");
    }),
    setNotice: vi.fn((message) => {
      calls.push(`setNotice:${message}`);
    })
  };
}

describe("production document success state", () => {
  it("focuses the accepted spec and completes the successful upload sequence", async () => {
    const calls: string[] = [];
    const file = new File(["Angebot"], "angebot.pdf", { type: "application/pdf" });
    const actions = buildActions(calls);

    await completeProductionStateAfterDocumentSuccess(
      file,
      { acceptedEventSpec: { specId: "spec-upload-1" } },
      actions
    );

    expect(actions.setFocusedProductionSpecId).toHaveBeenCalledWith("spec-upload-1");
    expect(actions.completeIncomingProductionFile).toHaveBeenCalledWith({ specId: "spec-upload-1" });
    expect(actions.refreshDashboard).toHaveBeenCalledTimes(1);
    expect(actions.setNotice).toHaveBeenCalledWith("Dokument angebot.pdf wurde übernommen und analysiert.");
    expect(calls).toEqual([
      "setFocusedProductionSpecId:spec-upload-1",
      "completeIncomingProductionFile",
      "completeDocumentProgress",
      "refreshDashboard",
      "setNotice:Dokument angebot.pdf wurde übernommen und analysiert."
    ]);
  });

  it("still completes the upload when the response does not carry a usable spec id", async () => {
    const calls: string[] = [];
    const file = new File(["Angebot"], "angebot-ohne-spec.txt", { type: "text/plain" });
    const actions = buildActions(calls);

    await completeProductionStateAfterDocumentSuccess(file, { acceptedEventSpec: { specId: 123 } }, actions);

    expect(actions.setFocusedProductionSpecId).not.toHaveBeenCalled();
    expect(actions.completeIncomingProductionFile).toHaveBeenCalledWith({ specId: 123 });
    expect(calls).toEqual([
      "completeIncomingProductionFile",
      "completeDocumentProgress",
      "refreshDashboard",
      "setNotice:Dokument angebot-ohne-spec.txt wurde übernommen und analysiert."
    ]);
  });
});
