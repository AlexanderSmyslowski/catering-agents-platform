import { describe, expect, it } from "vitest";
import {
  buildFinalizeGovernanceRequest,
  isCriticalOpenGovernanceChangeSet,
  mapFinalizeGovernanceErrorMessage,
  translateGovernanceRuleKey,
  shouldConfirmFinalizeChangeSet
} from "../App.js";

describe("finalize governance UI hardening", () => {
  it("requires a confirm step for open L3 change sets", () => {
    expect(
      shouldConfirmFinalizeChangeSet({
        status: "open",
        highestImpactLevel: "L3"
      })
    ).toBe(true);
  });

  it("does not require a confirm step for open L1/L2 change sets", () => {
    expect(
      shouldConfirmFinalizeChangeSet({
        status: "open",
        highestImpactLevel: "L2"
      })
    ).toBe(false);
    expect(
      shouldConfirmFinalizeChangeSet({
        status: "open",
        highestImpactLevel: "L1"
      })
    ).toBe(false);
  });

  it("maps the no-open-change-set error to a clearer UI message", () => {
    expect(mapFinalizeGovernanceErrorMessage("Kein offenes SpecChangeSet gefunden.")).toBe(
      "Es gibt kein offenes ChangeSet mehr zum Finalisieren."
    );
  });

  it("maps the missing critical confirm error to a clearer UI message", () => {
    expect(
      mapFinalizeGovernanceErrorMessage(
        "Dieses ChangeSet enthält kritische Änderungen (L3) und muss explizit bestätigt werden."
      )
    ).toBe("Dieses kritische ChangeSet muss vor dem Finalisieren ausdrücklich bestätigt werden.");
  });

  it("builds the finalize request with the explicit confirm flag for open L3 change sets", () => {
    expect(
      buildFinalizeGovernanceRequest({
        specId: "spec-1",
        changeSetId: "change-set-1",
        changeSet: {
          status: "open",
          highestImpactLevel: "L3"
        }
      })
    ).toEqual({
      specId: "spec-1",
      changeSetId: "change-set-1",
      confirmCriticalFinalize: true
    });
  });

  it("builds the finalize request without the explicit confirm flag for non-critical change sets", () => {
    expect(
      buildFinalizeGovernanceRequest({
        specId: "spec-2",
        changeSetId: "change-set-2",
        changeSet: {
          status: "open",
          highestImpactLevel: "L2"
        }
      })
    ).toEqual({
      specId: "spec-2",
      changeSetId: "change-set-2",
      confirmCriticalFinalize: false
    });
  });

  it("marks only open L3 change sets as critically visible", () => {
    expect(
      isCriticalOpenGovernanceChangeSet({
        status: "open",
        highestImpactLevel: "L3"
      })
    ).toBe(true);

    expect(
      isCriticalOpenGovernanceChangeSet({
        status: "open",
        highestImpactLevel: "L2"
      })
    ).toBe(false);

    expect(
      isCriticalOpenGovernanceChangeSet({
        status: "finalized",
        highestImpactLevel: "L3"
      })
    ).toBe(false);
  });

  it("translates known governance rule keys into short operational labels", () => {
    expect(translateGovernanceRuleKey("guest_count")).toBe("Mengen");
    expect(translateGovernanceRuleKey("event_timing")).toBe("Zeitfenster");
    expect(translateGovernanceRuleKey("allergens")).toBe("Allergene");
    expect(translateGovernanceRuleKey("prices")).toBe("Kalkulation");
    expect(translateGovernanceRuleKey("notes")).toBe("Hinweise/Texte");
    expect(translateGovernanceRuleKey("recipe_swap")).toBe("Gerichte/Rezeptur");
    expect(translateGovernanceRuleKey("yield")).toBe("Ausbeute");
    expect(translateGovernanceRuleKey("procurement_units_equivalent")).toBe("Gebinde");
    expect(translateGovernanceRuleKey("unit_conversion_with_qty_effect")).toBe("Mengenumrechnung");
  });

  it("falls back to the original governance rule key when no short label exists", () => {
    expect(translateGovernanceRuleKey("unknown_rule_key")).toBe("unknown_rule_key");
  });
});
