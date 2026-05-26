import { useEffect, useState } from "react";

export type ProductionPlanPhase = "idle" | "planning" | "done";

export function estimatePlanningDurationMs(spec: Record<string, unknown>): number {
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];
  const baseDuration = 4500;
  const perComponent = menuPlan.length * 2200;
  return Math.max(6000, Math.min(30000, baseDuration + perComponent));
}

export function useProductionPlanProgress() {
  const [planPhase, setPlanPhase] = useState<ProductionPlanPhase>("idle");
  const [planProgress, setPlanProgress] = useState(0);
  const [planEtaSeconds, setPlanEtaSeconds] = useState<number | undefined>();
  const [planEstimatedDurationMs, setPlanEstimatedDurationMs] = useState(0);
  const [planStartedAt, setPlanStartedAt] = useState<number | undefined>();
  const [planningSpecLabel, setPlanningSpecLabel] = useState<string>();

  useEffect(() => {
    if (planPhase !== "planning" || !planStartedAt || planEstimatedDurationMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - planStartedAt;
      const ratio = Math.min(elapsed / planEstimatedDurationMs, 0.92);
      const remainingMs = Math.max(planEstimatedDurationMs - elapsed, 700);
      setPlanProgress(Math.max(12, Math.round(ratio * 100)));
      setPlanEtaSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
    }, 180);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [planEstimatedDurationMs, planPhase, planStartedAt]);

  function resetPlanProgress() {
    setPlanPhase("idle");
    setPlanProgress(0);
    setPlanEtaSeconds(undefined);
    setPlanEstimatedDurationMs(0);
    setPlanStartedAt(undefined);
    setPlanningSpecLabel(undefined);
  }

  function startPlanProgress(spec: Record<string, unknown>, specLabel: string) {
    const estimatedDurationMs = estimatePlanningDurationMs(spec);
    setPlanningSpecLabel(specLabel);
    setPlanPhase("planning");
    setPlanProgress(12);
    setPlanEtaSeconds(Math.max(1, Math.ceil(estimatedDurationMs / 1000)));
    setPlanEstimatedDurationMs(estimatedDurationMs);
    setPlanStartedAt(Date.now());
  }

  function completePlanProgress() {
    setPlanPhase("done");
    setPlanProgress(100);
    setPlanEtaSeconds(0);
  }

  function failPlanProgress() {
    setPlanPhase("idle");
    setPlanProgress(0);
    setPlanEtaSeconds(undefined);
    setPlanEstimatedDurationMs(0);
    setPlanStartedAt(undefined);
  }

  return {
    planPhase,
    planningSpecLabel,
    planProgress,
    planEtaSeconds,
    resetPlanProgress,
    startPlanProgress,
    completePlanProgress,
    failPlanProgress
  };
}
