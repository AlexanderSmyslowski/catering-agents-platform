import type { AcceptedEventSpec, Readiness, ReadinessStatus } from "../types.js";

export function evaluateReadiness(spec: {
  event?: { date?: string; schedule?: { start?: string }[]; serviceForm?: string };
  attendees?: { expected?: number };
  menuPlan?: { label: string }[];
  servicePlan?: { serviceForm?: string };
}): { readiness: Readiness; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!spec.event?.date && !spec.event?.schedule?.some((slot) => slot.start)) {
    missingFields.push("event.date_or_schedule");
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
    const coreMissing = ["event.date_or_schedule", "attendees.expected", "menuPlan"];
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
