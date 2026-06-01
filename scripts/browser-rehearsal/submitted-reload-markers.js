async () => {
  const text = document.body.innerText;
  const html = document.body.innerHTML;
  const exportLinks = [...document.querySelectorAll("a")]
    .map((anchor) => anchor.getAttribute("href") ?? "");
  const missing = [];
  const planContext = text.match(/Plan-Kontext: planId ([^\s]+) · specId ([^\s]+)/);
  const purchaseContext = text.match(/purchaseListId: ([^\s]+) · specId: ([^\s]+)/);
  let planId;
  let planSpecId;
  let purchaseListId;
  let purchaseSpecId;

  if (!text.includes("Teilnehmerzahl: 43")) {
    missing.push("Answer-Submit-Rehearsal Reload ohne gespeicherte strukturierte Teilnehmerzahl");
  }
  if (!planContext) {
    missing.push("Answer-Submit-Rehearsal Reload ohne aktuellen Plan-Kontext");
  } else {
    [, planId, planSpecId] = planContext;
  }
  if (!purchaseContext) {
    missing.push("Answer-Submit-Rehearsal Reload ohne aktuelle Einkaufsliste");
  } else {
    [, purchaseListId, purchaseSpecId] = purchaseContext;
  }

  if (planId && planSpecId) {
    const expectedPlanHref = `/api/exports/v1/exports/production-plans/${planId}/html`;
    if (!exportLinks.includes(expectedPlanHref)) {
      missing.push(`Answer-Submit-Rehearsal Reload Produktionsplan-Exportlink passt nicht zu ${planId}`);
    } else {
      const planExportResponse = await fetch(expectedPlanHref);
      if (!planExportResponse.ok) {
        missing.push(`Answer-Submit-Rehearsal Reload Produktionsplan-Export ist nicht abrufbar: ${planExportResponse.status}`);
      } else {
        const planExportBody = await planExportResponse.text();
        if (!planExportBody.includes(`Produktionsplan ${planId}`)) {
          missing.push(`Answer-Submit-Rehearsal Reload Produktionsplan-Exportinhalt passt nicht zu ${planId}`);
        }
      }
    }
    if (!text.includes(`Produktionsblatt exportieren\nfür Plan ${planId} · Spezifikation ${planSpecId}`)) {
      missing.push(`Answer-Submit-Rehearsal Reload Produktionsplan-Exportlabel passt nicht zu ${planId}/${planSpecId}`);
    }
  }

  if (purchaseListId && purchaseSpecId) {
    const expectedPurchaseHref = `/api/exports/v1/exports/purchase-lists/${purchaseListId}/csv`;
    if (!exportLinks.includes(expectedPurchaseHref)) {
      missing.push(`Answer-Submit-Rehearsal Reload Einkaufslisten-Exportlink passt nicht zu ${purchaseListId}`);
    } else {
      const purchaseExportResponse = await fetch(expectedPurchaseHref);
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
    if (!text.includes(`Einkaufsliste exportieren\nfür aktuellen Vorgang ${purchaseListId} · Spezifikation ${purchaseSpecId}`)) {
      missing.push(`Answer-Submit-Rehearsal Reload Einkaufslisten-Exportlabel passt nicht zu ${purchaseListId}/${purchaseSpecId}`);
    }
  }

  if (planId && planSpecId && purchaseListId && purchaseSpecId) {
    if (planSpecId !== purchaseSpecId) {
      missing.push(`Answer-Submit-Rehearsal Reload Abschluss-Kontext hat unterschiedliche Spezifikationen ${planSpecId}/${purchaseSpecId}`);
    }
    const expectedHandoffContext =
      `Abschluss-Kontext: planId ${planId} · specId ${planSpecId} · purchaseListId ${purchaseListId}`;
    if (!text.includes(expectedHandoffContext)) {
      missing.push("Answer-Submit-Rehearsal Reload ohne passenden Abschluss-Kontext");
    }
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
