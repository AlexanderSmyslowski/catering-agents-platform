function asRecord(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : undefined;
}

export function translateEventType(value?: string): string {
  const labels: Record<string, string> = {
    conference: "Konferenz",
    meeting: "Besprechung",
    reception: "Empfang",
    lunch: "Lunch",
    dinner: "Abendessen",
    trade_fair: "Messe",
    fair: "Messe",
    workshop: "Arbeitsseminar"
  };

  return value ? labels[value] ?? value : "Veranstaltung";
}

export function translateServiceForm(value?: string): string {
  const labels: Record<string, string> = {
    buffet: "Buffet",
    plated: "Menü am Platz",
    standing_reception: "Empfang / Flying",
    grab_and_go: "Ausgabe / Grab-and-go",
    coffee_break: "Kaffeepause"
  };

  return value ? labels[value] ?? value : "offen";
}

export function translateMenuCategory(value?: string): string {
  const labels: Record<string, string> = {
    classic: "klassisch",
    vegetarian: "vegetarisch",
    vegan: "vegan"
  };

  return value ? labels[value] ?? value : "offen";
}

export function translateProductionMode(value?: string): string {
  const labels: Record<string, string> = {
    scratch: "Eigenproduktion",
    hybrid: "Hybrid",
    convenience_purchase: "Convenience-Zukauf",
    external_finished: "Fertigprodukt / extern"
  };

  return value ? labels[value] ?? value : "offen";
}

export {
  buildProductionAssumptions,
  buildProductionQuestions
} from "./production-question-language-state.js";

export function getSpecLabel(spec: Record<string, unknown>): string {
  const event = asRecord(spec.event);
  const attendees = asRecord(spec.attendees);
  return `${translateEventType(typeof event?.type === "string" ? event.type : "")} · ${attendees?.expected ?? "?"} Teilnehmer · ${event?.date ?? "offen"}`;
}
