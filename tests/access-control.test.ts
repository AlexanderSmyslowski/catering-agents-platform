import { describe, expect, it } from "vitest";
import {
  isMinimalMvpProtectedPath,
  isMinimalMvpRole,
  MINIMAL_MVP_PROTECTED_PATHS,
  MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES,
  MINIMAL_MVP_ROLE_LABELS,
  MINIMAL_MVP_ROLES,
  resolveMinimalMvpRoleFromActorName
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
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/recipes/:recipeId/review");
    expect(isMinimalMvpProtectedPath("/v1/production/seed-demo")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/recipes/recipe-1/review")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/audit/events")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/public/ping")).toBe(false);
  });

  it("keeps role validation explicit", () => {
    expect(isMinimalMvpRole("intake_operator")).toBe(true);
    expect(isMinimalMvpRole("admin")).toBe(false);
    expect(MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES.offer_operator).toBe("Angebots-Mitarbeiter");
  });
});
