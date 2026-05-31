import type { ProductionHandoffState } from "./production-handoff-panel.js";

export type ProductionHandoffStateInput = {
  productionIntakeOriginLabel: string;
  productionAuditTrailLabel: string;
  productionHandoffExportLabel: string;
  productionHandoffContextLabel?: string;
};

export function buildProductionHandoffState({
  productionIntakeOriginLabel,
  productionAuditTrailLabel,
  productionHandoffExportLabel,
  productionHandoffContextLabel
}: ProductionHandoffStateInput): ProductionHandoffState {
  return {
    intakeOriginLabel: productionIntakeOriginLabel,
    auditTrailLabel: productionAuditTrailLabel,
    exportLabel: productionHandoffExportLabel,
    contextLabel: productionHandoffContextLabel
  };
}
