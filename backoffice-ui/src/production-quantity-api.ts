export type ProductionQuantityWorkflowEdit =
  | { origin: "target_output"; perUnitAmount: number; unit: string }
  | { origin: "purchase_ingredient"; ingredientId: string; amount: number; unit: string };

export interface ProductionQuantityWorkflowPurchaseRow {
  rowId: string;
  articleName: string;
  amount: number;
  unit: string;
  editable: boolean;
  readOnlyReason?: string;
  lineage?: { eventSpecId: string; componentId: string; recipeId: string; ingredientId: string };
}

export interface ProductionQuantityWorkflowItem {
  componentId: string;
  label: string;
  status: "recommended" | "evidence_insufficient" | "conflicting_evidence" | "invalid_input";
  recommendedAmount?: number;
  unit?: string;
  professionalRange?: { min: number; max: number; unit: string };
  targetTotal?: { amount: number; unit: string };
  rationale?: string;
  evidenceReferences: string[];
  currentAuthority?: { perUnitAmount?: number; targetAmount: number; unit: string; reviewStatus: string };
  canEdit: boolean;
  reviewMessage?: string;
  purchaseRows: ProductionQuantityWorkflowPurchaseRow[];
  sourceRevision: string;
}

export interface ProductionQuantityWorkflowPreview {
  status: "preview_ready" | "blocked";
  confirmable: boolean;
  issues?: string[];
  editOrigin?: "target_output" | "purchase_ingredient";
  previousValue?: { amount: number; unit: string };
  requestedValue?: { amount: number; unit: string };
  resultingTarget?: { amount: number; unit: string };
  scaleFactor?: number;
  recipeChanges?: Array<{ ingredientId: string; name: string; baselineAmount: number; effectiveAmount: number; unit: string }>;
  purchaseChanges?: Array<{ ingredientId: string; name: string; baselineAmount: number; effectiveAmount: number; unit: string }>;
  appliedRuleIds?: string[];
  relevantCandidateRuleIds?: string[];
  nonlinearIssues?: string[];
}

export interface ProductionQuantityWorkflowPreviewResponse {
  previewId: string;
  sourceRevision: string;
  preview: ProductionQuantityWorkflowPreview;
}

export interface ProductionQuantityWorkflowConfirmResponse {
  status: "review_required" | "regenerated";
}

function actorHeaders(): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("x-actor-name", "Produktions-Mitarbeiter");
  return headers;
}

async function fetchQuantityJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: actorHeaders() });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
  return response.json() as Promise<T>;
}

export function fetchProductionQuantityWorkflow(caseId: string) {
  return fetchQuantityJson<{ items: ProductionQuantityWorkflowItem[] }>(
    `/api/production/v1/production/cases/${encodeURIComponent(caseId)}/quantity-workflow`
  );
}

export function previewProductionQuantityOverride(caseId: string, componentId: string, edit: ProductionQuantityWorkflowEdit) {
  return fetchQuantityJson<ProductionQuantityWorkflowPreviewResponse>(
    `/api/production/v1/production/cases/${encodeURIComponent(caseId)}/quantity-workflow/${encodeURIComponent(componentId)}/preview`,
    { method: "POST", body: JSON.stringify({ edit }) }
  );
}

export function confirmProductionQuantityOverride(caseId: string, componentId: string, previewId: string, edit: ProductionQuantityWorkflowEdit) {
  return fetchQuantityJson<ProductionQuantityWorkflowConfirmResponse>(
    `/api/production/v1/production/cases/${encodeURIComponent(caseId)}/quantity-workflow/${encodeURIComponent(componentId)}/confirm`,
    { method: "POST", body: JSON.stringify({ previewId, edit }) }
  );
}
