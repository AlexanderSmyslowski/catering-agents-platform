async () => {
  const expectedLabel = "Konferenz · 90 Teilnehmer · 2026-12-02";
  const historyDetails = [...document.querySelectorAll("details")].find((details) =>
    (details.querySelector("summary")?.textContent ?? "").includes("Frühere Produktionsaufträge öffnen")
  );
  if (!historyDetails) {
    throw new Error("Produktions-Historie fehlt");
  }
  historyDetails.open = true;

  const historyButton = [...historyDetails.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").includes(expectedLabel)
  );
  if (!historyButton) {
    throw new Error(`Synthetischer Produktionsauftrag fehlt: ${expectedLabel}`);
  }
  historyButton.click();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const text = document.body.innerText;
    if (text.includes(expectedLabel) && text.includes("Plan-Kontext: aktueller Produktionsplan")) {
      break;
    }
  }
  if (!document.body.innerText.includes("Plan-Kontext: aktueller Produktionsplan")) {
    throw new Error(`Produktionsauftrag wurde geöffnet, aber kein Ergebnis fokussiert: ${expectedLabel}`);
  }
  return { selected: expectedLabel };
}
