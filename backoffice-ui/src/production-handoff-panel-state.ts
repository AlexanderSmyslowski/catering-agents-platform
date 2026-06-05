import type { ProductionHandoffState } from "./production-handoff-panel.js";

export type ProductionHandoffFactState = {
  key: string;
  label: string;
  value: string;
};

export type ProductionHandoffPanelRenderState = {
  facts: ProductionHandoffFactState[];
};

export function buildProductionHandoffPanelState(
  handoffState: ProductionHandoffState
): ProductionHandoffPanelRenderState {
  const facts: ProductionHandoffFactState[] = [
    {
      key: "intake-origin",
      label: "Intake-Ursprung",
      value: handoffState.intakeOriginLabel
    },
    {
      key: "audit-trail",
      label: "Audit-Spur",
      value: handoffState.auditTrailLabel
    },
    {
      key: "export-artifacts",
      label: "Übergabe-/Exportartefakte",
      value: handoffState.exportLabel
    }
  ];

  if (handoffState.contextLabel) {
    facts.push({
      key: "handoff-context",
      label: "Abschluss-Kontext",
      value: `Abschluss-Kontext: ${handoffState.contextLabel}`
    });
  }

  return { facts };
}
