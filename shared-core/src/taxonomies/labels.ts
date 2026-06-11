export const eventTypeLabels: Record<string, string> = {
  meeting: "Besprechung",
  conference: "Konferenz",
  reception: "Empfang",
  lunch: "Lunch",
  dinner: "Abendessen",
  trade_fair: "Messe"
};

export const serviceFormLabels: Record<string, string> = {
  coffee_break: "Kaffeepause",
  buffet: "Buffet",
  standing_reception: "Empfang / Flying",
  plated: "Menü am Platz",
  grab_and_go: "Ausgabe / Grab-and-go"
};

export const menuCategoryLabels: Record<string, string> = {
  classic: "Klassisch",
  vegetarian: "Vegetarisch",
  vegan: "Vegan"
};

function formatTaxonomyLabel(value: string | undefined, labels: Record<string, string>): string | undefined {
  if (!value) {
    return undefined;
  }
  return labels[value] ?? value;
}

export function formatEventTypeLabel(value: string | undefined): string | undefined {
  return formatTaxonomyLabel(value, eventTypeLabels);
}

export function formatServiceFormLabel(value: string | undefined): string | undefined {
  return formatTaxonomyLabel(value, serviceFormLabels);
}

export function formatMenuCategoryLabel(value: string | undefined): string | undefined {
  return formatTaxonomyLabel(value, menuCategoryLabels);
}
