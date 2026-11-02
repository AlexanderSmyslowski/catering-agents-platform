import { JSDOM } from "jsdom";

const INVOICE = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
const CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
const UNITS: Record<string, string> = { KGM: "kg", GRM: "g", LTR: "l", MLT: "ml", C62: "Stück" };

export interface SupplierInvoiceCandidate {
  supplier: string;
  invoiceId: string;
  invoiceDate: string;
  lineId: string;
  article: string;
  quantity: string;
  unit: string;
  lineNetEur: string;
  reviewRequired: true;
  limitations: string[];
}

function children(parent: Element, namespace: string, name: string): Element[] {
  return Array.from(parent.children).filter((item) => item.namespaceURI === namespace && item.localName === name);
}
function one(parent: Element, namespace: string, name: string): Element {
  const found = children(parent, namespace, name);
  if (found.length !== 1) throw new Error("UBL_MISSING_OR_AMBIGUOUS_FIELD");
  return found[0]!;
}
function value(parent: Element, namespace: string, name: string): string {
  const element = one(parent, namespace, name);
  if (element.children.length) throw new Error("UBL_INVALID_FIELD");
  const result = element.textContent?.trim() ?? "";
  if (!result || result.length > 500) throw new Error("UBL_INVALID_FIELD");
  return result;
}
function decimal(text: string): boolean {
  return /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(text) && /[1-9]/.test(text);
}

/** Returns provisional invoice line evidence; it does not verify the issuer or approve prices. */
export function parseSupplierUblInvoice(xml: string): SupplierInvoiceCandidate[] {
  if (Buffer.byteLength(xml, "utf8") > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("UBL_UNSAFE_DOCUMENT");
  let doc: Document;
  try { doc = new JSDOM(xml, { contentType: "text/xml" }).window.document; }
  catch { throw new Error("UBL_INVALID_XML"); }
  const root = doc.documentElement;
  if (root.namespaceURI !== INVOICE || root.localName !== "Invoice") throw new Error("UBL_NOT_INVOICE");
  // Reject adjustments rather than silently assigning an invoice-level discount to lines.
  if (doc.getElementsByTagNameNS(CAC, "AllowanceCharge").length) throw new Error("UBL_ADJUSTMENTS_REQUIRE_REVIEW");
  if (value(root, CBC, "InvoiceTypeCode") !== "380") throw new Error("UBL_UNSUPPORTED_INVOICE_TYPE");
  if (value(root, CBC, "DocumentCurrencyCode") !== "EUR") throw new Error("UBL_UNSUPPORTED_CURRENCY");
  const invoiceId = value(root, CBC, "ID");
  const invoiceDate = value(root, CBC, "IssueDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || !Number.isFinite(Date.parse(invoiceDate)) || new Date(invoiceDate).toISOString().slice(0, 10) !== invoiceDate) throw new Error("UBL_INVALID_DATE");
  const supplierParty = one(one(root, CAC, "AccountingSupplierParty"), CAC, "Party");
  const legal = one(supplierParty, CAC, "PartyLegalEntity");
  const supplier = value(legal, CBC, "RegistrationName");
  const lines = children(root, CAC, "InvoiceLine");
  if (!lines.length || lines.length > 5000) throw new Error("UBL_INVALID_LINES");
  const ids = new Set<string>();
  return lines.map((line) => {
    const lineId = value(line, CBC, "ID");
    if (ids.has(lineId)) throw new Error("UBL_DUPLICATE_LINE");
    ids.add(lineId);
    const quantityElement = one(line, CBC, "InvoicedQuantity");
    const quantity = value(line, CBC, "InvoicedQuantity");
    const unit = UNITS[quantityElement.getAttribute("unitCode") ?? ""];
    if (!unit || !decimal(quantity)) throw new Error("UBL_UNSUPPORTED_QUANTITY");
    const amount = one(line, CBC, "LineExtensionAmount");
    const lineNetEur = value(line, CBC, "LineExtensionAmount");
    if (amount.getAttribute("currencyID") !== "EUR" || !decimal(lineNetEur)) throw new Error("UBL_UNSUPPORTED_AMOUNT");
    const article = value(one(line, CAC, "Item"), CBC, "Name");
    return { supplier, invoiceId, invoiceDate, lineId, article, quantity, unit, lineNetEur, reviewRequired: true,
      limitations: ["Ungeprüfter Beleg; Lieferant, Position und Preisstand prüfen.", "Positionsnetto enthält keine zugeordneten Dokumentkosten; kein Grundpreis berechnet."] };
  });
}
