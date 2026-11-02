import { strFromU8, unzipSync } from "fflate";

export type SupplierPriceCandidate = { article: string; product: string; content: string; unit: string; price: string; row: number };

// Supplier spreadsheets are untrusted input. Only the two XML parts needed for
// the price list are expanded, with bounded archive and expanded sizes.
export function readSchwanPriceList(data: Uint8Array): SupplierPriceCandidate[] {
  if (data.length > 5_000_000) throw new Error("Die Datei ist zu groß. Bitte eine Preisliste bis 5 MB wählen.");
  let parts: Record<string, Uint8Array>;
  let expanded = 0;
  const seen = new Set<string>();
  try {
    parts = unzipSync(data, { filter: file => {
      if (!["xl/worksheets/sheet1.xml", "xl/sharedStrings.xml"].includes(file.name)) return false;
      if (seen.has(file.name)) throw new Error("duplicate");
      seen.add(file.name);
      expanded += file.originalSize;
      if (expanded > 8_000_000 || file.originalSize > 8_000_000) throw new Error("size");
      return true;
    } });
  } catch {
    throw new Error("Die Excel-Datei konnte nicht sicher gelesen werden. Bitte die ursprüngliche Preisliste wählen.");
  }
  if (!parts["xl/worksheets/sheet1.xml"]) throw new Error("Die Preisliste enthält kein lesbares Tabellenblatt.");
  const parse = (bytes: Uint8Array) => {
    const document = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
    if (document.querySelector("parsererror")) throw new Error("Die Preisliste enthält ungültige Tabellendaten.");
    return document;
  };
  const shared = parts["xl/sharedStrings.xml"] ? Array.from(parse(parts["xl/sharedStrings.xml"]).getElementsByTagName("si"), node => node.textContent ?? "") : [];
  const document = parse(parts["xl/worksheets/sheet1.xml"]);
  const rows = Array.from(document.getElementsByTagName("row"));
  function values(row: Element): Map<string, string> {
    const result = new Map<string, string>();
    for (const cell of Array.from(row.getElementsByTagName("c"))) {
      const column = cell.getAttribute("r")?.match(/^[A-Z]+/)?.[0];
      if (!column || cell.getElementsByTagName("f").length) continue;
      const type = cell.getAttribute("t");
      const raw = type === "inlineStr" ? cell.getElementsByTagName("is")[0]?.textContent : cell.getElementsByTagName("v")[0]?.textContent;
      const value = type === "s" && /^\d+$/.test(raw ?? "") ? shared[Number(raw)] : raw;
      if (value) result.set(column, value.trim());
    }
    return result;
  }
  const headerIndex = rows.findIndex(row => {
    const cells = values(row);
    return cells.get("A") === "Artikel-Nr" && cells.get("D") === "Produkt" && cells.get("G") === "Inhalt" && cells.get("N") === "Einheit" && cells.get("P") === "Preis neu";
  });
  if (headerIndex < 0) throw new Error("Das Format der Schwan-Preisliste wurde nicht erkannt. Bitte die Liste prüfen.");
  const candidates: SupplierPriceCandidate[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const cells = values(row);
    const product = cells.get("D") ?? "", price = (cells.get("P") ?? "").replace(",", ".");
    const rowNumber = Number(row.getAttribute("r"));
    if (!product || !/^\d{1,6}(?:\.\d{1,4})?$/.test(price) || Number(price) <= 0 || !Number.isSafeInteger(rowNumber)) continue;
    candidates.push({ article: cells.get("A") ?? "", product, content: cells.get("G") ?? "", unit: cells.get("N") ?? "", price, row: rowNumber });
    if (candidates.length > 10_000) throw new Error("Die Preisliste enthält zu viele Positionen.");
  }
  return candidates;
}
