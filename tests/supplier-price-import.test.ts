// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { readSchwanPriceList } from "../backoffice-ui/src/supplier-price-import.js";

const xml = (rows: string) => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
const text = (ref: string, value: string) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
const headers = `<row r="9">${text("A9", "Artikel-Nr")}${text("D9", "Produkt")}${text("G9", "Inhalt")}${text("N9", "Einheit")}${text("P9", "Preis neu")}</row>`;
const archive = (sheet: string) => zipSync({ "xl/worksheets/sheet1.xml": new Uint8Array(strToU8(sheet)) });

describe("Schwan price list import", () => {
  it("reads a candidate and leaves its ambiguous price basis for the user", () => {
    const row = `<row r="13">${text("A13", "SYN-1")}${text("D13", "Beispielreis")}${text("G13", "5 kg")}${text("N13", "Kolli")}<c r="P13"><v>12.5</v></c></row>`;
    expect(readSchwanPriceList(archive(xml(headers + row)))).toEqual([{ article: "SYN-1", product: "Beispielreis", content: "5 kg", unit: "Kolli", price: "12.5", row: 13 }]);
  });
  it("rejects a different or malformed list instead of assigning the wrong columns", () => {
    expect(() => readSchwanPriceList(archive(xml("<row r=\"9\"></row>")))).toThrow();
    expect(() => readSchwanPriceList(new Uint8Array([1, 2, 3]))).toThrow();
  });
  it("does not propose formula results or nonpositive prices", () => {
    const rows = `<row r="13">${text("D13", "Beispielreis")}<c r="P13"><f>2+2</f><v>4</v></c></row><row r="14">${text("D14", "Beispiel")}<c r="P14"><v>0</v></c></row>`;
    expect(readSchwanPriceList(archive(xml(headers + rows)))).toEqual([]);
  });
  it("starts only after the complete matching header, never a preceding partial header", () => {
    const partial = `<row r="1">${text("A1", "Artikel-Nr")}${text("P1", "Preis neu")}</row><row r="2">${text("D2", "Falscher Eintrag")}<c r="P2"><v>5</v></c></row>`;
    const real = `<row r="13">${text("D13", "Beispielreis")}<c r="P13"><v>12.5</v></c></row>`;
    expect(readSchwanPriceList(archive(xml(partial + headers + real))).map(item => item.product)).toEqual(["Beispielreis"]);
  });
});
