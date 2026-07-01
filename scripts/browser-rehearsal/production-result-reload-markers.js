async () => {
  const storedContext = sessionStorage.getItem("capProductionResultReloadContext");
  const missing = [];
  if (!storedContext) {
    throw new Error("Produktions-Ergebnis-Reload ohne gespeicherten Vor-Reload-Kontext");
  }
  const { planId, purchaseListId, planExport, purchaseExport, handoffContext } =
    JSON.parse(storedContext);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const text = document.body.innerText;
    const html = document.body.innerHTML;
    if (
      text.includes("Plan-Kontext: aktueller Produktionsplan") &&
      text.includes(handoffContext) &&
      html.includes(planExport) &&
      html.includes(purchaseExport)
    ) {
      break;
    }
  }

  const afterText = document.body.innerText;
  const afterHtml = document.body.innerHTML;
  if (!afterText.includes("Plan-Kontext: aktueller Produktionsplan")) {
    missing.push("Produktions-Ergebnis-Reload verliert lesbaren aktuellen Plan-Kontext");
  }
  if (afterText.includes(`Plan-Kontext: planId ${planId}`) || afterText.includes(`purchaseListId: ${purchaseListId}`)) {
    missing.push("Produktions-Ergebnis-Reload zeigt technische IDs im sichtbaren Kontext");
  }
  if (!afterText.includes(handoffContext)) {
    missing.push("Produktions-Ergebnis-Reload verliert lesbaren Abschluss-Kontext");
  }
  if (!afterHtml.includes(planExport)) {
    missing.push("Produktions-Ergebnis-Reload verliert aktuellen Produktionsplan-Exportlink");
  }
  if (!afterHtml.includes(purchaseExport)) {
    missing.push("Produktions-Ergebnis-Reload verliert aktuellen Einkaufslisten-Exportlink");
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
  return { route: location.pathname, markers: "production-result-reload-ok", planId, purchaseListId };
}
