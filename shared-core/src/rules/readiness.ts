import type { AcceptedEventSpec, Readiness, ReadinessStatus } from "../types.js";

export function evaluateReadiness(spec: {
  event?: { date?: string; schedule?: { start?: string }[]; serviceForm?: string };
  attendees?: { expected?: number };
  menuPlan?: { label: string }[];
  servicePlan?: { serviceForm?: string };
}): { readiness: Readiness; missingFields: string[] } {
  const missingFields: string[] = [];

  const hasDatedSchedule = spec.event?.schedule?.some((slot) => /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(slot.start ?? ""));
  if (!spec.event?.date && !hasDatedSchedule) {
    missingFields.push("event.date");
  }

  if (!spec.attendees?.expected || spec.attendees.expected <= 0) {
    missingFields.push("attendees.expected");
  }

  if (!spec.menuPlan || spec.menuPlan.length === 0) {
    missingFields.push("menuPlan");
  }

  if (!spec.servicePlan?.serviceForm && !spec.event?.serviceForm) {
    missingFields.push("servicePlan.serviceForm");
  }

  let status: ReadinessStatus = "complete";
  if (missingFields.length > 0) {
    const coreMissing = ["event.date", "attendees.expected", "menuPlan"];
    status = missingFields.some((field) => coreMissing.includes(field))
      ? "insufficient"
      : "partial";
  }

  return {
    readiness: {
      status,
      reasons:
        missingFields.length === 0
          ? ["Alle Pflichtangaben für die Produktionsplanung sind vorhanden."]
          : missingFields.map((field) => `Fehlende oder unvollständige Angabe: ${field}`)
    },
    missingFields
  };
}

export function mergeReadiness(
  current: Readiness,
  extraIssues: string[],
  blockingIssues: string[] = []
): Readiness {
  const reasons = [...new Set([...current.reasons, ...extraIssues, ...blockingIssues])];

  if (current.status === "insufficient") {
    return {
      status: "insufficient",
      reasons
    };
  }

  if (blockingIssues.length > 0) {
    return {
      status: "insufficient",
      reasons
    };
  }

  if (extraIssues.length === 0) {
    return current;
  }

  return {
    status: "partial",
    reasons
  };
}

export function withEvaluatedReadiness(spec: AcceptedEventSpec): AcceptedEventSpec {
  const { readiness, missingFields } = evaluateReadiness(spec);
  return {
    ...spec,
    readiness,
    missingFields
  };
}
