import { buildProductionQuestions, getSpecLabel } from "./production-language.js";
import { formatProductionReadinessLabelForQuestionCount } from "./production-route-state.js";

export type ProductionSpecSwitchItem = {
  spec: Record<string, unknown>;
  specId: string;
  label: string;
  readinessLabel: string;
  openActionLabel: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

export function buildProductionSpecSwitchItems(
  specs: Array<Record<string, unknown>>
): ProductionSpecSwitchItem[] {
  return specs.map((spec) => {
    const specId = String(spec.specId ?? "");
    const label = getSpecLabel(spec);
    const readinessLabel = formatProductionReadinessLabelForQuestionCount(
      spec,
      buildProductionQuestions(spec).length
    );

    return {
      spec,
      specId,
      label,
      readinessLabel: `Klarheit: ${readinessLabel}`,
      openActionLabel: `Rückfragen öffnen: ${label} · Klarheit: ${readinessLabel}`
    };
  });
}
