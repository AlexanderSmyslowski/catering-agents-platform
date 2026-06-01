() => {
  const text = document.body.innerText;
  const missing = [
    "Catering-Agenten",
    "Internes Beta-Kontrollzentrum",
    "Beta-Weg: Start → Angebot → Produktion → Rückfragen → Exporte/Audit.",
    "Rehearsal-Go: erst nach grünem Status, lokalem Check, manueller UI-Evidenz und Reibungslog.",
    "Nächster Einstieg: zuerst Angebot prüfen, danach Produktion und offene Rückfragen klären."
  ].filter((marker) => !text.includes(marker));
  const links = [...document.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href"));
  for (const href of ["/angebot", "/produktion"]) {
    if (!links.includes(href)) {
      missing.push(`Link fehlt: ${href}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Start-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "home-ok" };
}
