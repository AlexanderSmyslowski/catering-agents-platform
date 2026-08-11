async () => {
  const expectedLabel = "Lunch · 43 Teilnehmer · 2026-12-16";
  const historyDetails = [...document.querySelectorAll("details")].find((details) =>
    (details.querySelector("summary")?.textContent ?? "").includes("Frühere Produktionsaufträge öffnen")
  );
  if (!historyDetails) {
    throw new Error("Answer-Submit-Rehearsal Reload ohne Produktions-Historie");
  }
  historyDetails.open = true;

  const historyButton = [...historyDetails.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").includes(expectedLabel)
  );
  if (!historyButton) {
    throw new Error(`Answer-Submit-Rehearsal Reload ohne gespeicherten Auftrag: ${expectedLabel}`);
  }
  historyButton.click();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const currentText = document.body.innerText;
    if (
      currentText.includes(expectedLabel) &&
      currentText.includes("Teilnehmerzahl: 43") &&
      currentText.includes("Plan-Kontext: aktueller Produktionsplan") &&
      currentText.includes("1 Liste ohne Positionen")
    ) {
      break;
    }
  }

  const text = document.body.innerText;
  const html = document.body.innerHTML;
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      return href ? new URL(href, location.origin).pathname : "";
    });
  const missing = [];
  const planExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/production-plans\/[^/]+\/html$/.test(href)
  );
  const purchaseExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv$/.test(href)
  );
  const planId = planExport?.match(/^\/api\/exports\/v1\/exports\/production-plans\/([^/]+)\/html$/)?.[1];
  const handoffContext =
    "Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste ohne Positionen";

  if (!text.includes(expectedLabel)) {
    missing.push("Answer-Submit-Rehearsal Reload fokussiert nicht den gespeicherten Lunch-Auftrag mit 43 Teilnehmern");
  }
  if (!text.includes("Teilnehmerzahl: 43")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne gespeicherte strukturierte Teilnehmerzahl");
  }
  if (!text.includes("Plan-Kontext: aktueller Produktionsplan")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne lesbaren aktuellen Plan-Kontext");
  }
  if (text.includes("Plan-Kontext: planId ") || text.includes("purchaseListId: ")) {
    missing.push("Answer-Submit-Rehearsal Reload zeigt technische IDs im sichtbaren Kontext");
  }

  if (!planExport || !planId) {
    missing.push("Answer-Submit-Rehearsal Reload ohne aktuellen Produktionsplan-Exportlink");
  } else {
    const planExportResponse = await fetch(planExport);
    if (!planExportResponse.ok) {
      missing.push(`Answer-Submit-Rehearsal Reload Produktionsplan-Export ist nicht abrufbar: ${planExportResponse.status}`);
    } else {
      const planExportBody = await planExportResponse.text();
      if (
        !planExportBody.includes("<h1>Produktionsplan</h1>") ||
        !planExportBody.includes("Klassifikation für Lunchbuffet fehlt.")
      ) {
        missing.push("Answer-Submit-Rehearsal Reload Produktionsplan-Export enthaelt keine fachliche Lunch-Planung");
      }
      if (planExportBody.includes(planId) || planExportBody.includes("planId")) {
        missing.push("Answer-Submit-Rehearsal Reload Produktionsplan-Export zeigt eine technische Plan-ID");
      }
    }
  }

  if (purchaseExport) {
    missing.push("Answer-Submit-Rehearsal Reload bietet für eine Einkaufsliste ohne Positionen einen CSV-Export an");
  }
  if (!text.includes("1 Liste ohne Positionen")) {
    missing.push("Answer-Submit-Rehearsal Reload kennzeichnet die leere Einkaufsliste nicht ehrlich");
  }
  if (!text.includes("Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.")) {
    missing.push("Answer-Submit-Rehearsal Reload erklärt den fehlenden Einkaufslisten-Export nicht");
  }

  if (!text.includes(handoffContext)) {
    missing.push("Answer-Submit-Rehearsal Reload ohne lesbaren Abschluss-Kontext");
  }

  if (!html.includes("/api/exports/v1/exports/production-plans/")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne Produktionsplan-Exportlink");
  }
  if (html.includes("/api/exports/v1/exports/purchase-lists/")) {
    missing.push("Answer-Submit-Rehearsal Reload zeigt einen unzulässigen Einkaufslisten-Exportlink");
  }
  if (text.includes("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.")) {
    missing.push("Answer-Submit-Rehearsal Reload faellt in leeren Ergebniszustand zurueck");
  }
  if (missing.length > 0) {
    throw new Error(`Answer-Submit-Rehearsal Reload fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "submit-reload-ok" };
}
