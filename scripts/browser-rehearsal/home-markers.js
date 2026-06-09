() => {
  const text = document.body.innerText;
  const missing = [
    "Catering-Agenten",
    "Interner Arbeitsstand",
    "Arbeitsweg: Start → Angebot → Produktion → Rückfragen → Exporte.",
    "keine automatische Allergen-, Preis- oder Margenfreigabe",
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
