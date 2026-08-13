import type { AcceptedEventSpec, OfferDraft } from "@catering/shared-core";
import type { DashboardState, ProductRouteDashboard } from "./api.js";

export type OfferHandoffCounts = {
  complete: number;
  partial: number;
};

/** Legacy helper retained for the old dashboard-only tests and cards. */
export function filterDashboardRecords<T extends Record<string, unknown>>(records: T[], searchText: string): T[] {
  const query = searchText.trim().toLowerCase();
  if (!query) {
    return records;
  }
  return records.filter((record) => JSON.stringify(record).toLowerCase().includes(query));
}

/** Typed route equivalent; it never changes the case-bound collection. */
export function filterProductRouteRecords<T extends object>(records: T[], searchText: string): T[] {
  const query = searchText.trim().toLowerCase();
  if (!query) {
    return records;
  }
  return records.filter((record) => JSON.stringify(record).toLowerCase().includes(query));
}

export function countOfferHandoffReadiness(specs: Array<Record<string, unknown>>): OfferHandoffCounts {
  return specs.reduce<OfferHandoffCounts>(
    (counts, spec) => {
      const readiness = String((spec.readiness as Record<string, unknown> | undefined)?.status ?? "");
      if (readiness === "complete") {
        counts.complete += 1;
      } else if (readiness === "partial") {
        counts.partial += 1;
      }
      return counts;
    },
    { complete: 0, partial: 0 }
  );
}

export function countProductOfferHandoffReadiness(specs: AcceptedEventSpec[]): OfferHandoffCounts {
  return specs.reduce<OfferHandoffCounts>(
    (counts, spec) => {
      if (spec.readiness.status === "complete") {
        counts.complete += 1;
      } else if (spec.readiness.status === "partial") {
        counts.partial += 1;
      }
      return counts;
    },
    { complete: 0, partial: 0 }
  );
}

export function isInitialHomeDashboardLoading(input: {
  route: string;
  loading: boolean;
  dashboard: DashboardState;
}): boolean {
  return (
    input.route === "home" &&
    input.loading &&
    input.dashboard.intakeRequests.length === 0 &&
    input.dashboard.acceptedSpecs.length === 0 &&
    input.dashboard.offerDrafts.length === 0 &&
    input.dashboard.productionPlans.length === 0 &&
    input.dashboard.purchaseLists.length === 0 &&
    input.dashboard.recipes.length === 0 &&
    input.dashboard.auditEvents.length === 0
  );
}

export function isInitialProductionDashboardLoading(input: {
  route: string;
  loading: boolean;
  dashboard: DashboardState;
}): boolean {
  return (
    input.route === "production" &&
    input.loading &&
    input.dashboard.acceptedSpecs.length === 0 &&
    input.dashboard.productionPlans.length === 0 &&
    input.dashboard.purchaseLists.length === 0 &&
    input.dashboard.recipes.length === 0
  );
}

export function isInitialProductHomeDashboardLoading(input: {
  route: string;
  loading: boolean;
  dashboard: ProductRouteDashboard;
}): boolean {
  return (
    input.route === "home" &&
    input.loading &&
    input.dashboard.intakeRequests.length === 0 &&
    input.dashboard.acceptedSpecs.length === 0 &&
    input.dashboard.offerDrafts.length === 0 &&
    input.dashboard.productionPlans.length === 0 &&
    input.dashboard.purchaseLists.length === 0 &&
    input.dashboard.recipes.length === 0 &&
    input.dashboard.auditEvents.length === 0
  );
}

export function isInitialProductProductionDashboardLoading(input: {
  route: string;
  loading: boolean;
  dashboard: ProductRouteDashboard;
}): boolean {
  return (
    input.route === "production" &&
    input.loading &&
    input.dashboard.acceptedSpecs.length === 0 &&
    input.dashboard.productionPlans.length === 0 &&
    input.dashboard.purchaseLists.length === 0 &&
    input.dashboard.recipes.length === 0
  );
}

export function mapSpecsById(specs: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
  return new Map(specs.map((spec) => [String(spec.specId ?? ""), spec] as const));
}

export function mapProductSpecsById(specs: AcceptedEventSpec[]): Map<string, AcceptedEventSpec> {
  return new Map(specs.map((spec) => [spec.specId, spec] as const));
}

export function selectRecordByStringId<T extends Record<string, unknown>>(
  records: T[],
  idKey: string,
  selectedId?: string
): T | undefined {
  if (!selectedId) {
    return undefined;
  }
  return records.find((record) => String(record[idKey] ?? "") === selectedId);
}

export function selectActiveOfferSpec(
  acceptedSpecs: Array<Record<string, unknown>>,
  filteredSpecs: Array<Record<string, unknown>>
): Record<string, unknown> | undefined {
  return filteredSpecs[filteredSpecs.length - 1] ?? acceptedSpecs[acceptedSpecs.length - 1];
}

export function selectProductOfferDraft(drafts: OfferDraft[], selectedDraftId?: string): OfferDraft | undefined {
  return selectedDraftId ? drafts.find((draft) => draft.draftId === selectedDraftId) : undefined;
}

export function selectOfferSpecForDraft(
  acceptedSpecs: Array<Record<string, unknown>>,
  draftId?: string
): Record<string, unknown> | undefined {
  const normalizedDraftId = draftId?.trim();
  if (!normalizedDraftId) {
    return undefined;
  }

  return [...acceptedSpecs].reverse().find((spec) => {
    if (String(spec.draftId ?? "").trim() === normalizedDraftId) {
      return true;
    }
    const sourceLineage = Array.isArray(spec.sourceLineage) ? spec.sourceLineage : [];
    return sourceLineage.some((source) => {
      const record = source as Record<string, unknown>;
      return String(record.reference ?? "").trim() === normalizedDraftId;
    });
  });
}

export function selectProductOfferSpecForDraft(
  acceptedSpecs: AcceptedEventSpec[],
  draftId?: string
): AcceptedEventSpec | undefined {
  const normalizedDraftId = draftId?.trim();
  if (!normalizedDraftId) {
    return undefined;
  }
  return [...acceptedSpecs].reverse().find((spec) =>
    spec.sourceLineage.some((source) => source.reference.trim() === normalizedDraftId)
  );
}
