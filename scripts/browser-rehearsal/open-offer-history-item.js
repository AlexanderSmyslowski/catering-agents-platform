async () => {
  const historyDetails = [...document.querySelectorAll("details")].find((details) =>
    (details.querySelector("summary")?.textContent ?? "").includes("Frühere Angebotsaufträge öffnen")
  );
  if (!historyDetails) {
    throw new Error("Angebots-Historie fehlt");
  }
  historyDetails.open = true;

  const historyButton = [...historyDetails.querySelectorAll("button")].find((button) => {
    const label = button.textContent ?? "";
    return label.includes("Besprechung") && label.includes("35 Teilnehmer") && label.includes("Kaffeepause");
  });
  if (!historyButton) {
    throw new Error("Synthetischer Angebotsauftrag Besprechung/35/Kaffeepause fehlt");
  }
  historyButton.click();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (
      document.body.innerText.includes("Aktueller Entwurf: Besprechung für 35 Teilnehmer als Kaffeepause.") &&
      document.querySelector("[aria-label='Kompakte Ergebniszusammenfassung']")
    ) {
      break;
    }
  }

  const handoffDetails = [...document.querySelectorAll("details")].find((details) =>
    (details.querySelector("summary")?.textContent ?? "").includes("Für die Produktion übernommene Veranstaltungen")
  );
  if (!handoffDetails) {
    throw new Error("Angebots-Handoff-Bereich fehlt nach bewusster Auftragsauswahl");
  }
  handoffDetails.open = true;

  return { selected: "Besprechung für 35 Teilnehmer als Kaffeepause." };
}
