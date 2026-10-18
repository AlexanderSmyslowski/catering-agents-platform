() => {
  const link = [...document.querySelectorAll("nav a[href='/produktion']")]
    .find((anchor) => anchor.offsetParent !== null);
  if (!link) throw new Error("Navigation zur Produktionsübersicht fehlt");
  link.click();
  return { clicked: link.textContent?.trim() };
}
