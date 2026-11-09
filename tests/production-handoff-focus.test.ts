// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { consumeProductionHandoffFocus } from "../backoffice-ui/src/production-entry-focus.js";

afterEach(() => { sessionStorage.clear(); history.replaceState({}, "", "/"); });
it("consumes only the matching handoff once and preserves explicit deep links", () => {
  sessionStorage.setItem("catering:production-handoff-focus", "case-1");
  history.replaceState({}, "", "/produktion?productionCaseId=case-1#production-draft-example");
  expect(consumeProductionHandoffFocus("case-1")).toBe(false);
  history.replaceState({}, "", "/produktion?productionCaseId=case-1");
  expect(consumeProductionHandoffFocus("case-2")).toBe(false);
  expect(consumeProductionHandoffFocus("case-1")).toBe(true);
  expect(consumeProductionHandoffFocus("case-1")).toBe(false);
});
