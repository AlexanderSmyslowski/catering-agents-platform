import { describe, expect, it } from "vitest";

describe("React test environment", () => {
  it("keeps the central act-aware flag enabled for jsdom smoke tests", () => {
    expect(
      (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ).toBe(true);
  });
});
