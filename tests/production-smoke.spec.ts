import { expect, test, type Page } from "@playwright/test";

const productionPath = "/produktion";
const intakeText =
  "Lunch am 2026-06-18 fuer 40 Teilnehmer mit Buffet, Tomatensuppe und Brot.";
const specLabel = "Lunch · 40 Teilnehmer · 2026-06-18";

async function openProductionAgent(page: Page) {
  await page.goto(productionPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Produktionsagent" })).toBeVisible();
}

function stepOne(page: Page) {
  return page.locator("article").filter({
    has: page.getByRole("heading", { name: "Angebot hineinziehen oder hochladen" })
  });
}

function stepTwo(page: Page) {
  return page.locator("article").filter({
    has: page.getByRole("heading", { name: "Rückfragen des Agenten" })
  });
}

function stepThree(page: Page) {
  return page.locator("article").filter({
    has: page.getByRole("heading", { name: "Berechnete Ergebnisse" })
  });
}

function freeTextField(page: Page) {
  return stepOne(page)
    .getByRole("heading", { name: "Freitext direkt einfügen" })
    .locator("xpath=ancestor::header[1]/following-sibling::textarea[1]");
}

test.describe("Produktionsagent Smoke", () => {
  test("laedt die Produktionsseite mit den Kernbereichen", async ({ page }) => {
    await openProductionAgent(page);

    await expect(stepOne(page).getByRole("heading", { name: "Angebot hineinziehen oder hochladen" })).toBeVisible();
    await expect(stepOne(page).getByRole("button", { name: "Datei hochladen" })).toBeVisible();
    await expect(stepOne(page).getByRole("button", { name: "Löschen" })).toBeVisible();
    await expect(stepTwo(page).getByRole("heading", { name: "Rückfragen des Agenten" })).toBeVisible();
    await expect(stepThree(page).getByRole("heading", { name: "Berechnete Ergebnisse" })).toBeVisible();
  });

  test("normalisiert Freitext und erzeugt einen sichtbaren Produktionslauf", async ({ page }) => {
    await openProductionAgent(page);

    await expect(stepOne(page).getByRole("heading", { name: "Freitext direkt einfügen" })).toBeVisible();
    await freeTextField(page).fill(intakeText);
    await stepOne(page).getByRole("button", { name: "Erfassungstext normalisieren" }).click();

    await expect(stepTwo(page).getByText(specLabel, { exact: false })).toBeVisible();

    await stepTwo(page).getByRole("button", { name: "Berechnung starten" }).click();

    await expect(
      stepThree(page).getByText("Rezeptsuche, Produktionsplanung und Einkaufsberechnung laufen", {
        exact: false
      })
    ).toBeVisible();

    await expect(stepThree(page).locator("h4").filter({ hasText: specLabel }).first()).toBeVisible();
    await expect(
      stepThree(page).getByRole("link", { name: "Produktionsplan drucken / als PDF öffnen" }).first()
    ).toBeVisible();
  });

  test("leert mit Löschen die Rückfragen und Ergebnisse des aktuellen Vorgangs", async ({ page }) => {
    await openProductionAgent(page);

    await expect(stepOne(page).getByRole("heading", { name: "Freitext direkt einfügen" })).toBeVisible();
    await freeTextField(page).fill(intakeText);
    await stepOne(page).getByRole("button", { name: "Erfassungstext normalisieren" }).click();
    await expect(stepTwo(page).getByText(specLabel, { exact: false })).toBeVisible();

    await stepOne(page).getByRole("button", { name: "Löschen" }).click();

    await expect(
      page.getByText("Aktueller Upload wurde verworfen. Rückfragen und Ergebnisse wurden geleert.", {
        exact: false
      })
    ).toBeVisible();
    await expect(
      stepTwo(page).getByText("Der aktuelle Vorgang wurde geleert.", {
        exact: false
      })
    ).toBeVisible();
    await expect(stepThree(page).getByRole("heading", { name: "Kein aktiver Vorgang" })).toBeVisible();
    await expect(
      stepThree(page).getByText("Die Ergebnisfelder wurden geleert.", {
        exact: false
      })
    ).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(stepTwo(page).getByText(specLabel, { exact: false })).toHaveCount(0);
    await expect(stepThree(page).getByText(specLabel, { exact: false })).toHaveCount(0);
  });
});
