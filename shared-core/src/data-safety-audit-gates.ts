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
  | "synthetic_or_demo_only"
  | "pseudonymized_approved";

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
  additionalAllowedDataScopes?: readonly DataSafetyScope[];
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
    id: "intake_seed_demo",
    service: "intake-service",
    route: "POST /v1/intake/seed-demo",
    source: "built-in demo fixtures",
    scope: "synthetic_demo",
    externalExposure: "none",
    requiredGate: "operations_audit_operator auth"
  },
  {
    id: "intake_shadow_extraction",
    service: "intake-service",
    route: "POST /v1/intake/shadow/normalize",
    source: "synthetic/demo or anonymized reference text and BYO-LLM draft adapter",
    scope: "synthetic_or_demo_only",
    externalExposure: "blocked_until_decision",
    requiredGate: "intake_operator auth, explicit safe safetyMode, explicit CATERING_SYNTHETIC_LLM_SLICE opt-in, no product writes, no raw prompt/response persistence"
  },
  {
    id: "intake_archive_request",
    service: "intake-service",
    route: "POST /v1/intake/requests/:requestId/archive",
    source: "operator archive decision",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "intake_operator auth"
  },
  {
    id: "intake_spec_update",
    service: "intake-service",
    route: "PATCH /v1/intake/specs/:specId",
    source: "operator spec correction",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "intake_operator auth"
  },
  {
    id: "intake_spec_governance_finalize",
    service: "intake-service",
    route: "POST /v1/intake/spec-governance/finalize",
    source: "operator governance finalization decision",
    scope: "operator_supplied_internal",
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
    id: "offer_variant_promotion",
    service: "offer-service",
    route: "POST /v1/offers/drafts/:draftId/promote",
    source: "operator selected offer variant",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "offer_operator auth"
  },
  {
    id: "offer_seed_demo",
    service: "offer-service",
    route: "POST /v1/offers/seed-demo",
    source: "built-in demo fixtures",
    scope: "synthetic_demo",
    externalExposure: "none",
    requiredGate: "operations_audit_operator auth"
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
    id: "production_draft_import",
    service: "production-service",
    route: "POST /v1/production/drafts",
    source: "validated ProductionDraft",
    scope: "uploaded_internal",
    externalExposure: "blocked_until_decision",
    requiredGate: "production_operator auth, validateProductionDraft, pending_review only, no product writes"
  },
  {
    id: "production_draft_document_extraction",
    service: "production-service",
    route: "POST /v1/production/drafts/from-document",
    source: "operator-approved anonymized document and BYO-LLM draft adapter",
    scope: "synthetic_or_demo_only",
    externalExposure: "blocked_until_decision",
    requiredGate: "production_operator auth, PA54-approved source, explicit CATERING_SYNTHETIC_LLM_SLICE opt-in, draft-only, no raw prompt/response persistence"
  },
  {
    id: "production_draft_review_card_decision",
    service: "production-service",
    route: "PATCH /v1/production/drafts/:draftId/review-cards/:cardId",
    source: "operator ProductionDraft review-card decision",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "production_operator auth, pending_review draft only, no product writes"
  },
  {
    id: "production_draft_decision",
    service: "production-service",
    route: "POST /v1/production/drafts/:draftId/decision",
    source: "operator ProductionDraft approve/reject decision",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "production_operator auth, explicit approve/reject, no product writes"
  },
  {
    id: "production_draft_apply",
    service: "production-service",
    route: "POST /v1/production/drafts/:draftId/apply",
    source: "operator ProductionDraft takeover decision",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "production_operator auth, approved draft only, conflict check before product writes, recipes stay review_required"
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
    id: "production_clarification_draft",
    service: "production-service",
    route: "POST /v1/production/specs/:specId/clarification-drafts",
    source: "AcceptedEventSpec and BYO-LLM draft adapter",
    scope: "operator_supplied_internal",
    externalExposure: "blocked_until_decision",
    requiredGate: "production_operator auth, fixture-only default or explicit CATERING_SYNTHETIC_LLM_SLICE opt-in, human review before product write"
  },
  {
    id: "production_clarification_draft_decision",
    service: "production-service",
    route: "POST /v1/production/clarification-drafts/:draftId/decision",
    source: "operator clarification draft approval decision",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "production_operator auth and explicit approve/reject"
  },
  {
    id: "production_recipe_review",
    service: "production-service",
    route: "PATCH /v1/production/recipes/:recipeId/review",
    source: "operator recipe review decision",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "production_operator auth"
  },
  {
    id: "offer_recipe_review",
    service: "offer-service",
    route: "PATCH /v1/offers/recipes/:recipeId/review",
    source: "operator recipe review decision",
    scope: "operator_supplied_internal",
    externalExposure: "none",
    requiredGate: "offer_operator auth"
  },
  {
    id: "production_seed_demo",
    service: "production-service",
    route: "POST /v1/production/seed-demo",
    source: "built-in demo fixtures",
    scope: "synthetic_demo",
    externalExposure: "none",
    requiredGate: "operations_audit_operator auth"
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
    id: "offer_package_batch_pilot",
    service: "shared-core",
    source: "pseudonymized approved offer text batch for package classification pilot or human-approved full batch",
    scope: "pseudonymized_approved",
    externalExposure: "blocked_until_decision",
    requiredGate: "human-approved pseudonymization, explicit full-run opt-in above 20 offers, budget/request cap, no raw prompt/response persistence"
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
    id: "intake_manual_spec_created",
    service: "intake-service",
    route: "POST /v1/intake/specs/manual",
    action: "intake.manual_spec_created",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "intake_operator"
  },
  {
    id: "intake_spec_updated",
    service: "intake-service",
    route: "PATCH /v1/intake/specs/:specId",
    action: "intake.spec_updated",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "intake_operator"
  },
  {
    id: "intake_spec_governance_finalized",
    service: "intake-service",
    route: "POST /v1/intake/spec-governance/finalize",
    action: "intake.spec_governance_finalized",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "operations_audit_operator"
  },
  {
    id: "intake_seed_demo",
    service: "intake-service",
    route: "POST /v1/intake/seed-demo",
    action: "intake.seed_demo",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "operations_audit_operator"
  },
  {
    id: "intake_shadow_extraction_compared",
    service: "intake-service",
    route: "POST /v1/intake/shadow/normalize",
    action: "intake.shadow_extraction_compared",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "none",
    requiredRole: "intake_operator"
  },
  {
    id: "intake_shadow_extraction_rejected",
    service: "intake-service",
    route: "POST /v1/intake/shadow/normalize",
    action: "intake.shadow_extraction_rejected",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "none",
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
    id: "offer_draft_created_from_text",
    service: "offer-service",
    route: "POST /v1/offers/from-text",
    action: "offer.draft_created_from_text",
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
    id: "offer_seed_demo",
    service: "offer-service",
    route: "POST /v1/offers/seed-demo",
    action: "offer.seed_demo",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "operations_audit_operator"
  },
  {
    id: "offer_recipe_imported_text",
    service: "offer-service",
    route: "POST /v1/offers/recipes/import-text",
    action: "recipe.imported_text",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "offer_operator"
  },
  {
    id: "offer_recipe_uploaded_file",
    service: "offer-service",
    route: "POST /v1/offers/recipes/upload",
    action: "recipe.uploaded_file",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "offer_operator"
  },
  {
    id: "offer_recipe_reviewed",
    service: "offer-service",
    route: "PATCH /v1/offers/recipes/:recipeId/review",
    action: "recipe.reviewed",
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
    id: "production_draft_imported",
    service: "production-service",
    route: "POST /v1/production/drafts",
    action: "production.production_draft_imported",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "production_operator"
  },
  {
    id: "production_draft_document_created",
    service: "production-service",
    route: "POST /v1/production/drafts/from-document",
    action: "production.production_draft_document_created",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "production_operator"
  },
  {
    id: "production_draft_document_rejected",
    service: "production-service",
    route: "POST /v1/production/drafts/from-document",
    action: "production.production_draft_document_rejected",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "none",
    requiredRole: "production_operator"
  },
  {
    id: "production_draft_review_card_decided",
    service: "production-service",
    route: "PATCH /v1/production/drafts/:draftId/review-cards/:cardId",
    action: "production.production_draft_review_card_decided",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "production_operator"
  },
  {
    id: "production_draft_approved",
    service: "production-service",
    route: "POST /v1/production/drafts/:draftId/decision",
    action: "production.production_draft_approved",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "production_operator"
  },
  {
    id: "production_draft_rejected",
    service: "production-service",
    route: "POST /v1/production/drafts/:draftId/decision",
    action: "production.production_draft_rejected",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "production_operator"
  },
  {
    id: "production_draft_applied",
    service: "production-service",
    route: "POST /v1/production/drafts/:draftId/apply",
    action: "production.production_draft_applied",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "production_operator"
  },
  {
    id: "production_seed_demo",
    service: "production-service",
    route: "POST /v1/production/seed-demo",
    action: "production.seed_demo",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "operations_audit_operator"
  },
  {
    id: "production_clarification_draft_created",
    service: "production-service",
    route: "POST /v1/production/specs/:specId/clarification-drafts",
    action: "production.clarification_draft_created",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "production_operator"
  },
  {
    id: "production_clarification_draft_rejected",
    service: "production-service",
    route: "POST /v1/production/specs/:specId/clarification-drafts",
    action: "production.clarification_draft_rejected",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "none",
    requiredRole: "production_operator"
  },
  {
    id: "production_clarification_draft_approved",
    service: "production-service",
    route: "POST /v1/production/clarification-drafts/:draftId/decision",
    action: "production.clarification_draft_approved",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "production_operator"
  },
  {
    id: "production_clarification_draft_rejected_by_operator",
    service: "production-service",
    route: "POST /v1/production/clarification-drafts/:draftId/decision",
    action: "production.clarification_draft_rejected_by_operator",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "draft_only",
    requiredRole: "production_operator"
  },
  {
    id: "production_recipe_imported_text",
    service: "production-service",
    route: "POST /v1/production/recipes/import-text",
    action: "recipe.imported_text",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "production_operator"
  },
  {
    id: "production_recipe_uploaded_file",
    service: "production-service",
    route: "POST /v1/production/recipes/upload",
    action: "recipe.uploaded_file",
    evidenceKind: "audit_event",
    readOnlyEvidence: true,
    productApprovalEffect: "product_mutation",
    requiredRole: "production_operator"
  },
  {
    id: "production_recipe_reviewed",
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
    id: "production_folder_html_export",
    service: "print-export",
    route: "GET /v1/exports/production-folders/:planId/html",
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
    enablementGate: "CATERING_SYNTHETIC_LLM_SLICE explicit opt-in plus providerCalls disabled and synthetic/demo or pseudonymized-approved data policy",
    allowedDataScope: "synthetic_or_demo_only",
    additionalAllowedDataScopes: ["pseudonymized_approved"],
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
