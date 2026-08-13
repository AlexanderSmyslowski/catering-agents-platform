() => {
  const candidates = [...document.querySelectorAll("nav[aria-label='Startauswahl'] a")];
  const link = candidates.find((anchor) =>
    anchor.offsetParent !== null &&
    anchor.getAttribute("href") === "/angebot" &&
    (anchor.textContent ?? "").trim() === "Neuen Auftrag beginnen"
  );
  if (!link) {
    throw new Error("Start-Link zum Angebotsagent fehlt: Neuen Auftrag beginnen -> /angebot");
  }
  link.click();
  return { clicked: link.textContent?.trim() };
}
