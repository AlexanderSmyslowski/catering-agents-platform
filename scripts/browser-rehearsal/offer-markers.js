() => {
  const text = document.body.innerText;
  const missing = [
    "Angebotsagent",
    "Kundenanfrage einfügen und Entwurf prüfen",
    "Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause.",
    "Arbeitsstand: Anfrage, Entwurf, Export und Übergabe bleiben sichtbar.",
    "Grenze: nur interne Demo- oder Testdaten",
    "Zur Produktion"
  ].filter((marker) => !text.includes(marker));
  const hasProductionHandoff = [...document.querySelectorAll("a")]
    .some((anchor) =>
      anchor.offsetParent !== null &&
      anchor.getAttribute("href") === "/produktion" &&
      (anchor.textContent ?? "").includes("Zur Produktion")
    );
  if (!hasProductionHandoff) {
    missing.push("Handoff-Link Zur Produktion fehlt");
  }
  if (missing.length > 0) {
    throw new Error(`Angebots-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "offer-ok" };
}
