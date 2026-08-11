() => {
  const text = document.body.innerText;
  const missing = [
    "Produktionsagent",
    "Angebot hochladen oder Produktionsauftrag beschreiben",
    "Ablauf: Quelle → KI-Entwurf → Prüfung → Plan",
    "Frühere Produktionsaufträge öffnen",
    "5 Aufträge"
  ].filter((marker) => !text.includes(marker));
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
