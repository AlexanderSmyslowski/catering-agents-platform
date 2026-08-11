import type { DocumentIngestionStatus, DocumentIngestionWarning } from "./document-ingestion.js";
import type { MinimalMvpRole, TrustedActor } from "./access-control.js";
import type { BusinessId } from "./business-context.js";
import type { ByoLlmDataClass } from "./data-classification.js";
import type { ByoLlmProcessingPolicyMetadata } from "./byo-llm-provider-data-policy.js";

export const SCHEMA_VERSION = "1.0.0";

export type ApprovalTargetKind = "offer_draft" | "production_draft";

export interface ApprovalRequestRecord {
  schemaVersion: "1.0";
  approvalRequestId: string;
  businessId: BusinessId;
  target: {
    kind: ApprovalTargetKind;
    artifactId: string;
    revision: number;
  };
  decision: "approved" | "rejected";
  selectedVariantId?: string;
  requestedAt: string;
  decidedAt: string;
  decidedBy: {
    name: string;
    role: MinimalMvpRole;
    source: TrustedActor["source"];
  };
  comment?: string;
}

export type ReadinessStatus = "complete" | "partial" | "insufficient";
export type CustomerSegment = "company" | "university" | "public" | "private" | "unknown";
export type CommercialState = "quoted" | "accepted" | "manual" | "provisional";
export type RecipeTier =
  | "internal_verified"
  | "digitized_cookbook"
  | "internal_approved"
  | "internet_fallback";
export type RecipeApprovalState =
  | "approved_internal"
  | "auto_usable"
  | "review_required"
  | "rejected";
export type RecipeReviewDecision = "approve" | "verify" | "reject";
export type OperationalArchiveReasonCode =
  | "wrong_upload"
  | "duplicate_test_data"
  | "operator_rehearsal_cleanup";

export interface OperationalArchiveState {
  status: "archived";
  mode: "soft_archive";
  reasonCode: OperationalArchiveReasonCode;
  archivedAt: string;
  archivedBy: string;
}

export interface AuditEntry {
  auditId: string;
  businessId: string;
  at: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: {
    name: string;
    source: string;
  };
  summary: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface Quantity {
  amount: number;
  unit: string;
  approx?: boolean;
}

export interface Evidence {
  kind: "text_excerpt" | "document_ref" | "inferred";
  sourceId: string;
  excerpt?: string;
  confidence: number;
}

export interface Assumption {
  code: string;
  message: string;
  applied: boolean;
}

export interface Uncertainty {
  field: string;
  message: string;
  severity: "low" | "medium" | "high";
  suggestedQuestion?: string;
}

export interface Readiness {
  status: ReadinessStatus;
  reasons: string[];
}

export interface UploadSourceMetadata {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  ingestedAt: string;
  uploadContext: "intake" | "offer" | "production";
}

export interface SafeDocumentIngestionMarker {
  status: DocumentIngestionStatus;
  warnings: DocumentIngestionWarning[];
}

export interface RawInput {
  kind: "text" | "email" | "pdf" | "json" | "form";
  content: string;
  mimeType?: string;
  documentId?: string;
  sourceMetadata?: UploadSourceMetadata;
  documentIngestion?: SafeDocumentIngestionMarker;
}

export interface SourceDescriptor {
  channel: "agent1_json" | "manual_form" | "email" | "pdf_upload" | "text" | "api";
  receivedAt: string;
  sourceRef?: string;
}

export interface CustomerInfo {
  name?: string;
  segment?: CustomerSegment;
  contactName?: string;
  email?: string;
  phone?: string;
}

export interface EventScheduleItem {
  label: string;
  start?: string;
  end?: string;
}

export interface EventInfo {
  title?: string;
  type?: string;
  date?: string;
  durationHours?: number;
  schedule?: EventScheduleItem[];
  style?: string;
  atmosphere?: string;
  locale?: string;
  serviceForm?: string;
}

export interface AttendeeInfo {
  expected?: number;
  guaranteed?: number;
  dietaryMix?: Record<string, number>;
}

export interface VenueInfo {
  name?: string;
  address?: string;
  indoor?: boolean;
  kitchenAccess?: boolean;
}

export interface CateringRequirement {
  label: string;
  category: string;
  quantity?: Quantity;
  dietaryTags?: string[];
}

export interface InfrastructureRequirement {
  code: string;
  label: string;
  quantity?: number;
  derived?: boolean;
}

export interface EventRequest {
  schemaVersion: string;
  requestId: string;
  source: SourceDescriptor;
  rawInputs: RawInput[];
  operationalArchive?: OperationalArchiveState;
  customer?: CustomerInfo;
  event?: EventInfo;
  attendees?: AttendeeInfo;
  venue?: VenueInfo;
  desiredCatering?: CateringRequirement[];
  desiredInfrastructure?: InfrastructureRequirement[];
  constraints?: string[];
  extractedFacts?: string[];
  uncertainties?: Uncertainty[];
}

export interface ServiceModule {
  moduleId: string;
  label: string;
  category: string;
  quantity?: number;
  pricing?: Money;
  notes?: string[];
}

export interface PricingSummary {
  subtotal: Money;
  perPerson?: Money;
  notes?: string[];
}

export interface MenuComponent {
  componentId: string;
  label: string;
  course?: string;
  menuCategory?: "classic" | "vegetarian" | "vegan";
  serviceStyle?: string;
  desiredRecipeTags?: string[];
  servings?: number;
  dietaryTags?: string[];
  recipeOverrideId?: string;
  productionDecision?: {
    mode?: "scratch" | "hybrid" | "convenience_purchase" | "external_finished";
    purchasedElements?: string[];
    notes?: string;
  };
}

export interface SourceLineage {
  sourceType: "offer_service" | "manual_input" | "pdf" | "email" | "web_import";
  reference: string;
}

export interface ServicePlan {
  eventType: string;
  serviceForm: string;
  staffingStyle?: string;
  modules: ServiceModule[];
}

export interface AcceptedEventSpec {
  schemaVersion: string;
  specId: string;
  lifecycle: {
    commercialState: CommercialState;
  };
  operationalArchive?: OperationalArchiveState;
  readiness: Readiness;
  sourceLineage: SourceLineage[];
  customer?: CustomerInfo;
  event: EventInfo;
  attendees: AttendeeInfo;
  venue?: VenueInfo;
  servicePlan: ServicePlan;
  menuPlan: MenuComponent[];
  infrastructurePlan?: InfrastructureRequirement[];
  budgetContext?: {
    targetBudget?: Money;
    pricingSummary?: PricingSummary;
  };
  productionConstraints?: string[];
  assumptions?: Assumption[];
  missingFields?: string[];
  uncertainties?: Uncertainty[];
  evidence?: Evidence[];
}

export interface OfferVariant {
  variantId: string;
  label: string;
  qualityTier: "economy" | "standard" | "premium";
  estimatedPrice: Money;
  moduleIds: string[];
  proposedEventSpec: AcceptedEventSpec;
}

export type OfferReviewStatusValue = "verified" | "review_required";

export interface OfferReviewStatus {
  priceReviewStatus: OfferReviewStatusValue;
  taxReviewStatus: OfferReviewStatusValue;
  allergenReviewStatus: OfferReviewStatusValue;
  hygieneTemperatureReviewStatus: OfferReviewStatusValue;
  sourceSecured: boolean;
  publishApproved: boolean;
}

export interface OfferPortfolioMapping {
  packageId: string;
  packageName: string;
  source: "curated_app_transfer";
  minPax?: number;
  workingBandPerPerson: {
    from: number;
    to: number;
    currency: string;
  };
  evidenceSummary?: string;
}

export interface OfferDraft {
  schemaVersion: string;
  businessId: BusinessId;
  draftId: string;
  revision: number;
  eventSummary: string;
  serviceModules: ServiceModule[];
  pricingSummary: PricingSummary;
  assumptions: Assumption[];
  openQuestions: string[];
  variantSet: OfferVariant[];
  customerFacingText: string;
  internalWorkingText: string;
  proposedEventSpec: AcceptedEventSpec;
  portfolioMapping?: OfferPortfolioMapping;
  reviewStatus?: OfferReviewStatus;
}

export interface ApprovedOffer {
  schemaVersion: "1.0";
  businessId: BusinessId;
  approvedOfferId: string;
  sourceDraft: { draftId: string; revision: number };
  selectedVariantId: string;
  approvalRequestId: string;
  approvedAt: string;
  eventSummary: string;
  customerFacingText: string;
  serviceModules: ServiceModule[];
  pricingSummary: PricingSummary;
  selectedVariant: OfferVariant;
}

export interface ProductionHandoff {
  schemaVersion: "1.0";
  businessId: BusinessId;
  handoffId: string;
  approvedOfferId: string;
  approvalRequestId: string;
  createdAt: string;
  eventSpecSnapshot: AcceptedEventSpec;
  pricingSnapshot: PricingSummary;
  source: { draftId: string; revision: number; selectedVariantId: string };
}

export type ProductionDraftStatus = "pending_review" | "approved" | "rejected" | "superseded";

export type ProductionDraftReviewCardKind =
  | "event_data"
  | "menu_component"
  | "recipe"
  | "quantity"
  | "purchase_item"
  | "mise_en_place"
  | "timeline"
  | "risk"
  | "open_question"
  | "source_note";

export type ProductionDraftReviewDecision = "pending" | "fits" | "change_requested" | "unclear" | "blocked";

export interface ProductionDraftSource {
  kind: "fixture" | "manual_import" | "ai_provider" | "agent_cli" | "local_provider";
  receivedAt: string;
  sourceRef?: string;
  providerId?: string;
  modelId?: string;
  inputHash?: string;
  outputHash?: string;
  runId?: string;
  dataClass?: ByoLlmDataClass;
  /**
   * Safe provider-processing provenance survives retries so audit repair never
   * needs to retain a prompt or raw model response alongside the draft.
   */
  processingPolicy?: ByoLlmProcessingPolicyMetadata;
}

export interface ProductionDraftGuardrails {
  draftOnly: true;
  humanApprovalRequired: true;
  writesProductObjects: false;
  rawProviderPayloadStored: false;
  knowledgeWritePolicy: "none" | "reviewed_only";
}

export interface ProductionDraftReviewCard {
  cardId: string;
  kind: ProductionDraftReviewCardKind;
  title: string;
  summary: string;
  decision: ProductionDraftReviewDecision;
  targetPath?: string;
  targetId?: string;
  riskLevel?: "low" | "medium" | "high" | "blocking";
  requiredApproval?: boolean;
  operatorComment?: string;
  decidedBy?: string;
  decidedAt?: string;
}

export interface IngredientLine {
  ingredientId: string;
  name: string;
  quantity: Quantity;
  group: string;
  purchaseUnit?: string;
  normalizedUnit?: string;
}

export interface RecipeStep {
  index: number;
  instruction: string;
  durationMinutes?: number;
}

export interface RecipeSource {
  tier: RecipeTier;
  originType: "internal_db" | "cookbook" | "approved_import" | "web";
  reference: string;
  url?: string;
  publisher?: string;
  retrievedAt: string;
  approvalState: RecipeApprovalState;
  qualityScore: number;
  fitScore: number;
  extractionCompleteness: number;
  licenseNote?: string;
  sourceMetadata?: UploadSourceMetadata;
}

export interface Recipe {
  schemaVersion: string;
  recipeId: string;
  name: string;
  source: RecipeSource;
  baseYield: {
    servings: number;
    unit: string;
  };
  ingredients: IngredientLine[];
  steps: RecipeStep[];
  scalingRules: {
    defaultLossFactor: number;
    batchSize?: number;
  };
  allergens: string[];
  dietTags: string[];
}

export interface RecipeSelection {
  componentId: string;
  recipeId?: string;
  selectionReason: string;
  searchQuery?: string;
  searchTrace?: string[];
  autoUsedInternetRecipe: boolean;
  sourceTier?: RecipeTier;
  qualityScore?: number;
  fitScore?: number;
}

export interface RecipeSourceExportMetadata {
  recipeId: string;
  recipeName: string;
  sourceTier: RecipeTier;
  originType: RecipeSource["originType"];
  approvalState: RecipeApprovalState;
  reference: string;
  url?: string;
  publisher?: string;
}

export interface ProductionBatch {
  batchId: string;
  componentId: string;
  recipeId: string;
  scaledYield: Quantity;
  batchCount: number;
  lossFactor: number;
  gnPlan: {
    container: string;
    count: number;
  }[];
  station: string;
  prepWindow: string;
  ingredients: IngredientLine[];
  steps: RecipeStep[];
  recipeSource?: RecipeSourceExportMetadata;
}

export interface KitchenSheet {
  title: string;
  instructions: string[];
  componentId: string;
  productionQty: Quantity;
  station: string;
  prepWindow: string;
  ingredients: IngredientLine[];
  steps: RecipeStep[];
  recipeId?: string;
  recipeSource?: RecipeSourceExportMetadata;
  allergens?: string[];
  dietTags?: string[];
  procurementNotes?: string[];
  blockingNotes?: string[];
  gnPlan?: {
    container: string;
    count: number;
  }[];
}

export interface TimelineEntry {
  label: string;
  at: string;
}

export type ComponentReadinessStatus = "operational" | "needs_clarification" | "blocked";

export interface ComponentReadiness {
  componentId: string;
  label: string;
  status: ComponentReadinessStatus;
  reason: string;
  hasProductionBatch: boolean;
  hasKitchenSheet: boolean;
  includedInPurchaseList: boolean;
  blocksProduction: boolean;
}

export interface ProductionPlan {
  schemaVersion: string;
  planId: string;
  eventSpecId: string;
  readiness: Readiness;
  productionBatches: ProductionBatch[];
  timeline: TimelineEntry[];
  kitchenSheets: KitchenSheet[];
  recipeSelections: RecipeSelection[];
  componentReadiness?: ComponentReadiness[];
  unresolvedItems: string[];
  isFallback?: boolean;
  fallbackReason?: string;
  warnings?: string[];
  blockingIssues?: string[];
}

export interface PurchaseItem {
  ingredientId: string;
  displayName: string;
  normalizedQty: number;
  normalizedUnit: string;
  purchaseQty: number;
  purchaseUnit: string;
  group: string;
  supplierHint?: string;
  sourceRecipes: string[];
  sourceRecipeMetadata?: RecipeSourceExportMetadata[];
  mappingConfidence: number;
}

export interface PurchaseList {
  schemaVersion: string;
  purchaseListId: string;
  eventSpecId: string;
  items: PurchaseItem[];
  groupingMode: "group";
  totals: {
    itemCount: number;
    groups: string[];
  };
}

export interface ProductionDraftArtifacts {
  eventSpec?: AcceptedEventSpec;
  productionPlan?: ProductionPlan;
  purchaseList?: PurchaseList;
  recipes?: Recipe[];
  openQuestions?: Uncertainty[];
  notes?: string[];
}

export interface ApprovedProductionSpec {
  schemaVersion: "1.0";
  businessId: BusinessId;
  approvedProductionSpecId: string;
  sourceDraft: {
    draftId: string;
    revision: number;
  };
  approvalRequestId: string;
  approvedAt: string;
  artifacts: {
    eventSpec: AcceptedEventSpec;
    productionPlan: ProductionPlan;
    purchaseList: PurchaseList;
    recipes: Recipe[];
  };
}

export interface ProductionApplyManifest {
  schemaVersion: "1.0";
  businessId: BusinessId;
  approvedProductionSpecId: string;
  eventSpecId: string;
  planId: string;
  purchaseListId: string;
  recipeIds: string[];
  appliedAt: string;
  appliedBy: Pick<TrustedActor, "name" | "source">;
}

export interface ProductionDraft {
  schemaVersion: string;
  businessId: BusinessId;
  draftId: string;
  revision: number;
  status: ProductionDraftStatus;
  createdAt: string;
  supersedesDraftId?: string;
  legacyApprovalState?: "unverified";
  approvalRequestId?: string;
  approvedBy?: string;
  approvedAt?: string;
  appliedBy?: string;
  appliedAt?: string;
  appliedArtifactIds?: {
    specId?: string;
    planId?: string;
    purchaseListId?: string;
    recipeIds?: string[];
  };
  source: ProductionDraftSource;
  guardrails: ProductionDraftGuardrails;
  reviewCards: ProductionDraftReviewCard[];
  draftArtifacts: ProductionDraftArtifacts;
}

export interface DocumentInput {
  filename: string;
  mimeType: string;
  content: Buffer;
  sourceMetadata?: UploadSourceMetadata;
}

export interface RecipeSearchQuery {
  component: MenuComponent;
  eventSpec: AcceptedEventSpec;
  locale: "de" | "en";
  query: string;
}

export interface WebRecipeCandidate {
  url: string;
  title: string;
  publisher?: string;
  recipe?: Partial<Recipe>;
  qualitySignals: {
    structuredData: boolean;
    hasYield: boolean;
    ingredientCount: number;
    stepCount: number;
    mappedIngredientRatio: number;
  };
}
