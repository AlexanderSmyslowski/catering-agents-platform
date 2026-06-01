() => {
  const candidates = [...document.querySelectorAll("a")];
  const link = candidates.find((anchor) =>
    anchor.getAttribute("href") === "/angebot" &&
    ((anchor.textContent ?? "").includes("Angebotsagent öffnen") ||
      (anchor.textContent ?? "").includes("Angebotsagent"))
  );
  if (!link) {
    throw new Error("Start-Link zum Angebotsagent fehlt");
  }
  link.click();
  return { clicked: link.textContent?.trim() };
}
