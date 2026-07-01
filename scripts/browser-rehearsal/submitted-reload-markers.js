async () => {
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
  const purchaseListId = purchaseExport?.match(/^\/api\/exports\/v1\/exports\/purchase-lists\/([^/]+)\/csv$/)?.[1];
  const handoffContext = "Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste vorhanden";

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
      if (!planExportBody.includes(`Produktionsplan ${planId}`)) {
        missing.push(`Answer-Submit-Rehearsal Reload Produktionsplan-Exportinhalt passt nicht zu ${planId}`);
      }
    }
  }

  if (!purchaseExport || !purchaseListId) {
    missing.push("Answer-Submit-Rehearsal Reload ohne aktuelle Einkaufsliste");
  } else {
    const purchaseExportResponse = await fetch(purchaseExport);
    if (!purchaseExportResponse.ok) {
      missing.push(`Answer-Submit-Rehearsal Reload Einkaufslisten-Export ist nicht abrufbar: ${purchaseExportResponse.status}`);
    } else {
      const purchaseExportBody = await purchaseExportResponse.text();
      if (
        !purchaseExportBody.includes(
          `"group","item","normalizedQty","normalizedUnit","purchaseQty","purchaseUnit","supplierHint"`
        )
      ) {
        missing.push(`Answer-Submit-Rehearsal Reload Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header fuer ${purchaseListId}`);
      }
    }
  }

  if (!text.includes(handoffContext)) {
    missing.push("Answer-Submit-Rehearsal Reload ohne lesbaren Abschluss-Kontext");
  }

  if (!html.includes("/api/exports/v1/exports/production-plans/")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne Produktionsplan-Exportlink");
  }
  if (!html.includes("/api/exports/v1/exports/purchase-lists/")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne Einkaufslisten-Exportlink");
  }
  if (text.includes("Noch keine Pläne, Einkaufslisten oder Exportlinks für diesen Vorgang vorhanden.")) {
    missing.push("Answer-Submit-Rehearsal Reload faellt in leeren Ergebniszustand zurueck");
  }
  if (missing.length > 0) {
    throw new Error(`Answer-Submit-Rehearsal Reload fehlgeschlagen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "submit-reload-ok" };
}
