async () => {
  const text = document.body.innerText;
  const missing = [
    "CateringOS · Produktion",
    "Nächster Schritt"
  ].filter((marker) => !text.includes(marker));
  // A handoff can already be focused when the route is entered; neither state has a plan yet.
  if (!["Angebot hochladen oder Auftrag beschreiben", "Auftragsstand Küche"].some(marker => text.includes(marker))) {
    missing.push("Eingabe oder geöffneter Auftragsstand fehlt");
  }
  if (!["Bestehenden Auftrag öffnen · 1 Auftrag", "Anderen Auftrag öffnen · 1 Auftrag"].some(marker => text.includes(marker))) {
    missing.push("Eindeutiger Handoff-Auftrag in der Auswahl fehlt");
  }
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
