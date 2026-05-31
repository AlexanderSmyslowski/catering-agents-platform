export function planningComponentErrorReason(componentLabel: string, error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Ungültige Planungsantwort")) {
    return error.message;
  }

  return `Technischer Fehler in der Produktionsplanung für ${componentLabel}: ${
    error instanceof Error ? error.message : "Unbekannter Fehler"
  }`;
}
