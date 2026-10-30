() => {
  const text = document.body.innerText;
  const missing = [
    "CateringOS · Angebote",
    "Auftragsstand",
    "Besprechung für 35 Teilnehmer als Kaffeepause.",
    "Keine automatische Preis-, Margen- oder Produktionsfreigabe.",
    "Nur interne Demo- oder Testdaten"
  ].filter((marker) => !text.includes(marker));
  const hasProductionAction = [...document.querySelectorAll("button")]
    .some((button) => button.offsetParent !== null && !button.disabled &&
      ["An Produktion übergeben", "Produktionsauftrag öffnen", "Übergabe öffnen"].includes((button.textContent ?? "").trim()));
  if (!hasProductionAction) {
    missing.push("Fallgebundene Produktionsaktion fehlt");
  }
  if (missing.length > 0) {
    throw new Error(`Angebots-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "offer-ok" };
}
