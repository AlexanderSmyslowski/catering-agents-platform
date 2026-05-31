import type { ProductionPlanProgressState } from "./production-objects-panel.js";

export type ProductionObjectProgressStateInput = {
  planPhase: ProductionPlanProgressState["planPhase"];
  planningSpecLabel?: string;
  planProgress: number;
  planEtaSeconds?: number;
};

export function buildProductionObjectProgressState({
  planPhase,
  planningSpecLabel,
  planProgress,
  planEtaSeconds
}: ProductionObjectProgressStateInput): ProductionPlanProgressState {
  return {
    planPhase,
    planningSpecLabel,
    planProgress,
    planEtaSeconds
  };
}
