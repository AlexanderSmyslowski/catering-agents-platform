() => {
  const text = document.body.innerText;
  const missing = [
    "Catering-Agenten",
    "Neuen Auftrag beginnen",
    "Frühere Aufträge"
  ].filter((marker) => !text.includes(marker));

  const expectedActions = [
    { href: "/angebot", label: "Neuen Auftrag beginnen" },
    { href: "/angebot#history", label: "Frühere Aufträge" }
  ];
  const visibleActions = [...document.querySelectorAll("nav[aria-label='Startauswahl'] a")].filter(
    (anchor) => anchor.offsetParent !== null
  );
  for (const action of expectedActions) {
    const found = visibleActions.some(
      (anchor) =>
        anchor.getAttribute("href") === action.href &&
        (anchor.textContent ?? "").includes(action.label)
    );
    if (!found) {
      missing.push(`Startaktion fehlt: ${action.label} -> ${action.href}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Start-Rehearsal-Marker fehlen: ${missing.join(" | ")}`);
  }
  return { route: location.pathname, markers: "home-ok" };
}
