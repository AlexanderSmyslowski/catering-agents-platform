// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { caseIdFromLocation, caseIdFromSearch, navigateToCase } from "../backoffice-ui/src/case-location.js";

afterEach(() => window.history.replaceState({}, "", "/"));

describe("case location", () => {
  it("rejects ambiguous and malformed references", () => {
    expect(caseIdFromSearch("offer", "?offerCaseId=a&offerCaseId=b")).toBeUndefined();
    expect(caseIdFromSearch("offer", "?offerCaseId=%20a")).toBeUndefined();
    expect(caseIdFromSearch("production", "?productionCaseId=" + "x".repeat(513))).toBeUndefined();
  });
  it("preserves a case across reload and drops a previous case's draft on a switch", () => {
    window.history.replaceState({}, "", "/produktion?productionCaseId=case-a&productionDraftId=draft-a#production-draft-draft-a");
    navigateToCase("production", "case-b", "user-a");
    expect(location.search).toBe("?productionCaseId=case-b");
    expect(location.hash).toBe("");
    expect(caseIdFromLocation("production", "user-a")).toBe("case-b");
    expect(caseIdFromLocation("production", "user-b")).toBeUndefined();
  });
  it("does not restore legacy private history for another user or infer a case from a draft-only link", () => {
    window.history.replaceState({ "catering.offerCaseFocus": { userId: "a", caseId: "x" } }, "", "/angebot");
    expect(caseIdFromLocation("offer", "b")).toBeUndefined();
    expect(caseIdFromSearch("production", "?productionDraftId=old")).toBeUndefined();
  });
});
