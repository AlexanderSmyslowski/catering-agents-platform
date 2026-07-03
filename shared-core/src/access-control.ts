export const MINIMAL_MVP_ROLES = [
  "intake_operator",
  "offer_operator",
  "production_operator",
  "operations_audit_operator"
] as const;

export type MinimalMvpRole = (typeof MINIMAL_MVP_ROLES)[number];

export interface TrustedActor {
  name: string;
  source:
    | "trusted-proxy:x-catering-actor-name"
    | "dev-header:x-actor-name"
    | "dev-default"
    | "service-default"
    | "untrusted";
  trusted: boolean;
}

export interface TrustedActorOptions {
  fallbackActorName: string;
  trustedActorSecret?: string;
  allowDevActorHeader?: boolean;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export const MINIMAL_MVP_ROLE_LABELS: Record<MinimalMvpRole, string> = {
  intake_operator: "Intake-Operator",
  offer_operator: "Angebots-Operator",
  production_operator: "Produktions-Operator",
  operations_audit_operator: "Betriebs-/Audit-Operator"
};

export const MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES: Record<MinimalMvpRole, string> = {
  intake_operator: "Intake-Mitarbeiter",
  offer_operator: "Angebots-Mitarbeiter",
  production_operator: "Produktions-Mitarbeiter",
  operations_audit_operator: "Betriebs-/Audit-Operator"
};

export const MINIMAL_MVP_PROTECTED_PATHS = [
  "/v1/intake/normalize",
  "/v1/intake/documents",
  "/v1/intake/documents/upload",
  "/v1/intake/shadow/normalize",
  "/v1/intake/requests",
  "/v1/intake/requests/:requestId",
  "/v1/intake/requests/:requestId/archive",
  "/v1/intake/specs",
  "/v1/intake/specs/manual",
  "/v1/intake/specs/:specId",
  "/v1/intake/seed-demo",
  "/v1/offers/drafts",
  "/v1/offers/drafts/:draftId",
  "/v1/offers/from-text",
  "/v1/offers/recipes",
  "/v1/offers/recipes/:recipeId",
  "/v1/offers/recipes/import-text",
  "/v1/offers/recipes/upload",
  "/v1/offers/seed-demo",
  "/v1/production/drafts",
  "/v1/production/drafts/from-document",
  "/v1/production/drafts/:draftId/decision",
  "/v1/production/drafts/:draftId/apply",
  "/v1/production/drafts/:draftId/review-cards/:cardId",
  "/v1/production/feedback-drafts",
  "/v1/production/feedback-drafts/:feedbackId/decision",
  "/v1/production/knowledge/production-feedback",
  "/v1/production/plans",
  "/v1/production/plans/:planId",
  "/v1/production/purchase-lists",
  "/v1/production/purchase-lists/:purchaseListId",
  "/v1/production/specs/:specId/clarification-drafts",
  "/v1/production/clarification-drafts/:draftId/decision",
  "/v1/production/recipes",
  "/v1/production/recipes/:recipeId",
  "/v1/production/recipes/import-text",
  "/v1/production/recipes/upload",
  "/v1/production/seed-demo",
  "/v1/intake/spec-governance/finalize",
  "/v1/offers/recipes/:recipeId/review",
  "/v1/production/recipes/:recipeId/review",
  "/v1/production/audit/events",
  "/v1/exports/offers/:draftId/html",
  "/v1/exports/production-plans/:planId/html",
  "/v1/exports/purchase-lists/:purchaseListId/csv"
] as const;

const PROTECTED_PATH_TEMPLATES = [
  "/v1/intake/normalize",
  "/v1/intake/documents",
  "/v1/intake/documents/upload",
  "/v1/intake/shadow/normalize",
  "/v1/intake/requests",
  "/v1/intake/requests/:requestId",
  "/v1/intake/requests/:requestId/archive",
  "/v1/intake/specs",
  "/v1/intake/specs/manual",
  "/v1/intake/specs/:specId",
  "/v1/intake/seed-demo",
  "/v1/offers/drafts",
  "/v1/offers/drafts/:draftId",
  "/v1/offers/from-text",
  "/v1/offers/recipes",
  "/v1/offers/recipes/:recipeId",
  "/v1/offers/recipes/import-text",
  "/v1/offers/recipes/upload",
  "/v1/offers/seed-demo",
  "/v1/production/drafts",
  "/v1/production/drafts/from-document",
  "/v1/production/drafts/:draftId/decision",
  "/v1/production/drafts/:draftId/apply",
  "/v1/production/drafts/:draftId/review-cards/:cardId",
  "/v1/production/feedback-drafts",
  "/v1/production/feedback-drafts/:feedbackId/decision",
  "/v1/production/knowledge/production-feedback",
  "/v1/production/plans",
  "/v1/production/plans/:planId",
  "/v1/production/purchase-lists",
  "/v1/production/purchase-lists/:purchaseListId",
  "/v1/production/specs/:specId/clarification-drafts",
  "/v1/production/clarification-drafts/:draftId/decision",
  "/v1/production/recipes",
  "/v1/production/recipes/:recipeId",
  "/v1/production/recipes/import-text",
  "/v1/production/recipes/upload",
  "/v1/production/seed-demo",
  "/v1/intake/spec-governance/finalize",
  "/v1/offers/recipes/:recipeId/review",
  "/v1/production/recipes/:recipeId/review",
  "/v1/production/audit/events",
  "/v1/exports/offers/:draftId/html",
  "/v1/exports/production-plans/:planId/html",
  "/v1/exports/purchase-lists/:purchaseListId/csv"
] as const;

// Canonicalize operator labels so the shared default actor names remain stable across caller formatting.
function normalizeActorName(value: string): string {
  return value.trim().toLowerCase();
}

function pathMatchesProtectedTemplate(path: string, template: string): boolean {
  const pathSegments = path.split("/").filter(Boolean);
  const templateSegments = template.split("/").filter(Boolean);

  if (pathSegments.length !== templateSegments.length) {
    return false;
  }

  return templateSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
}

export function isMinimalMvpRole(value: string): value is MinimalMvpRole {
  return MINIMAL_MVP_ROLES.includes(value as MinimalMvpRole);
}

export function resolveMinimalMvpRoleFromActorName(actorName: string): MinimalMvpRole | undefined {
  const normalizedActorName = normalizeActorName(actorName);

  for (const [role, defaultActorName] of Object.entries(MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES) as Array<
    [MinimalMvpRole, string]
  >) {
    if (normalizeActorName(defaultActorName) === normalizedActorName) {
      return role;
    }
  }

  return undefined;
}

export function trustedActorFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  options: TrustedActorOptions
): TrustedActor {
  const expectedSecret = options.trustedActorSecret?.trim();
  const trustedSecret = firstHeaderValue(headers["x-catering-trusted-secret"])?.trim();
  const trustedActorName = firstHeaderValue(headers["x-catering-actor-name"])?.trim();

  if (expectedSecret && trustedSecret === expectedSecret && trustedActorName) {
    return {
      name: trustedActorName,
      source: "trusted-proxy:x-catering-actor-name",
      trusted: true
    };
  }

  const devActorName = firstHeaderValue(headers["x-actor-name"])?.trim();
  if (!expectedSecret && options.allowDevActorHeader === true && devActorName) {
    return {
      name: devActorName,
      source: "dev-header:x-actor-name",
      trusted: false
    };
  }

  if (expectedSecret) {
    return {
      name: options.fallbackActorName,
      source: "untrusted",
      trusted: false
    };
  }

  if (options.allowDevActorHeader === true) {
    return {
      name: options.fallbackActorName,
      source: "dev-default",
      trusted: false
    };
  }

  return {
    name: options.fallbackActorName,
    source: "service-default",
    trusted: false
  };
}

export function resolveMinimalMvpRoleFromTrustedActor(actor: TrustedActor): MinimalMvpRole | undefined {
  if (!actor.trusted && actor.source !== "dev-header:x-actor-name" && actor.source !== "dev-default") {
    return undefined;
  }

  return resolveMinimalMvpRoleFromActorName(actor.name);
}

export function isDevAuthEnabled(env: Record<string, string | undefined>): boolean {
  const value = env.CATERING_DEV_AUTH?.trim().toLowerCase();
  return value === "1" || value === "true";
}

export function isMinimalMvpProtectedPath(path: string): boolean {
  return PROTECTED_PATH_TEMPLATES.some((template) => pathMatchesProtectedTemplate(path, template));
}
