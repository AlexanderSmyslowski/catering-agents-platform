() => {
  const text = document.body.innerText;
  const missing = [
    "Angebotsagent",
    "Kundenanfrage einfügen und Entwurf prüfen",
    "Die App erstellt einen prüfbaren Angebotsentwurf.",
    "Frühere Angebotsaufträge öffnen",
    "2 Aufträge"
  ].filter((marker) => !text.includes(marker));
  const visibleHandoff = [...document.querySelectorAll("a[href='/produktion']")]
    .some((anchor) => anchor.offsetParent !== null && (anchor.textContent ?? "").includes("Zur Produktion"));
  if (visibleHandoff) {
    missing.push("leerer Angebotsstart zeigt bereits eine Produktionsübergabe");
  }
  if (text.includes("Kompakte Ergebniszusammenfassung") || text.includes("Aktueller Entwurf:")) {
    missing.push("leerer Angebotsstart fokussiert bereits einen früheren Auftrag");
  }
  if (missing.length > 0) {
    throw new Error(`Leerer Angebotsstart unvollständig: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "offer-empty-ok" };
}
