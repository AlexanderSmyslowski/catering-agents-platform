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
          ? ["All required production fields are present."]
          : missingFields.map((field) => `Missing or incomplete field: ${field}`)
    },
    missingFields
  };
}

export function mergeReadiness(
  current: Readiness,
  extraIssues: string[]
): Readiness {
  if (extraIssues.length === 0) {
    return current;
  }

  const status: ReadinessStatus =
    current.status === "insufficient" ? "insufficient" : "partial";

  return {
    status,
    reasons: [...current.reasons, ...extraIssues]
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

