async () => {
  const storedContext = sessionStorage.getItem("capProductionResultReloadContext");
  const missing = [];
  if (!storedContext) {
    throw new Error("Produktions-Ergebnis-Reload ohne gespeicherten Vor-Reload-Kontext");
  }
  const { planId, planExport, handoffContext } =
    JSON.parse(storedContext);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const text = document.body.innerText;
    const html = document.body.innerHTML;
    if (
      text.includes("Plan-Kontext: aktueller Produktionsplan") &&
      text.includes(handoffContext) &&
      html.includes(planExport) &&
      text.includes("1 Liste ohne Positionen")
    ) {
      break;
    }
  }

  const afterText = document.body.innerText;
  const afterHtml = document.body.innerHTML;
  if (!afterText.includes("Plan-Kontext: aktueller Produktionsplan")) {
    missing.push("Produktions-Ergebnis-Reload verliert lesbaren aktuellen Plan-Kontext");
  }
  if (afterText.includes(`Plan-Kontext: planId ${planId}`) || afterText.includes("purchaseListId:")) {
    missing.push("Produktions-Ergebnis-Reload zeigt technische IDs im sichtbaren Kontext");
  }
  if (!afterText.includes(handoffContext)) {
    missing.push("Produktions-Ergebnis-Reload verliert lesbaren Abschluss-Kontext");
  }
  if (!afterHtml.includes(planExport)) {
    missing.push("Produktions-Ergebnis-Reload verliert aktuellen Produktionsplan-Exportlink");
  }
  if (/\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv/.test(afterHtml)) {
    missing.push("Produktions-Ergebnis-Reload bietet fuer eine leere Einkaufsliste einen CSV-Export an");
  }
  if (
    !afterText.includes("1 Liste ohne Positionen") ||
    !afterText.includes("Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.")
  ) {
    missing.push("Produktions-Ergebnis-Reload verliert den ehrlichen Leerzustand der Einkaufsliste");
  }
  if (afterText.includes("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.")) {
    missing.push("Produktions-Ergebnis-Reload faellt in leeren Ergebniszustand zurueck");
  }
  if (afterText.includes("Kein aktiver Vorgang")) {
    missing.push("Produktions-Ergebnis-Reload faellt in leeren Arbeitsbereich zurueck");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Ergebnis-Reload fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-result-reload-ok", planId };
}
