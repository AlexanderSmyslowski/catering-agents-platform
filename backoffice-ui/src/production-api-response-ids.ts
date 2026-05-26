export function extractAcceptedSpecId(payload: Record<string, unknown>): string | undefined {
  const spec = payload.acceptedEventSpec as Record<string, unknown> | undefined;
  const specId = spec?.specId;
  return typeof specId === "string" ? specId : undefined;
}

export function extractProductionPlanId(payload: Record<string, unknown>): string | undefined {
  const plan = payload.productionPlan as Record<string, unknown> | undefined;
  const planId = plan?.planId;
  return typeof planId === "string" ? planId : undefined;
}
