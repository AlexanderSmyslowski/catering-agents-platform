import { describe, expect, it } from "vitest";
import { buildProductionFocusState } from "../backoffice-ui/src/production-focus-state.js";

describe("production focus state", () => {
  const acceptedSpecs = [
    { specId: "spec-old", label: "old", requestId: "request-old" },
    { specId: "spec-current", label: "current", requestId: "request-current" },
    { specId: "spec-other", label: "other", requestId: "request-other" }
  ];

  it("selects the focused production spec and exposes its intake request id on production", () => {
    const state = buildProductionFocusState({
      acceptedSpecs,
      filteredSpecs: acceptedSpecs,
      focusedProductionSpecId: "spec-current",
      productionArtifactSpecIds: [],
      productionWorkspaceCleared: false,
      route: "production",
      searchText: ""
    });

    expect(state.focusedProductionSpec).toBe(acceptedSpecs[1]);
    expect(state.focusedProductionSpecRecord).toBe(acceptedSpecs[1]);
    expect(state.currentIntakeRequestId).toBe("request-current");
  });

  it("keeps intake request details scoped to the production route", () => {
    const state = buildProductionFocusState({
      acceptedSpecs,
      filteredSpecs: acceptedSpecs,
      focusedProductionSpecId: "spec-current",
      productionArtifactSpecIds: [],
      productionWorkspaceCleared: false,
      route: "home",
      searchText: ""
    });

    expect(state.focusedProductionSpec).toBe(acceptedSpecs[1]);
    expect(state.currentIntakeRequestId).toBeUndefined();
  });

  it("keeps a narrowed production search result unfocused until it is selected", () => {
    const state = buildProductionFocusState({
      acceptedSpecs,
      filteredSpecs: [acceptedSpecs[2]],
      focusedProductionSpecId: "spec-current",
      productionArtifactSpecIds: [],
      productionWorkspaceCleared: false,
      route: "production",
      searchText: "other"
    });

    expect(state.focusedProductionSpec).toBeUndefined();
    expect(state.focusedProductionSpecRecord).toBeUndefined();
    expect(state.currentIntakeRequestId).toBeUndefined();
  });

  it("clears focus and intake context when the production workspace is cleared", () => {
    expect(
      buildProductionFocusState({
        acceptedSpecs,
        filteredSpecs: acceptedSpecs,
        focusedProductionSpecId: "spec-current",
        productionArtifactSpecIds: [],
        productionWorkspaceCleared: true,
        route: "production",
        searchText: ""
      })
    ).toEqual({
      focusedProductionSpec: undefined,
      focusedProductionSpecRecord: undefined,
      currentIntakeRequestId: undefined
    });
  });

  it("does not infer production focus from artifact ownership", () => {
    const state = buildProductionFocusState({
      acceptedSpecs,
      filteredSpecs: acceptedSpecs,
      productionArtifactSpecIds: ["spec-current"],
      productionWorkspaceCleared: false,
      route: "production",
      searchText: ""
    });

    expect(state.focusedProductionSpec).toBeUndefined();
    expect(state.currentIntakeRequestId).toBeUndefined();

    expect(
      buildProductionFocusState({
        acceptedSpecs,
        filteredSpecs: acceptedSpecs,
        productionArtifactSpecIds: ["spec-missing"],
        productionWorkspaceCleared: false,
        route: "production",
        searchText: ""
      }).focusedProductionSpec
    ).toBeUndefined();
  });
});
