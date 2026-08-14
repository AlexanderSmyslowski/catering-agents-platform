async () => {
  const text = document.body.innerText;
  const missing = [
    "Produktionsagent",
    "Besprechung · 35 Teilnehmer · 2026-11-06",
    "Produktionsentwurf",
    "Prüfung vor Berechnung",
    "Frühere Produktionsaufträge öffnen"
  ].filter((marker) => !text.includes(marker));
  const legacyDemoLabel = ["Konferenz", "90 Teilnehmer", "2026-12-02"].join(" · ");
  if (text.includes(legacyDemoLabel)) {
    missing.push("veralteter Demo-Produktionsfall");
  }
  if (text.includes("Plan-Kontext: aktueller Produktionsplan") || text.includes("Produktionsplan-Exportlink")) {
    missing.push("Fresh-Handoff darf keinen noch nicht erzeugten Produktionsplan vortäuschen");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Handoff-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-handoff-ok" };
}
