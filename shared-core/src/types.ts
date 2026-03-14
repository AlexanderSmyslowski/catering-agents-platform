export const SCHEMA_VERSION = "1.0.0";

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

export interface AuditEntry {
  auditId: string;
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

export interface RawInput {
  kind: "text" | "email" | "pdf" | "json" | "form";
  content: string;
  mimeType?: string;
  documentId?: string;
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

export interface OfferDraft {
  schemaVersion: string;
  draftId: string;
  eventSummary: string;
  serviceModules: ServiceModule[];
  pricingSummary: PricingSummary;
  assumptions: Assumption[];
  openQuestions: string[];
  variantSet: OfferVariant[];
  customerFacingText: string;
  internalWorkingText: string;
  proposedEventSpec: AcceptedEventSpec;
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
}

export interface KitchenSheet {
  title: string;
  instructions: string[];
}

export interface TimelineEntry {
  label: string;
  at: string;
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
  unresolvedItems: string[];
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

export interface DocumentInput {
  filename: string;
  mimeType: string;
  content: Buffer;
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
