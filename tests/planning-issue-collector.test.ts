import { describe, expect, it } from "vitest";
import { createPlanningIssueCollector } from "../production-service/src/rules/planning-issue-collector.js";

describe("planning issue collector", () => {
  it("starts with copied missing fields and keeps issues unique", () => {
    const initialMissingFields = ["Termin fehlt."];
    const collector = createPlanningIssueCollector(initialMissingFields);

    initialMissingFields.push("Mutiert nach Erstellung.");
    collector.noteIssue("Klassifikation für Suppe fehlt.", true);
    collector.noteIssue("Klassifikation für Suppe fehlt.", true);

    expect(collector.unresolvedItems).toEqual([
      "Termin fehlt.",
      "Klassifikation für Suppe fehlt."
    ]);
    expect(collector.blockingIssues).toEqual(["Klassifikation für Suppe fehlt."]);
    expect(collector.warnings).toEqual([]);
  });

  it("separates explicit warnings from blocking issues", () => {
    const collector = createPlanningIssueCollector();

    collector.noteIssue("Rezept sollte fachlich geprüft werden.", false);
    collector.noteIssue("Herstellungsentscheidung für Pasta fehlt.", true);

    expect(collector.unresolvedItems).toEqual([
      "Rezept sollte fachlich geprüft werden.",
      "Herstellungsentscheidung für Pasta fehlt."
    ]);
    expect(collector.warnings).toEqual(["Rezept sollte fachlich geprüft werden."]);
    expect(collector.blockingIssues).toEqual(["Herstellungsentscheidung für Pasta fehlt."]);
  });

  it("uses planning readiness blocking defaults when no explicit flag is passed", () => {
    const collector = createPlanningIssueCollector();

    collector.noteIssue("Herstellungsentscheidung fehlt für Bowl.");
    collector.noteIssue("Interner Rezept-Fallback wurde verwendet.");

    expect(collector.blockingIssues).toEqual(["Herstellungsentscheidung fehlt für Bowl."]);
    expect(collector.warnings).toEqual(["Interner Rezept-Fallback wurde verwendet."]);
  });
});
