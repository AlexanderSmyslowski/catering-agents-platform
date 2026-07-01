import { translateEventType, translateServiceForm } from "./production-language.js";

export type WorkbenchSpecFact = {
  label: string;
  value: string;
};

export type ClarificationAnswerStatusCounts = {
  answered: number;
  unanswered: number;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function readStringOrNumber(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function formatMenuComponentSummary(menuPlan: unknown[]): string | undefined {
  const labels = menuPlan
    .map((item) => readStringOrNumber(asRecord(item), ["label", "name", "title"]))
    .filter((label): label is string => Boolean(label?.trim()));

  if (labels.length === 0) {
    return undefined;
  }

  const visibleLabels = labels.slice(0, 4);
  const remainingCount = labels.length - visibleLabels.length;
  return remainingCount > 0
    ? `${visibleLabels.join(", ")} + ${remainingCount} weitere`
    : visibleLabels.join(", ");
}

export function translateReadiness(value?: string): string {
  const labels: Record<string, string> = {
    complete: "vollständig",
    partial: "teilweise vollständig",
    insufficient: "unzureichend"
  };
  return value ? labels[value] ?? value : "-";
}

export function formatProductionReadinessLabel(source?: Record<string, unknown>): string {
  return translateReadiness(String(asRecord(source?.readiness)?.status ?? "-"));
}

export function formatProductionPlanStatusLabel(selectedPlan?: Record<string, unknown>): string {
  return selectedPlan ? formatProductionReadinessLabel(selectedPlan) : "offen";
}

function formatPlanCount(count: number): string {
  return count === 1 ? "1 Plan" : `${count} Pläne`;
}

export function formatProductionObjectStatusLabel(input: {
  currentSpecPlanCount: number;
  selectedPlan?: Record<string, unknown>;
}): string {
  if (input.selectedPlan) {
    return `${formatPlanCount(input.currentSpecPlanCount)} · ${formatProductionReadinessLabel(input.selectedPlan)}`;
  }

  return input.currentSpecPlanCount > 0 ? formatPlanCount(input.currentSpecPlanCount) : "noch kein Plan";
}

export function formatStructuredProductionAnswerSummary(spec?: Record<string, unknown>): string | undefined {
  if (!spec) {
    return undefined;
  }

  const event = asRecord(spec.event);
  const attendees = asRecord(spec.attendees);
  const servicePlan = asRecord(spec.servicePlan);
  const parts = [
    readStringOrNumber(event, ["type"])
      ? `Veranstaltung: ${translateEventType(String(readStringOrNumber(event, ["type"])))}`
      : undefined,
    readStringOrNumber(event, ["date"]) ? `Datum: ${String(readStringOrNumber(event, ["date"]))}` : undefined,
    readStringOrNumber(attendees, ["expected"])
      ? `Teilnehmerzahl: ${String(readStringOrNumber(attendees, ["expected"]))} Personen`
      : undefined,
    readStringOrNumber(servicePlan, ["serviceForm"])
      ? `Serviceform: ${translateServiceForm(String(readStringOrNumber(servicePlan, ["serviceForm"])))}`
      : undefined
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function formatProductionTimingWindow(spec?: Record<string, unknown>): string {
  const event = asRecord(spec?.event);
  const date = readStringOrNumber(event, ["date"]);
  const schedule = Array.isArray(event?.schedule)
    ? event.schedule
        .map((item) => {
          const slot = asRecord(item);
          const label = readStringOrNumber(slot, ["label"]);
          const start = readStringOrNumber(slot, ["start"]);
          const end = readStringOrNumber(slot, ["end"]);
          if (!start && !end) {
            return "";
          }
          const timing = start && end ? `${start}–${end}` : start ?? end;
          return [label, timing].filter(Boolean).join(" ").trim();
        })
        .filter(Boolean)
    : [];

  if (date && schedule.length > 0) {
    return `Datum: ${date} · Terminfenster: ${schedule.join(", ")}`;
  }
  if (date) {
    return `Datum: ${date}`;
  }
  if (schedule.length > 0) {
    return `Terminfenster: ${schedule.join(", ")}`;
  }
  return "Terminfenster: noch zu bestätigen";
}

export function buildWorkbenchSpecFacts(spec?: Record<string, unknown>): WorkbenchSpecFact[] {
  if (!spec) {
    return [];
  }

  const event = asRecord(spec.event);
  const attendees = asRecord(spec.attendees);
  const servicePlan = asRecord(spec.servicePlan);
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : [];
  const eventType = readStringOrNumber(event, ["type"]) ?? readStringOrNumber(servicePlan, ["eventType"]);
  const menuComponentSummary = formatMenuComponentSummary(menuPlan);

  const facts: WorkbenchSpecFact[] = [
    {
      label: "Status",
      value: translateReadiness(String((spec.readiness as Record<string, unknown> | undefined)?.status ?? "-"))
    },
    {
      label: "Zeit",
      value: formatProductionTimingWindow(spec)
    },
    {
      label: "Gäste",
      value: `${String(attendees?.expected ?? "-")} Personen`
    },
    {
      label: "Service",
      value: translateServiceForm(String(servicePlan?.serviceForm ?? ""))
    },
    {
      label: "Menü",
      value: `${menuPlan.length} Komponenten`
    }
  ];
  if (menuComponentSummary) {
    facts.push({
      label: "Speisen",
      value: menuComponentSummary
    });
  }

  if (!eventType) {
    return facts;
  }

  return [facts[0], { label: "Veranstaltung", value: translateEventType(eventType) }, ...facts.slice(1)];
}

export function countClarificationAnswerStatuses(
  messages: Array<{ clarificationAnswerStatus?: unknown }>
): ClarificationAnswerStatusCounts {
  return messages.reduce<ClarificationAnswerStatusCounts>(
    (counts, message) => {
      if (message.clarificationAnswerStatus === "answered") {
        counts.answered += 1;
      } else if (message.clarificationAnswerStatus === "unanswered") {
        counts.unanswered += 1;
      }
      return counts;
    },
    { answered: 0, unanswered: 0 }
  );
}
