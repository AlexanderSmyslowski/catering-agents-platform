function calendarDay(value?: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return undefined;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : undefined;
}

export function formatDocumentDate(value?: string): string {
  if (!calendarDay(value)) return value || "offen";
  return `${value!.slice(8, 10)}.${value!.slice(5, 7)}.${value!.slice(0, 4)}`;
}

export function formatPreparationWindow(value: string, eventDate?: string): string {
  const date = calendarDay(eventDate);
  // Resolve only the planner's explicit event-relative marker. Free-text times
  // and references to a different day must keep their original meaning.
  if (!date || value !== `${eventDate} T-1`) return value;
  date.setUTCDate(date.getUTCDate() - 1);
  return `${formatDocumentDate(date.toISOString().slice(0, 10))} (Vortag; Planangabe prüfen)`;
}

export function formatProductionStation(value: string, explicitlyAssigned = false): string {
  const labels: Record<string, string> = {
    "hot-kitchen": "Warme Küche", "cold-kitchen": "Kalte Küche",
    "beverage-station": "Getränke", pastry: "Patisserie"
  };
  const label = labels[value];
  // Old applied snapshots contain inferred tokens without an explicit assignment.
  // Display their uncertainty without changing the historical production plan.
  return label ? explicitlyAssigned ? label : `Vorschlag: ${label} (ungeprüft)` : value;
}

export function formatKitchenQuantity(amount: number, unit: string): string {
  const decimal = (value: number) => value.toLocaleString("de-DE", { useGrouping: false, maximumSignificantDigits: 15 });
  return unit === "kg" && amount > 0 && amount < 1
    ? `${decimal(Number((amount * 1000).toPrecision(15)))} g` : `${decimal(amount)} ${unit}`;
}
