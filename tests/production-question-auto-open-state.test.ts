import { describe, expect, it } from "vitest";
import { buildProductionQuestionAutoOpenState } from "../backoffice-ui/src/production-question-auto-open-state.js";

function spec(readinessStatus = "complete") {
  return {
    specId: "spec-1",
    readiness: {
      status: readinessStatus
    }
  };
}

describe("production question auto-open state", () => {
  it("does not auto-open outside the production route", () => {
    expect(
      buildProductionQuestionAutoOpenState({
        route: "offer",
        focusedProductionSpec: spec("partial"),
        productionQuestionCount: 1
      })
    ).toEqual({ shouldAutoOpen: false });
  });

  it("does not auto-open without a focused spec id", () => {
    expect(
      buildProductionQuestionAutoOpenState({
        route: "production",
        focusedProductionSpec: { readiness: { status: "partial" } },
        productionQuestionCount: 1
      })
    ).toEqual({ shouldAutoOpen: false });
  });

  it("keeps the review editor closed when production questions are present", () => {
    expect(
      buildProductionQuestionAutoOpenState({
        route: "production",
        focusedProductionSpec: spec("complete"),
        productionQuestionCount: 2
      })
    ).toEqual({ shouldAutoOpen: false, specId: "spec-1" });
  });

  it("keeps incomplete readiness from jumping into the editor", () => {
    expect(
      buildProductionQuestionAutoOpenState({
        route: "production",
        focusedProductionSpec: spec("partial"),
        productionQuestionCount: 0
      })
    ).toEqual({ shouldAutoOpen: false, specId: "spec-1" });
  });

  it("does not auto-open the currently edited or dismissed spec", () => {
    expect(
      buildProductionQuestionAutoOpenState({
        route: "production",
        focusedProductionSpec: spec("partial"),
        productionQuestionCount: 1,
        editingSpecId: "spec-1"
      })
    ).toEqual({ shouldAutoOpen: false, specId: "spec-1" });

    expect(
      buildProductionQuestionAutoOpenState({
        route: "production",
        focusedProductionSpec: spec("partial"),
        productionQuestionCount: 1,
        dismissedProductionAnswerSpecId: "spec-1"
      })
    ).toEqual({ shouldAutoOpen: false, specId: "spec-1" });
  });

  it("keeps complete specs without questions closed", () => {
    expect(
      buildProductionQuestionAutoOpenState({
        route: "production",
        focusedProductionSpec: spec("complete"),
        productionQuestionCount: 0
      })
    ).toEqual({ shouldAutoOpen: false, specId: "spec-1" });
  });
});
