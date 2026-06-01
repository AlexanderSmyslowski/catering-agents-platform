() => {
  const candidates = [...document.querySelectorAll("a")];
  const link = candidates.find((anchor) =>
    anchor.getAttribute("href") === "/produktion" &&
    (anchor.textContent ?? "").includes("Zur Produktion")
  );
  if (!link) {
    throw new Error("Angebot-Handoff-Link zur Produktion fehlt");
  }
  link.click();
  return { clicked: link.textContent?.trim() };
}
