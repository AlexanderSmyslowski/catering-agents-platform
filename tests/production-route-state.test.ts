import { describe, expect, it } from "vitest";
import {
  selectArchivedProductionItems,
  selectCurrentProductionItems,
  selectFocusedProductionSpec
} from "../backoffice-ui/src/production-route-state.js";

describe("production route state", () => {
  const acceptedSpecs = [
    { specId: "spec-old", label: "old" },
    { specId: "spec-current", label: "current" },
    { specId: "spec-other", label: "other" }
  ];

  it("clears the focused production spec when the workspace is cleared", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: acceptedSpecs,
        focusedProductionSpecId: "spec-current",
        productionWorkspaceCleared: true,
        route: "production",
        searchText: ""
      })
    ).toBeUndefined();
  });

  it("keeps active production search constrained to filtered specs", () => {
    const filteredSpecs = [{ specId: "spec-current", label: "current" }];

    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs,
        focusedProductionSpecId: "spec-other",
        productionWorkspaceCleared: false,
        route: "production",
        searchText: "current"
      })
    ).toBe(filteredSpecs[0]);
  });

  it("falls back to the latest accepted spec when production search is not active", () => {
    expect(
      selectFocusedProductionSpec({
        acceptedSpecs,
        filteredSpecs: [],
        productionWorkspaceCleared: false,
        route: "home",
        searchText: ""
      })
    ).toBe(acceptedSpecs[2]);
  });

  it("splits current and archived production items by focused spec", () => {
    const items = [
      { id: "plan-a", eventSpecId: "spec-current" },
      { id: "plan-b", eventSpecId: "spec-other" },
      { id: "plan-c", eventSpecId: "spec-current" }
    ];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: false
      }).map((item) => item.id)
    ).toEqual(["plan-a", "plan-c"]);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: false
      }).map((item) => item.id)
    ).toEqual(["plan-b"]);
  });

  it("keeps production item selectors empty when the workspace is cleared", () => {
    const items = [{ id: "plan-a", eventSpecId: "spec-current" }];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: true
      })
    ).toEqual([]);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "spec-current",
        items,
        productionWorkspaceCleared: true
      })
    ).toEqual([]);
  });

  it("keeps the previous unscoped production item fallback when no spec is focused", () => {
    const items = [
      { id: "plan-a", eventSpecId: "spec-current" },
      { id: "plan-b", eventSpecId: "spec-other" }
    ];

    expect(
      selectCurrentProductionItems({
        currentProductionSpecId: "",
        items,
        productionWorkspaceCleared: false
      })
    ).toBe(items);
    expect(
      selectArchivedProductionItems({
        currentProductionSpecId: "",
        items,
        productionWorkspaceCleared: false
      })
    ).toEqual([]);
  });
});
