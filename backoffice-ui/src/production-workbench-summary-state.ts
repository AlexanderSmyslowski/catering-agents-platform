import { groupDishQuestions } from "./production-question-grouping.js";
import { productionContextNotes } from "../../shared-core/src/production-clarification.js";
import type { ProductionWorkbenchSummary } from "./production-workbench.js";
import { countPurchaseListItems } from "./production-route-artifact-status-state.js";
import { withoutConfirmedTimeDuplicates, type ScheduleSlotLike } from "./schedule-time-hints.js";

const SPECIAL_DIET_RESPONSE = /^Sonderkost-Antwort von ([^\r\n]+?): ([\s\S]+) — Keine Allergen- oder Küchenfreigabe\.$/;
const OPAQUE_ACTOR_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f-]{16,})$/i;

/** Primary kitchen-note wording: a raw account identifier is lineage, not a
 * readable author, and moves to the technical details. The answer text and
 * its "no allergen or kitchen approval" boundary remain unchanged. */
export function formatKitchenNoteForDisplay(note: string): string {
  const match = SPECIAL_DIET_RESPONSE.exec(note);
  if (!match || !OPAQUE_ACTOR_ID.test(match[1]!.trim())) return note;
  return `Sonderkost-Antwort: ${match[2]} — Keine Allergen- oder Küchenfreigabe.`;
}

/** UI-only projection of the shared kitchen notes (print/export unchanged). */
export function buildKitchenNoteDisplay(spec?: Record<string, unknown>): { notes: string[]; lineage: string[] } {
  const raw = productionContextNotes(spec);
  const event = spec?.event && typeof spec.event === "object" ? spec.event as { schedule?: unknown } : undefined;
  const schedule = Array.isArray(event?.schedule) ? event.schedule as ScheduleSlotLike[] : undefined;
  const notes = [...new Set(withoutConfirmedTimeDuplicates(raw, schedule).map(formatKitchenNoteForDisplay))];
  // Every raw entry that is not shown verbatim stays readable as lineage.
  const lineage = raw.filter((note) => !notes.includes(note));
  return { notes, lineage };
}

type ClarificationStatusCounts = {
  answered: number;
  unanswered: number;
};

export type ProductionWorkbenchSummaryStateInput = {
  hasActiveContext?: boolean;
  focusedProductionSpec?: Record<string, unknown>;
  activeProductionContextLabel: string;
  activeProductionTechnicalContextLabel?: string;
  focusedSpecReadinessLabel: string;
  productionPlanStatusLabel: string;
  purchaseZoneStatusLabel: string;
  productionQuestions: string[];
  clarificationStatusCounts: ClarificationStatusCounts;
  currentSpecPlans: Array<Record<string, unknown>>;
  productionObjectStatusLabel: string;
  currentSpecPurchaseLists: Array<Record<string, unknown>>;
};

export function buildProductionWorkbenchSummaryState({
  hasActiveContext,
  focusedProductionSpec,
  activeProductionContextLabel,
  activeProductionTechnicalContextLabel,
  focusedSpecReadinessLabel,
  productionPlanStatusLabel,
  purchaseZoneStatusLabel,
  productionQuestions,
  clarificationStatusCounts,
  currentSpecPlans,
  productionObjectStatusLabel,
  currentSpecPurchaseLists
}: ProductionWorkbenchSummaryStateInput): ProductionWorkbenchSummary {
  const { notes: productionNotes, lineage: productionNoteLineage } = buildKitchenNoteDisplay(focusedProductionSpec);
  const openQuestionCount = groupDishQuestions(focusedProductionSpec, productionQuestions).openCount;
  return {
    ...(hasActiveContext === undefined ? {} : { hasActiveContext }),
    ...(productionNotes.length ? { productionNotes } : {}),
    ...(productionNoteLineage.length ? { productionNoteLineage } : {}),
    activeSpecLabel: activeProductionContextLabel,
    activeTechnicalContextLabel: activeProductionTechnicalContextLabel,
    readinessLabel: focusedSpecReadinessLabel,
    planStatusLabel: productionPlanStatusLabel,
    purchaseStatusLabel: purchaseZoneStatusLabel,
    // productionQuestions already contains only unanswered questions.
    questionCount: openQuestionCount + clarificationStatusCounts.answered,
    answeredQuestionCount: clarificationStatusCounts.answered,
    unansweredQuestionCount: openQuestionCount,
    productionObjectCount: currentSpecPlans.length,
    productionObjectStatusLabel,
    purchaseListCount: currentSpecPurchaseLists.length,
    purchaseItemCount: countPurchaseListItems(currentSpecPurchaseLists)
  };
}
