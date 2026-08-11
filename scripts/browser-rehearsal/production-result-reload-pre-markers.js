() => {
  const beforeText = document.body.innerText;
  const beforeHtml = document.body.innerHTML;
  const missing = [];
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      return href ? new URL(href, location.origin).pathname : "";
    });
  const planExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/production-plans\/[^/]+\/html$/.test(href)
  );
  const purchaseExport = exportLinks.find((href) =>
    /^\/api\/exports\/v1\/exports\/purchase-lists\/[^/]+\/csv$/.test(href)
  );
  const planId = planExport?.match(/^\/api\/exports\/v1\/exports\/production-plans\/([^/]+)\/html$/)?.[1];
  const handoffContext =
    "Abschluss-Kontext: Produktionsplan im Fokus · Spezifikation im Fokus · Einkaufsliste ohne Positionen";
  if (!planExport || !planId) {
    missing.push("Produktions-Ergebnis-Reload vor Reload ohne aktuellen Produktionsplan-Exportlink");
  }
  if (purchaseExport) {
    missing.push("Produktions-Ergebnis-Reload vor Reload bietet fuer eine leere Einkaufsliste einen CSV-Export an");
  }
  if (beforeText.includes("Plan-Kontext: planId ") || beforeText.includes("purchaseListId: ")) {
    missing.push("Produktions-Ergebnis-Reload vor Reload zeigt technische IDs im sichtbaren Kontext");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Ergebnis-Reload vor Reload unsicher: ${missing.join(" | ")}`);
  }

  if (!beforeText.includes(handoffContext)) {
    missing.push("Produktions-Ergebnis-Reload vor Reload ohne lesbaren Abschluss-Kontext");
  }
  if (!beforeHtml.includes(planExport)) {
    missing.push(`Produktions-Ergebnis-Reload vor Reload ohne Produktionsplan-Export ${planExport}`);
  }
  if (
    !beforeText.includes("1 Liste ohne Positionen") ||
    !beforeText.includes("Export erst verfügbar, wenn Einkaufspositionen ermittelt sind.")
  ) {
    missing.push("Produktions-Ergebnis-Reload vor Reload verschleiert die leere Einkaufsliste");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Ergebnis-Reload vor Reload unvollstaendig: ${missing.join(" | ")}`);
  }

  sessionStorage.setItem("capProductionResultReloadContext", JSON.stringify({
    planId,
    planExport,
    handoffContext
  }));
  return { route: location.pathname, markers: "production-result-reload-pre-ok", planId };
}
