import { describe, expect, it } from "vitest";
import {
  isMinimalMvpProtectedPath,
  isMinimalMvpRole,
  MINIMAL_MVP_PROTECTED_PATHS,
  MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES,
  MINIMAL_MVP_ROLE_LABELS,
  MINIMAL_MVP_ROLES,
  resolveMinimalMvpRoleFromActorName,
  resolveMinimalMvpRoleFromTrustedActor,
  trustedActorFromHeaders
} from "../shared-core/src/access-control.js";

describe("minimal MVP roles convention", () => {
  it("exposes the four minimal MVP roles and their labels", () => {
    expect(MINIMAL_MVP_ROLES).toEqual([
      "intake_operator",
      "offer_operator",
      "production_operator",
      "operations_audit_operator"
    ]);
    expect(MINIMAL_MVP_ROLE_LABELS).toEqual({
      intake_operator: "Intake-Operator",
      offer_operator: "Angebots-Operator",
      production_operator: "Produktions-Operator",
      operations_audit_operator: "Betriebs-/Audit-Operator"
    });
  });

  it("resolves default actor names back to the minimal MVP roles", () => {
    expect(resolveMinimalMvpRoleFromActorName("Intake-Mitarbeiter")).toBe("intake_operator");
    expect(resolveMinimalMvpRoleFromActorName("Angebots-Mitarbeiter")).toBe("offer_operator");
    expect(resolveMinimalMvpRoleFromActorName("Produktions-Mitarbeiter")).toBe("production_operator");
    expect(resolveMinimalMvpRoleFromActorName("Betriebs-/Audit-Operator")).toBe("operations_audit_operator");
    expect(resolveMinimalMvpRoleFromActorName("Mitarbeiter")).toBeUndefined();
  });

  it("normalizes surrounding whitespace and casing for all default actor names", () => {
    expect(resolveMinimalMvpRoleFromActorName("  intake-mitarbeiter  ")).toBe("intake_operator");
    expect(resolveMinimalMvpRoleFromActorName("  angebots-mitarbeiter  ")).toBe("offer_operator");
    expect(resolveMinimalMvpRoleFromActorName("  produktions-mitarbeiter  ")).toBe("production_operator");
    expect(resolveMinimalMvpRoleFromActorName("  betriebs-/audit-operator  ")).toBe("operations_audit_operator");
  });

  it("marks the sensitive MVP paths as protected", () => {
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/seed-demo");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/normalize");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/requests/:requestId/archive");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/drafts");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/from-document");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/:draftId/decision");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/:draftId/apply");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/:draftId/review-cards/:cardId");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/plans");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/specs/:specId/clarification-drafts");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/clarification-drafts/:draftId/decision");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/recipes/:recipeId/review");
    expect(isMinimalMvpProtectedPath("/v1/production/seed-demo")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/intake/specs/spec-1")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/intake/requests/request-1/archive")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/recipes/recipe-1/review")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/from-document")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/draft-1/decision")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/draft-1/apply")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/draft-1/review-cards/card-1")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/specs/spec-1/clarification-drafts")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/clarification-drafts/draft-1/decision")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/audit/events")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/public/ping")).toBe(false);
  });

  it("keeps role validation explicit", () => {
    expect(isMinimalMvpRole("intake_operator")).toBe(true);
    expect(isMinimalMvpRole("admin")).toBe(false);
    expect(MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES.offer_operator).toBe("Angebots-Mitarbeiter");
  });

  it("ignores freely set x-actor-name when a trusted actor secret is required", () => {
    expect(
      trustedActorFromHeaders(
        {
          "x-actor-name": "Produktions-Mitarbeiter"
        },
        {
          fallbackActorName: "Produktions-Mitarbeiter",
          trustedActorSecret: "shared-secret"
        }
      )
    ).toEqual({
      name: "Produktions-Mitarbeiter",
      source: "untrusted",
      trusted: false
    });
  });

  it("fails closed without trusted secret unless dev auth is explicitly enabled", () => {
    const defaultActor = trustedActorFromHeaders(
      {
        "x-actor-name": "Produktions-Mitarbeiter"
      },
      {
        fallbackActorName: "Produktions-Mitarbeiter"
      }
    );
    expect(defaultActor).toEqual({
      name: "Produktions-Mitarbeiter",
      source: "service-default",
      trusted: false
    });
    expect(resolveMinimalMvpRoleFromTrustedActor(defaultActor)).toBeUndefined();

    const devActor = trustedActorFromHeaders(
      {
        "x-actor-name": "Produktions-Mitarbeiter"
      },
      {
        fallbackActorName: "Produktions-Mitarbeiter",
        allowDevActorHeader: true
      }
    );
    expect(devActor).toEqual({
      name: "Produktions-Mitarbeiter",
      source: "dev-header:x-actor-name",
      trusted: false
    });
    expect(resolveMinimalMvpRoleFromTrustedActor(devActor)).toBe("production_operator");

    const devDefaultActor = trustedActorFromHeaders(
      {},
      {
        fallbackActorName: "Produktions-Mitarbeiter",
        allowDevActorHeader: true
      }
    );
    expect(devDefaultActor).toEqual({
      name: "Produktions-Mitarbeiter",
      source: "dev-default",
      trusted: false
    });
    expect(resolveMinimalMvpRoleFromTrustedActor(devDefaultActor)).toBe("production_operator");
  });

  it("accepts actor identity from the trusted proxy header when the shared secret matches", () => {
    expect(
      trustedActorFromHeaders(
        {
          "x-catering-actor-name": "Produktions-Mitarbeiter",
          "x-catering-trusted-secret": "shared-secret",
          "x-actor-name": "Angebots-Mitarbeiter"
        },
        {
          fallbackActorName: "Produktions-Mitarbeiter",
          trustedActorSecret: "shared-secret"
        }
      )
    ).toEqual({
      name: "Produktions-Mitarbeiter",
      source: "trusted-proxy:x-catering-actor-name",
      trusted: true
    });
  });
});
