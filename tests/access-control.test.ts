import { describe, expect, it } from "vitest";
import {
  isMinimalMvpProtectedPath,
  isMinimalMvpRole,
  hasMinimalMvpCapability,
  MINIMAL_MVP_PROTECTED_PATHS,
  MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES,
  MINIMAL_MVP_ROLE_LABELS,
  MINIMAL_MVP_ROLES,
  resolveMinimalMvpRoleFromActorName,
  resolveMinimalMvpRoleFromTrustedActor,
  trustedActorFromHeaders
} from "../shared-core/src/access-control.js";

describe("minimal MVP roles convention", () => {
  it("exposes the minimal MVP roles and their labels", () => {
    expect(MINIMAL_MVP_ROLES).toEqual([
      "intake_operator",
      "offer_operator",
      "production_operator",
      "operations_audit_operator",
      "read_only_operator",
      "admin"
    ]);
    expect(MINIMAL_MVP_ROLE_LABELS).toEqual({
      intake_operator: "Intake-Operator",
      offer_operator: "Angebots-Operator",
      production_operator: "Produktions-Operator",
      operations_audit_operator: "Betriebs-/Audit-Operator",
      read_only_operator: "Read-only-Operator",
      admin: "Administrator"
    });
  });

  it("resolves default actor names back to the minimal MVP roles", () => {
    expect(resolveMinimalMvpRoleFromActorName("Intake-Mitarbeiter")).toBe("intake_operator");
    expect(resolveMinimalMvpRoleFromActorName("Angebots-Mitarbeiter")).toBe("offer_operator");
    expect(resolveMinimalMvpRoleFromActorName("Produktions-Mitarbeiter")).toBe("production_operator");
    expect(resolveMinimalMvpRoleFromActorName("Betriebs-/Audit-Operator")).toBe("operations_audit_operator");
    expect(resolveMinimalMvpRoleFromActorName("Read-only-Mitarbeiter")).toBe("read_only_operator");
    expect(resolveMinimalMvpRoleFromActorName("Administrator")).toBe("admin");
    expect(resolveMinimalMvpRoleFromActorName("Mitarbeiter")).toBeUndefined();
  });

  it("normalizes surrounding whitespace and casing for all default actor names", () => {
    expect(resolveMinimalMvpRoleFromActorName("  intake-mitarbeiter  ")).toBe("intake_operator");
    expect(resolveMinimalMvpRoleFromActorName("  angebots-mitarbeiter  ")).toBe("offer_operator");
    expect(resolveMinimalMvpRoleFromActorName("  produktions-mitarbeiter  ")).toBe("production_operator");
    expect(resolveMinimalMvpRoleFromActorName("  betriebs-/audit-operator  ")).toBe("operations_audit_operator");
    expect(resolveMinimalMvpRoleFromActorName("  read-only-mitarbeiter  ")).toBe("read_only_operator");
  });

  it("marks the sensitive MVP paths as protected", () => {
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/seed-demo");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/normalize");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/shadow/normalize");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/requests/:requestId/archive");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/source-documents");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/source-documents/:documentId");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/intake/source-documents/:documentId/content");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/cases");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/cases/:caseId");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/cases/:caseId/copies");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/cases/:caseId/messages");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/drafts");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/cases");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/cases/:caseId");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/cases/:caseId/copies");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/cases/:caseId/messages");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/cases/from-handoff/:handoffId");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/from-document");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/:draftId/revise");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/:draftId/prepare");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/:draftId/decision");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/approved-specs/:approvedProductionSpecId/apply");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/drafts/:draftId/review-cards/:cardId");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/plans");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/specs/:specId/clarification-drafts");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/production/clarification-drafts/:draftId/decision");
    expect(MINIMAL_MVP_PROTECTED_PATHS).toContain("/v1/offers/recipes/:recipeId/review");
    expect(isMinimalMvpProtectedPath("/v1/production/seed-demo")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/intake/shadow/normalize")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/intake/specs/spec-1")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/intake/requests/request-1/archive")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/intake/source-documents/document-1/content")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/offers/cases/offer-case-1/messages")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/cases/production-case-1/copies")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/cases/from-handoff/handoff-1")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/recipes/recipe-1/review")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/from-document")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/draft-1/revise")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/draft-1/prepare")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/draft-1/decision")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/approved-specs/approved-1/apply")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/drafts/draft-1/review-cards/card-1")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/specs/spec-1/clarification-drafts")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/clarification-drafts/draft-1/decision")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/production/audit/events")).toBe(true);
    expect(isMinimalMvpProtectedPath("/v1/public/ping")).toBe(false);
  });

  it("keeps role validation explicit", () => {
    expect(isMinimalMvpRole("intake_operator")).toBe(true);
    expect(isMinimalMvpRole("admin")).toBe(true);
    expect(MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES.offer_operator).toBe("Angebots-Mitarbeiter");
  });

  it("gives the trusted Administrator every existing product capability", () => {
    const administrator = trustedActorFromHeaders(
      {
        "x-catering-actor-name": "Administrator",
        "x-catering-trusted-secret": "shared-secret"
      },
      {
        fallbackActorName: "Produktions-Mitarbeiter",
        fallbackBusinessId: "local",
        trustedActorSecret: "shared-secret"
      }
    );

    expect(resolveMinimalMvpRoleFromTrustedActor(administrator)).toBe("admin");
    expect(hasMinimalMvpCapability(administrator, "intake")).toBe(true);
    expect(hasMinimalMvpCapability(administrator, "offer")).toBe(true);
    expect(hasMinimalMvpCapability(administrator, "production")).toBe(true);
    expect(hasMinimalMvpCapability(administrator, "production_read")).toBe(true);
    expect(hasMinimalMvpCapability(administrator, "operations_audit")).toBe(true);
    expect(hasMinimalMvpCapability(administrator, "commercial")).toBe(true);

    const productionOperator = trustedActorFromHeaders(
      {
        "x-catering-actor-name": "Produktions-Mitarbeiter",
        "x-catering-trusted-secret": "shared-secret"
      },
      {
        fallbackActorName: "Produktions-Mitarbeiter",
        fallbackBusinessId: "local",
        trustedActorSecret: "shared-secret"
      }
    );
    expect(hasMinimalMvpCapability(productionOperator, "production")).toBe(true);
    expect(hasMinimalMvpCapability(productionOperator, "production_read")).toBe(true);
    expect(hasMinimalMvpCapability(productionOperator, "commercial")).toBe(false);

    const readOnlyOperator = trustedActorFromHeaders(
      {
        "x-catering-actor-name": "Read-only-Mitarbeiter",
        "x-catering-trusted-secret": "shared-secret"
      },
      {
        fallbackActorName: "Produktions-Mitarbeiter",
        fallbackBusinessId: "local",
        trustedActorSecret: "shared-secret"
      }
    );
    expect(resolveMinimalMvpRoleFromTrustedActor(readOnlyOperator)).toBe("read_only_operator");
    expect(hasMinimalMvpCapability(readOnlyOperator, "production_read")).toBe(true);
    expect(hasMinimalMvpCapability(readOnlyOperator, "production")).toBe(false);
    expect(hasMinimalMvpCapability(readOnlyOperator, "commercial")).toBe(false);
    expect(hasMinimalMvpCapability(readOnlyOperator, "intake")).toBe(false);
    expect(hasMinimalMvpCapability(readOnlyOperator, "offer")).toBe(false);
    expect(hasMinimalMvpCapability(readOnlyOperator, "operations_audit")).toBe(false);

    const offerOperator = trustedActorFromHeaders(
      {
        "x-catering-actor-name": "Angebots-Mitarbeiter",
        "x-catering-trusted-secret": "shared-secret"
      },
      {
        fallbackActorName: "Produktions-Mitarbeiter",
        fallbackBusinessId: "local",
        trustedActorSecret: "shared-secret"
      }
    );
    expect(hasMinimalMvpCapability(offerOperator, "commercial")).toBe(true);
  });

  it("ignores freely set x-actor-name when a trusted actor secret is required", () => {
    expect(
      trustedActorFromHeaders(
        {
          "x-actor-name": "Produktions-Mitarbeiter"
        },
        {
          fallbackActorName: "Produktions-Mitarbeiter",
          fallbackBusinessId: "local",
          trustedActorSecret: "shared-secret"
        }
      )
    ).toEqual({
      name: "Produktions-Mitarbeiter",
      businessId: "local",
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
        fallbackActorName: "Produktions-Mitarbeiter",
        fallbackBusinessId: "local"
      }
    );
    expect(defaultActor).toEqual({
      name: "Produktions-Mitarbeiter",
      businessId: "local",
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
        fallbackBusinessId: "local",
        allowDevActorHeader: true
      }
    );
    expect(devActor).toEqual({
      name: "Produktions-Mitarbeiter",
      businessId: "local",
      source: "dev-header:x-actor-name",
      trusted: false
    });
    expect(resolveMinimalMvpRoleFromTrustedActor(devActor)).toBe("production_operator");

    const devDefaultActor = trustedActorFromHeaders(
      {},
      {
        fallbackActorName: "Produktions-Mitarbeiter",
        fallbackBusinessId: "local",
        allowDevActorHeader: true
      }
    );
    expect(devDefaultActor).toEqual({
      name: "Produktions-Mitarbeiter",
      businessId: "local",
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
          "x-catering-business-id": "alpha",
          "x-catering-trusted-secret": "shared-secret",
          "x-actor-name": "Angebots-Mitarbeiter"
        },
        {
          fallbackActorName: "Produktions-Mitarbeiter",
          fallbackBusinessId: "local",
          trustedActorSecret: "shared-secret"
        }
      )
    ).toEqual({
      name: "Produktions-Mitarbeiter",
      businessId: "alpha",
      source: "trusted-proxy:x-catering-actor-name",
      trusted: true
    });
  });

  it("rejects a hosted request without a trusted business header", () => {
    expect(() => trustedActorFromHeaders({}, {
      fallbackActorName: "Operator",
      fallbackBusinessId: "local",
      requireTrustedBusinessId: true,
      trustedActorSecret: "secret"
    })).toThrow("Vertrauenswürdiger Betriebskontext erforderlich");
  });
});
