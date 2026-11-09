async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const header = document.querySelector('[aria-label="Geöffneter Auftrag"]');
    const summary = document.querySelector('[aria-label="Kompakte Produktionszusammenfassung"]');
    const current = document.querySelector('.production-stage-nav button[aria-current="step"]');
    if (!header || document.activeElement !== header || header.getBoundingClientRect().top < -2 || header.getBoundingClientRect().top > 180) { await new Promise((resolve) => setTimeout(resolve, 100)); continue; }
    if (!(summary instanceof HTMLDetailsElement) || !summary.open || !current) { await new Promise((resolve) => setTimeout(resolve, 100)); continue; }
    const active = getComputedStyle(current);
    const other = document.querySelector('.production-stage-nav button:not([aria-current])');
    if (!other || active.backgroundColor === getComputedStyle(other).backgroundColor) { await new Promise((resolve) => setTimeout(resolve, 100)); continue; }
    return true;
  }
  throw new Error("Handoff am Auftragskopf wurde nicht sichtbar bestätigt.");
}
