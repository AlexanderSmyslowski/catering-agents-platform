// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { IngredientCostHelper } from "../backoffice-ui/src/ingredient-cost-helper.js";
import { priceSourceApi } from "../backoffice-ui/src/price-source-api.js";
import { PriceSourceSettings } from "../backoffice-ui/src/price-source-settings.js";
import { PriceSourceReview } from "../backoffice-ui/src/price-source-review.js";

it("uses the selected supplier quotation with its recorded pack size and provenance", async () => {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  const fetch = vi.spyOn(priceSourceApi, "prices").mockResolvedValue({
    prices: [
      {
        article: "T1",
        sourceId: "local",
        sourceName: "Testliste",
        ingredientKey: "Reis",
        description: "Reis",
        quantity: "5",
        unit: "kg",
        price: "11.00",
        observedAt: "2026-11-08",
        validFrom: "2026-11-09",
      },
    ],
  });
  const apply = vi.fn();
  const label = (start: string) =>
    Array.from(element.querySelectorAll("label")).find((l) =>
      l.textContent?.startsWith(start),
    )!;
  const enter = async (start: string, value: string) => {
    const field = label(start).querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  try {
    await act(async () =>
      root.render(
        createElement(IngredientCostHelper, {
          onApply: apply,
          onInvalidate: vi.fn(),
        }),
      ),
    );
    await enter("Zutat oder Kostenbestandteil", "Reis");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    await act(async () =>
      Array.from(element.querySelectorAll("button"))
        .find((b) => b.textContent?.includes("Testliste · Reis"))!
        .click(),
    );
    expect(label("Menge im Preisbezug").querySelector("input")?.value).toBe(
      "5",
    );
    await enter("Benötigte Menge", "2");
    await act(async () =>
      label("Alle direkten Kosten").querySelector("input")!.click(),
    );
    await act(async () =>
      Array.from(element.querySelectorAll("button"))
        .find((b) => b.textContent === "Kostensumme als Schätzung übernehmen")!
        .click(),
    );
    expect(apply).toHaveBeenCalledWith(
      "4.40",
      expect.stringContaining("Testliste, Art. T1, gültig ab 2026-11-09"),
    );
  } finally {
    fetch.mockRestore();
    await act(async () => root.unmount());
    element.remove();
  }
});

it("requires a new price basis when a known product changes from kg to a box", async () => {
  const element = document.createElement("div");
  const root = createRoot(element);
  const save = vi.fn();
  try {
    await act(async () =>
      root.render(
        createElement(PriceSourceReview, {
          preview: {
            id: "p2",
            createdAt: "2026-11-09",
            rows: [
              {
                article: "X",
                description: "Reis",
                price: "7",
                quantity: "Karton",
                unit: "Kolli",
              },
            ],
          },
          initial: [
            {
              article: "X",
              ingredientKey: "Reis",
              quantity: "1",
              unit: "kg",
              rawQuantity: "1",
              rawUnit: "kg",
            },
          ],
          action: "Prüfen",
          onSave: save,
        }),
      ),
    );
    const button = (name: string) => Array.from(element.querySelectorAll("button")).find(entry => entry.textContent === name)!;
    expect(button("Prüfen").disabled).toBe(true);
    expect(element.querySelector("select")?.value).toBe("");
    await act(async () => button("Später prüfen").click());
    expect(button("Prüfen").disabled).toBe(true);
    const remove = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(remove.checked).toBe(false);
    await act(async () => remove.click());
    await act(async () => button("Prüfen").click());
    expect(save).toHaveBeenCalledWith([], ["X"]);
  } finally {
    await act(async () => root.unmount());
  }
});

it("requires an explicit sender search and clears the sample when the sender changes", async () => {
  const element = document.createElement("div");
  const root = createRoot(element);
  vi.spyOn(priceSourceApi, "sources").mockResolvedValue({ sources: [] });
  vi.spyOn(priceSourceApi, "mailboxes").mockResolvedValue({
    mailboxes: [{ id: "office", label: "Posteingang" }],
  });
  const search = vi.spyOn(priceSourceApi, "messages").mockResolvedValue({
    messages: [
      {
        uid: 1,
        uidValidity: "1",
        from: "list@example.org",
        subject: "Preisliste",
        attachments: [{ part: "2", filename: "preise.xlsx" }],
      },
    ],
  });
  const click = async (text: string) =>
    act(async () =>
      Array.from(element.querySelectorAll("button"))
        .find((button) => button.textContent === text)!
        .click(),
    );
  try {
    await act(async () => root.render(createElement(PriceSourceSettings)));
    await click("E-Mail-Preisquellen");
    await click("Preisquelle hinzufügen");
    expect(search).not.toHaveBeenCalled();
    const field = element.querySelector<HTMLInputElement>(
      'input[type="email"]',
    )!;
    const input = async (value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await input("list@example.org");
    await click("Preislisten suchen");
    expect(search).toHaveBeenCalledWith("office", "list@example.org");
    expect(element.textContent).toContain("preise.xlsx");
    await input("other@example.org");
    expect(element.textContent).not.toContain("preise.xlsx");
    expect(search).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
  }
});
