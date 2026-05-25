import {
  translateMenuCategory,
  translateProductionMode,
  translateServiceForm
} from "./production-language.js";

type ProductionSpecDetailsCardProps = {
  spec?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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

function translateReadiness(value?: string): string {
  const labels: Record<string, string> = {
    complete: "vollständig",
    partial: "teilweise vollständig",
    insufficient: "unzureichend"
  };
  return value ? labels[value] ?? value : "-";
}

function formatProductionTimingWindow(spec?: Record<string, unknown>): string {
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

export function ProductionSpecDetailsCard({ spec }: ProductionSpecDetailsCardProps) {
  if (!spec) {
    return null;
  }

  const event = asRecord(spec.event);
  const servicePlan = asRecord(spec.servicePlan);
  const attendees = asRecord(spec.attendees);
  const menuPlan = Array.isArray(spec.menuPlan) ? spec.menuPlan : undefined;

  return (
    <div className="component-answer-card">
      <p className="eyebrow">Spezifikationsdetails</p>
      <p className="helper-text">specId: {String(spec.specId ?? "-")}</p>
      <p className="helper-text">
        {`Eventtyp: ${String(event?.type ?? servicePlan?.eventType ?? "-")} · ${formatProductionTimingWindow(spec)}`}
      </p>
      <p className="helper-text">
        {`Teilnehmerzahl: ${String(attendees?.expected ?? "-")} · Serviceform: ${translateServiceForm(
          String(servicePlan?.serviceForm ?? "")
        )} · Readiness: ${translateReadiness(String((spec.readiness as Record<string, unknown> | undefined)?.status ?? "-"))}`}
      </p>
      <p className="helper-text">Menüpunkte / Komponenten:</p>
      <ul className="item-list compact">
        {menuPlan
          ? menuPlan.map((entry) => {
              const component = entry as Record<string, unknown>;
              return (
                <li key={String(component.componentId ?? component.label)}>
                  <strong>{String(component.label ?? component.componentId ?? "-")}</strong>
                  <p className="helper-text">
                    {`${translateMenuCategory(String(component.menuCategory ?? ""))} · ${translateProductionMode(
                      String((component.productionDecision as Record<string, unknown> | undefined)?.mode ?? "")
                    )}`}
                  </p>
                </li>
              );
            })
          : null}
      </ul>
    </div>
  );
}
