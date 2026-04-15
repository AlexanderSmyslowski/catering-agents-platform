export const MINIMAL_MVP_ROLES = [
    "intake_operator",
    "offer_operator",
    "production_operator",
    "operations_audit_operator"
];
export const MINIMAL_MVP_ROLE_LABELS = {
    intake_operator: "Intake-Operator",
    offer_operator: "Angebots-Operator",
    production_operator: "Produktions-Operator",
    operations_audit_operator: "Betriebs-/Audit-Operator"
};
export const MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES = {
    intake_operator: "Intake-Mitarbeiter",
    offer_operator: "Angebots-Mitarbeiter",
    production_operator: "Produktions-Mitarbeiter",
    operations_audit_operator: "Betriebs-/Audit-Operator"
};
export const MINIMAL_MVP_PROTECTED_PATHS = [
    "/v1/intake/seed-demo",
    "/v1/offers/seed-demo",
    "/v1/production/seed-demo",
    "/v1/intake/spec-governance/finalize",
    "/v1/offers/recipes/:recipeId/review",
    "/v1/production/recipes/:recipeId/review",
    "/v1/production/audit/events"
];
const PROTECTED_PATH_PREFIXES = [
    "/v1/intake/seed-demo",
    "/v1/offers/seed-demo",
    "/v1/production/seed-demo",
    "/v1/intake/spec-governance/finalize",
    "/v1/offers/recipes/",
    "/v1/production/recipes/",
    "/v1/production/audit/events"
];
function normalizeActorName(value) {
    return value.trim().toLowerCase();
}
export function isMinimalMvpRole(value) {
    return MINIMAL_MVP_ROLES.includes(value);
}
export function resolveMinimalMvpRoleFromActorName(actorName) {
    const normalizedActorName = normalizeActorName(actorName);
    for (const [role, defaultActorName] of Object.entries(MINIMAL_MVP_ROLE_DEFAULT_ACTOR_NAMES)) {
        if (normalizeActorName(defaultActorName) === normalizedActorName) {
            return role;
        }
    }
    return undefined;
}
export function isMinimalMvpProtectedPath(path) {
    return PROTECTED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}
