() => {
  const text = document.body.innerText;
  const missing = [
    "Produktionsagent",
    "Angebot hochladen oder Produktionsauftrag beschreiben",
    "Ablauf: Quelle → KI-Entwurf → Prüfung → Plan",
    "Frühere Produktionsaufträge öffnen"
  ].filter((marker) => !text.includes(marker));
  if (!/(?:^|\s)0 Aufträge(?:$|\s)/u.test(text)) {
    missing.push("0 Aufträge");
  }
  const contradictoryCounts = [...text.matchAll(/(?:^|\s)(?:[1-9]\d*) Aufträge(?:$|\s)/gu)]
    .map((match) => match[0].trim())
    .filter((count) => count !== "0 Aufträge");
  if (contradictoryCounts.length > 0) {
    missing.push(`widersprüchlicher Auftragszähler: ${contradictoryCounts.join(", ")}`);
  }
  const visibleExport = [...document.querySelectorAll("a")].some((anchor) =>
    anchor.offsetParent !== null && (anchor.getAttribute("href") ?? "").includes("/api/exports/")
  );
  if (visibleExport) {
    missing.push("leerer Produktionsstart zeigt bereits einen Export");
  }
  if (text.includes("Plan-Kontext: aktueller Produktionsplan") || text.includes("Rückfragen und Antworten")) {
    missing.push("leerer Produktionsstart fokussiert bereits einen früheren Auftrag");
  }
  if (missing.length > 0) {
    throw new Error(`Leerer Produktionsstart unvollständig: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "production-empty-ok" };
}
