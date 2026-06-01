() => {
  const beforeText = document.body.innerText;
  const beforeHtml = document.body.innerHTML;
  const missing = [];
  const planContext = beforeText.match(/Plan-Kontext: planId ([^\s]+) · specId ([^\s]+)/);
  const purchaseContext = beforeText.match(/purchaseListId: ([^\s]+) · specId: ([^\s]+)/);
  if (!planContext) {
    missing.push("Produktions-Ergebnis-Reload vor Reload ohne aktuellen Plan-Kontext");
  }
  if (!purchaseContext) {
    missing.push("Produktions-Ergebnis-Reload vor Reload ohne aktuelle Einkaufsliste");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Ergebnis-Reload vor Reload unsicher: ${missing.join(" | ")}`);
  }

  const [, planId, planSpecId] = planContext;
  const [, purchaseListId, purchaseSpecId] = purchaseContext;
  const planExport = `/api/exports/v1/exports/production-plans/${planId}/html`;
  const purchaseExport = `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
  const handoffContext = `Abschluss-Kontext: planId ${planId} · specId ${planSpecId} · purchaseListId ${purchaseListId}`;
  if (planSpecId !== purchaseSpecId) {
    missing.push(`Produktions-Ergebnis-Reload vor Reload Abschluss-Kontext hat unterschiedliche Spezifikationen ${planSpecId}/${purchaseSpecId}`);
  }
  if (!beforeText.includes(handoffContext)) {
    missing.push("Produktions-Ergebnis-Reload vor Reload ohne passenden Abschluss-Kontext");
  }
  if (!beforeHtml.includes(planExport)) {
    missing.push(`Produktions-Ergebnis-Reload vor Reload ohne Produktionsplan-Export ${planExport}`);
  }
  if (!beforeHtml.includes(purchaseExport)) {
    missing.push(`Produktions-Ergebnis-Reload vor Reload ohne Einkaufslisten-Export ${purchaseExport}`);
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Ergebnis-Reload vor Reload unvollstaendig: ${missing.join(" | ")}`);
  }

  sessionStorage.setItem("capProductionResultReloadContext", JSON.stringify({
    planId,
    planSpecId,
    purchaseListId,
    purchaseSpecId,
    planExport,
    purchaseExport,
    handoffContext
  }));
  return { route: location.pathname, markers: "production-result-reload-pre-ok", planId, purchaseListId };
}
