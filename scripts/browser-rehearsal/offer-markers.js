() => {
  const text = document.body.innerText;
  const missing = [
    "Angebotsagent",
    "Kundenanfrage einfügen und Entwurf prüfen",
    "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause.",
    "Arbeitsstand: Anfrage, Entwurf, Export und Übergabe bleiben sichtbar.",
    "Grenze: nur interne Demo- oder Testdaten"
  ].filter((marker) => !text.includes(marker));
  const hasProductionAction = [...document.querySelectorAll("button")]
    .some((button) => button.offsetParent !== null && !button.disabled &&
      ["An Produktion übergeben", "Produktionsauftrag öffnen"].includes((button.textContent ?? "").trim()));
  if (!hasProductionAction) {
    missing.push("Fallgebundene Produktionsaktion fehlt");
  }
  if (missing.length > 0) {
    throw new Error(`Angebots-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "offer-ok" };
}
