import { expect, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright-core";

const BASE_URL = process.env.CATERING_BROWSER_SMOKE_BASE_URL ?? "http://127.0.0.1:3200";
const CHROME_PATH =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function launchChrome(): Promise<Browser> {
  return chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
}

async function textOf(page: Page): Promise<string> {
  return (await page.locator("body").textContent()) ?? "";
}

async function waitForText(page: Page, needle: string, timeout = 30000): Promise<void> {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    needle,
    { timeout }
  );
}

test("creates a positive production plan in a real browser and opens its export", async () => {
  const browser = await launchChrome();

  try {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/produktion`, { waitUntil: "domcontentloaded" });
    await waitForText(page, "Produktionsdienst");

    const productionBody = await textOf(page);
    expect(productionBody).toContain("Produktionsagent");
    expect(productionBody).toContain(
      "Produktions-URL: unabhängige Küchenvorbereitung, Rezepte und Einkaufslisten."
    );
    expect(productionBody).toContain("Produktionsdienst");
    expect(productionBody).toContain("bereit");
    expect(productionBody).toContain("Rezeptbibliothek");
    expect(productionBody).toContain("Produktionspläne");
    expect(productionBody).toContain("Einkaufslisten");

    await page.getByPlaceholder("Veranstaltungstyp, z. B. Konferenz").fill("conference");
    await page.getByPlaceholder("Datum, z. B. 2026-10-10").fill("2026-07-12");
    await page.getByPlaceholder("Teilnehmerzahl").fill("24");
    await page.getByPlaceholder("Serviceform, z. B. Buffet").fill("buffet");
    await page.getByPlaceholder("Menüpunkte, durch Komma getrennt").fill("Caesar Salad Buffet");
    await page.getByPlaceholder("Interne Notizen oder Einschränkungen").fill("Bitte vegetarisch");
    await page.getByRole("button", { name: "Spezifikation anlegen" }).click();

    await waitForText(page, "Konferenz · 24 Teilnehmer · 2026-07-12");
    await waitForText(page, "Caesar Salad Buffet");

    const selects = page.locator("select");
    await selects.nth(3).selectOption("vegetarian");
    await selects.nth(4).selectOption("scratch");
    await selects.nth(5).selectOption("recipe-caesar-salad");
    await page.getByRole("button", { name: "Speichern und Berechnung starten" }).click();

    await waitForText(page, "Produktionsplan wurde erzeugt.");
    const positiveBody = await textOf(page);
    expect(positiveBody).toContain("Status: vollständig");
    expect(positiveBody).toContain("Offene Punkte: keine");
    expect(positiveBody).toContain("Arbeitsblätter: 1");
    expect(positiveBody).toContain("Rezeptblätter: 1");
    expect(positiveBody).toContain("Rezeptauswahl: 1");
    expect(positiveBody).toContain("Caesar Salad Buffet");

    const completePlan = page
      .locator("li", { hasText: "Status: vollständig · Arbeitsblätter: 1 · Rezeptblätter: 1 · Rezeptauswahl: 1 · Offene Punkte: 0" })
      .first();
    const exportLink = completePlan.getByRole("link", { name: "Produktionsblatt exportieren" });
    await exportLink.waitFor({ state: "visible" });
    const href = await exportLink.getAttribute("href");
    expect(href).toContain("/api/exports/v1/exports/production-plans/plan-spec-manual-");

    const [exportPage] = await Promise.all([page.waitForEvent("popup"), exportLink.click()]);
    await exportPage.waitForLoadState("domcontentloaded");
    await waitForText(exportPage, "Status: complete");

    const exportBody = await textOf(exportPage);
    expect(exportBody).toContain("Produktionsplan plan-spec-manual-");
    expect(exportBody).toContain("Status: complete");
    expect(exportBody).toContain("Rezeptauswahl: 1");
    expect(exportBody).toContain("caesar-salad-buffet-1");
    expect(exportBody).not.toMatch(/fallback/i);
    expect(exportBody).not.toMatch(/\bblock\b/i);

    await exportPage.close();
    await page.close();
  } finally {
    await browser.close();
  }
});
