async () => {
  const text = document.body.innerText;
  const missing = [
    "Produktionsagent",
    "Was braucht die Produktion als Nächstes?",
    "Beta-Pfad: Rückfragen -> Ergebnisobjekte -> Exporte/Audit.",
    "Interner Arbeitsstand: Produktion, Einkauf, Exporte, Herkunft und offene Punkte bleiben sichtbar.",
    "keine automatische Allergen-, Preis- oder Margenfreigabe",
    "Rückfragenstatus:",
    "Rückfragen und Antworten",
    "Produktionsobjekte und Downloads prüfen",
    "Produktionsblatt exportieren",
    "Einkaufsliste exportieren",
    "Audit-Spur",
    "Beta-Endpunkt: Produktionsblatt, Einkaufsliste und Audit-Spur sind interne Arbeitsbelege.",
    "keine rechtssichere Audit-Behauptung"
  ].filter((marker) => !text.includes(marker));
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => anchor.getAttribute("href") ?? "");
  const buttons = [...document.querySelectorAll("button")].map((button) => ({
    text: (button.textContent ?? "").replace(/\s+/g, " ").trim(),
    disabled: button.disabled,
    title: button.getAttribute("title") ?? ""
  }));
  if (!exportLinks.some((href) => href.includes("/api/exports/v1/exports/production-plans/") && href.endsWith("/html"))) {
    missing.push("Produktionsplan-Exportlink fehlt");
  }
  if (!exportLinks.some((href) => href.includes("/api/exports/v1/exports/purchase-lists/") && href.endsWith("/csv"))) {
    missing.push("Einkaufslisten-Exportlink fehlt");
  }
  const planContext = text.match(/Plan-Kontext: planId ([^\s]+) · specId ([^\s]+)/);
  let currentPlanId;
  let currentPlanSpecId;
  if (!planContext) {
    missing.push("aktueller Plan-Kontext fehlt");
  } else {
    const [, planId, specId] = planContext;
    currentPlanId = planId;
    currentPlanSpecId = specId;
    const expectedPlanHref = `/api/exports/v1/exports/production-plans/${planId}/html`;
    if (!exportLinks.includes(expectedPlanHref)) {
      missing.push(`aktueller Produktionsplan-Exportlink passt nicht zu ${planId}`);
    }
    if (!text.includes(`Produktionsblatt exportieren\\nfür Plan ${planId} · Spezifikation ${specId}`)) {
      missing.push(`Produktionsplan-Exportlabel passt nicht zu ${planId}/${specId}`);
    }
    const planExportResponse = await fetch(expectedPlanHref);
    if (!planExportResponse.ok) {
      missing.push(`aktueller Produktionsplan-Export ist im Browser nicht abrufbar: ${planExportResponse.status}`);
    } else {
      const planExportBody = await planExportResponse.text();
      if (!planExportBody.includes(`Produktionsplan ${planId}`)) {
        missing.push(`aktueller Produktionsplan-Exportinhalt passt nicht zu ${planId}`);
      }
    }
  }
  const purchaseContext = text.match(/purchaseListId: ([^\s]+) · specId: ([^\s]+)/);
  let currentPurchaseListId;
  let currentPurchaseSpecId;
  if (!purchaseContext) {
    missing.push("aktueller Einkaufslisten-Kontext fehlt");
  } else {
    const [, purchaseListId, specId] = purchaseContext;
    currentPurchaseListId = purchaseListId;
    currentPurchaseSpecId = specId;
    const expectedPurchaseHref = `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
    if (!exportLinks.includes(expectedPurchaseHref)) {
      missing.push(`aktueller Einkaufslisten-Exportlink passt nicht zu ${purchaseListId}`);
    }
    if (!text.includes(`Einkaufsliste exportieren\\nfür aktuellen Vorgang ${purchaseListId} · Spezifikation ${specId}`)) {
      missing.push(`Einkaufslisten-Exportlabel passt nicht zu ${purchaseListId}/${specId}`);
    }
    const purchaseExportResponse = await fetch(expectedPurchaseHref);
    if (!purchaseExportResponse.ok) {
      missing.push(`aktueller Einkaufslisten-Export ist im Browser nicht abrufbar: ${purchaseExportResponse.status}`);
    } else {
      const purchaseExportBody = await purchaseExportResponse.text();
      if (
        !purchaseExportBody.includes(
          `"group","item","normalizedQty","normalizedUnit","purchaseQty","purchaseUnit","supplierHint"`
        )
      ) {
        missing.push(`aktueller Einkaufslisten-Exportinhalt enthaelt keinen CSV-Header fuer ${purchaseListId}`);
      }
    }
  }
  if (currentPlanId && currentPlanSpecId && currentPurchaseListId && currentPurchaseSpecId) {
    if (currentPlanSpecId !== currentPurchaseSpecId) {
      missing.push(`Abschluss-Kontext hat unterschiedliche Spezifikationen ${currentPlanSpecId}/${currentPurchaseSpecId}`);
    }
    const expectedHandoffContext =
      `Abschluss-Kontext: planId ${currentPlanId} · specId ${currentPlanSpecId} · purchaseListId ${currentPurchaseListId}`;
    if (!text.includes(expectedHandoffContext)) {
      missing.push("Abschluss-Kontext passt nicht zum aktuellen Plan-/Einkaufslisten-Kontext");
    }
  }
  if (text.includes("ÄLTERE EINKAUFSLISTEN") && !text.includes("Nur bei Bedarf aufklappen; ältere Listen sind kein aktueller Vorgang.")) {
    missing.push("aeltere Einkaufslisten sind nicht klar als nicht aktuell markiert");
  }
  if (text.includes("Ältere Produktionsläufe") && !text.includes("Diese früheren Produktionsläufe sind Kontext aus anderen Vorgängen, nicht das aktuelle Ergebnis.")) {
    missing.push("aeltere Produktionslaeufe sind nicht klar als nicht aktuell markiert");
  }
  const questionSummary = text.match(/Rückfragenstatus: offen (\d+) · beantwortet (\d+)/);
  const questionPanelSummary = text.match(/Rückfragen und Antworten\s+offen (\d+) · beantwortet (\d+)/);
  if (!questionSummary) {
    missing.push("Rückfragenstatus-Zaehler fehlt");
  }
  if (!questionPanelSummary) {
    missing.push("Rückfragen-und-Antworten-Zaehler fehlt");
  }
  if (
    questionSummary &&
    questionPanelSummary &&
    (questionSummary[1] !== questionPanelSummary[1] || questionSummary[2] !== questionPanelSummary[2])
  ) {
    missing.push("Rückfragenstatus und Rückfragenpanel zeigen unterschiedliche Zaehler");
  }
  const clearWorkspaceButton = buttons.find((button) => button.text.startsWith("Arbeitsbereich lokal leeren"));
  if (!clearWorkspaceButton) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion fehlt");
  } else if (clearWorkspaceButton.disabled) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion ist trotz aktuellem Ergebnis deaktiviert");
  } else if (!clearWorkspaceButton.text.includes("Plan-Kontext geladen:") || !clearWorkspaceButton.title.includes("Lokalen Arbeitsbereich leeren:")) {
    missing.push("Arbeitsbereich-lokal-leeren-Aktion ist nicht mit aktuellem Kontext beschriftet");
  }
  const archiveButton = buttons.find((button) => button.text === "Fehlupload archivieren");
  if (!archiveButton) {
    missing.push("Fehlupload-Archiv-Aktion fehlt");
  } else if (!archiveButton.disabled || archiveButton.title !== "Kein aktiver Intake-Kontext für ein Fehlupload-Archiv.") {
    missing.push("Fehlupload-Archiv-Aktion ist ohne aktiven Intake-Kontext nicht sicher deaktiviert");
  }
  const reprocessButton = buttons.find((button) => button.text === "Erneut mit ausgewähltem Typ verarbeiten");
  if (!reprocessButton) {
    missing.push("Wiederverarbeitungs-Aktion fehlt");
  } else if (!reprocessButton.disabled) {
    missing.push("Wiederverarbeitungs-Aktion ist ohne ausgewählte Datei nicht sicher deaktiviert");
  }
  if (missing.length > 0) {
    throw new Error(`Produktions-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-ok" };
}
