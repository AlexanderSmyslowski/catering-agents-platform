export type DataSafetyService =
  | "intake-service"
  | "offer-service"
  | "production-service"
  | "print-export"
  | "shared-core";

export type DataSafetyScope =
  | "synthetic_demo"
  | "operator_supplied_internal"
  | "uploaded_internal"
  | "read_only_evidence"
  | "synthetic_or_demo_only";

export type ExternalExposure = "none" | "disabled_by_default" | "blocked_until_decision";

export type ProductApprovalEffect = "none" | "draft_only" | "product_mutation";

export interface DataIngressPath {
  id: string;
  service: DataSafetyService;
  route?: string;
  source: string;
  scope: DataSafetyScope;
  externalExposure: ExternalExposure;
  requiredGate: string;
}

export interface AuditEvidencePath {
  id: string;
  service: DataSafetyService;
  route?: string;
  action?: string;
  evidenceKind: "audit_event" | "handoff" | "export" | "recipe_trace" | "llm_audit_record";
  readOnlyEvidence: boolean;
  productApprovalEffect: ProductApprovalEffect;
  requiredRole?: string;
}

export interface ExternalBoundaryGate {
  id: string;
  service: DataSafetyService;
  boundary: "llm_provider" | "web_recipe_search";
  defaultState: "disabled";
  enablementGate: string;
  allowedDataScope: DataSafetyScope;
  writeEffectsAllowed: false;
}

export const dataIngressPaths = [
  {
    id: "manual_intake",
    service: "intake-service",
    route: "POST /v1/intake/normalize",
    source: "operator text or EventRequest",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "intake_operator auth"
  },
  {
    id: "manual_spec",
    service: "intake-service",
    route: "POST /v1/intake/specs/manual",
    source: "operator manual form",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "intake_operator auth"
  },
  {
    id: "document_upload",
    service: "intake-service",
    route: "POST /v1/intake/documents and POST /v1/intake/documents/upload",
    source: "operator supplied document upload",
    scope: "uploaded_internal",
    externalExposure: "none",
    requiredGate: "intake_operator auth and upload validation"
  },
  {
    id: "seed_demo",
    service: "intake-service",
    route: "POST /v1/intake/seed-demo",
    source: "built-in demo fixtures",
    scope: "synthetic_demo",
    externalExposure: "none",
    requiredGate: "operations_audit_operator auth"
  },
  {
    id: "offer_draft_creation",
    service: "offer-service",
    route: "POST /v1/offers/drafts and POST /v1/offers/from-text",
    source: "EventRequest or operator offer text",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "offer_operator auth"
  },
  {
    id: "offer_recipe_upload",
    service: "offer-service",
    route: "POST /v1/offers/recipes/import-text and POST /v1/offers/recipes/upload",
    source: "operator supplied recipe text or file",
    scope: "uploaded_internal",
    externalExposure: "none",
    requiredGate: "offer_operator auth and upload validation"
  },
  {
    id: "production_plan_creation",
    service: "production-service",
    route: "POST /v1/production/plans",
    source: "AcceptedEventSpec",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "production_operator auth"
  },
  {
    id: "production_recipe_upload",
    service: "production-service",
    route: "POST /v1/production/recipes/import-text and POST /v1/production/recipes/upload",
    source: "operator supplied recipe text or file",
    scope: "uploaded_internal",
    externalExposure: "none",
    requiredGate: "production_operator auth and upload validation"
  },
  {
    id: "export_read",
    service: "print-export",
    route: "GET /v1/exports/*",
    source: "stored offer, production plan, or purchase list",
    scope: "read_only_evidence",
    externalExposure: "none",
    requiredGate: "offer_operator or production_operator auth"
  },
  {
    id: "llm_readiness_draft",
    service: "shared-core",
    source: "schema-only LLM readiness fixtures and source refs",
    scope: "synthetic_or_demo_only",
    externalExposure: "blocked_until_decision",
    requiredGate: "providerCalls disabled and no product writes"
  },
  {
    id: "web_recipe_search",
    service: "production-service",
    source: "recipe discovery query",
    scope: "operator_supplied_internal",
    externalExposure: "disabled_by_default",
    requiredGate: "CATERING_ENABLE_WEB_RECIPE_SEARCH explicit opt-in"
  }
] as const satisfies readonly DataIngressPath[];

export const auditEvidencePaths = [
  {
    id: "intake_normalized",
    service: "intake-service",
    route: "POST /v1/intake/normalize",
    action: "intake.normalized",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "intake_operator"
  },
  {
    id: "intake_documents_normalized",
    service: "intake-service",
    route: "POST /v1/intake/documents",
    action: "intake.documents_normalized",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "intake_operator"
  },
  {
    id: "intake_soft_archive",
    service: "intake-service",
    route: "POST /v1/intake/requests/:requestId/archive",
    action: "intake.request_soft_archived",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "intake_operator"
  },
  {
    id: "offer_draft_created",
    service: "offer-service",
    route: "POST /v1/offers/drafts",
    action: "offer.draft_created",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "offer_operator"
  },
  {
    id: "offer_promoted_variant",
    service: "offer-service",
    route: "POST /v1/offers/drafts/:draftId/promote",
    action: "offer.promoted_variant",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "offer_operator"
  },
  {
    id: "production_plan_created",
    service: "production-service",
    route: "POST /v1/production/plans",
    action: "production.plan_created",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "production_operator"
  },
  {
    id: "recipe_reviewed",
    service: "production-service",
    route: "PATCH /v1/production/recipes/:recipeId/review",
    action: "recipe.reviewed",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "production_operator"
  },
  {
    id: "offer_html_export",
    service: "print-export",
    route: "GET /v1/exports/offers/:draftId/html",
    evidenceKind: "export",
    readOnlyEvidence: true,
    productApprovalEffect: "none",
    requiredRole: "offer_operator"
  },
  {
    id: "production_plan_html_export",
    service: "print-export",
    route: "GET /v1/exports/production-plans/:planId/html",
    evidenceKind: "export",
    readOnlyEvidence: true,
    productApprovalEffect: "none",
    requiredRole: "production_operator"
  },
  {
    id: "purchase_list_csv_export",
    service: "print-export",
    route: "GET /v1/exports/purchase-lists/:purchaseListId/csv",
    evidenceKind: "export",
    readOnlyEvidence: true,
    productApprovalEffect: "none",
    requiredRole: "production_operator"
  },
  {
    id: "llm_readiness_agent_audit",
    service: "shared-core",
    action: "llm-readiness-agent-audit-v0",
    evidenceKind: "llm_audit_record",
    readOnlyEvidence: true,
    productApprovalEffect: "none"
  }
] as const satisfies readonly AuditEvidencePath[];

export const externalBoundaryGates = [
  {
    id: "llm_provider_gate",
    service: "shared-core",
    boundary: "llm_provider",
    defaultState: "disabled",
    enablementGate: "LLM readiness policy requires providerCalls disabled",
    allowedDataScope: "synthetic_or_demo_only",
    writeEffectsAllowed: false
  },
  {
    id: "web_recipe_search_gate",
    service: "production-service",
    boundary: "web_recipe_search",
    defaultState: "disabled",
    enablementGate: "CATERING_ENABLE_WEB_RECIPE_SEARCH must be 1 or true",
    allowedDataScope: "operator_supplied_internal",
    writeEffectsAllowed: false
  }
] as const satisfies readonly ExternalBoundaryGate[];

export function dataIngressPathById(id: string): DataIngressPath | undefined {
  return dataIngressPaths.find((path) => path.id === id);
}

export function auditEvidencePathById(id: string): AuditEvidencePath | undefined {
  return auditEvidencePaths.find((path) => path.id === id);
}

export function externalBoundaryGateById(id: string): ExternalBoundaryGate | undefined {
  return externalBoundaryGates.find((gate) => gate.id === id);
}
