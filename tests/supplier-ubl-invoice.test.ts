import { describe, expect, it } from "vitest";
import { parseSupplierUblInvoice } from "../shared-core/src/supplier-ubl-invoice.js";

const xml = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>INV-1</cbc:ID><cbc:IssueDate>2026-10-01</cbc:IssueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Testlieferant</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">10.00</cbc:TaxExclusiveAmount></cac:LegalMonetaryTotal><cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="KGM">2.5</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Testware</cbc:Name></cac:Item></cac:InvoiceLine></Invoice>`;
describe("supplier UBL candidates", () => {
  it("preserves the stated quantity and line net as reviewable evidence", () => {
    expect(parseSupplierUblInvoice(xml)).toMatchObject([{ supplier: "Testlieferant", invoiceId: "INV-1", invoiceDate: "2026-10-01", lineId: "1", article: "Testware", quantity: "2.5", unit: "kg", lineNetEur: "10.00", reviewRequired: true }]);
  });
  it("adds multiple positions exactly and checks both document totals", () => {
    const line = xml.match(/<cac:InvoiceLine>.*<\/cac:InvoiceLine>/)![0];
    const second = line.replace("<cbc:ID>1</cbc:ID>", "<cbc:ID>2</cbc:ID>").replace(">10.00<", ">0.20<");
    const invoice = xml.replace("<cbc:TaxExclusiveAmount currencyID=\"EUR\">10.00", "<cbc:TaxExclusiveAmount currencyID=\"EUR\">10.20").replace("<cbc:LineExtensionAmount currencyID=\"EUR\">10.00", "<cbc:LineExtensionAmount currencyID=\"EUR\">10.20").replace("</Invoice>", second + "</Invoice>");
    expect(parseSupplierUblInvoice(invoice)).toHaveLength(2);
    expect(() => parseSupplierUblInvoice(invoice.replace(">10.20</cbc:TaxExclusiveAmount>", ">10.19</cbc:TaxExclusiveAmount>"))).toThrow("UBL_TOTAL_MISMATCH");
    expect(() => parseSupplierUblInvoice(invoice.replace(">10.20</cbc:LineExtensionAmount>", ">10.19</cbc:LineExtensionAmount>"))).toThrow("UBL_TOTAL_MISMATCH");
  });
  it("rejects nested lines and declared nonzero adjustments with specific errors", () => {
    expect(() => parseSupplierUblInvoice(xml.replace("</cac:InvoiceLine>", "<cac:SubInvoiceLine/></cac:InvoiceLine>"))).toThrow("UBL_SUB_INVOICE_LINE_UNSUPPORTED");
    for (const field of ["AllowanceTotalAmount", "ChargeTotalAmount"]) {
      const withTotal = (amount: string) => xml.replace("</cac:LegalMonetaryTotal>", `<cbc:${field} currencyID="EUR">${amount}</cbc:${field}></cac:LegalMonetaryTotal>`);
      expect(parseSupplierUblInvoice(withTotal("0.00"))).toHaveLength(1);
      expect(() => parseSupplierUblInvoice(withTotal("0.01"))).toThrow("UBL_ADJUSTMENT_TOTAL_UNSUPPORTED");
    }
    expect(() => parseSupplierUblInvoice(xml.replace("</Invoice>", "<cac:AllowanceCharge/></Invoice>"))).toThrow("UBL_ADJUSTMENTS_REQUIRE_REVIEW");
  });
  it("rejects missing, ambiguous, malformed or non-EUR totals", () => {
    expect(() => parseSupplierUblInvoice(xml.replace(/<cbc:TaxExclusiveAmount[^>]*>.*?<\/cbc:TaxExclusiveAmount>/, ""))).toThrow("UBL_MISSING_OR_AMBIGUOUS_FIELD");
    expect(() => parseSupplierUblInvoice(xml.replace("<cbc:TaxExclusiveAmount", "<cbc:TaxExclusiveAmount currencyID=\"USD\">10</cbc:TaxExclusiveAmount><cbc:TaxExclusiveAmount"))).toThrow("UBL_MISSING_OR_AMBIGUOUS_FIELD");
    expect(() => parseSupplierUblInvoice(xml.replace('<cbc:TaxExclusiveAmount currencyID="EUR">10.00', '<cbc:TaxExclusiveAmount currencyID="USD">10.00'))).toThrow("UBL_INVALID_TOTAL_CURRENCY");
    expect(() => parseSupplierUblInvoice(xml.replace(">10.00</cbc:TaxExclusiveAmount>", ">NaN</cbc:TaxExclusiveAmount>"))).toThrow("UBL_INVALID_TOTAL");
  });
  it("marks a single supplier tax identifier as unverified", () => {
    const tax = '<cac:PartyTaxScheme><cbc:CompanyID>DE123</cbc:CompanyID></cac:PartyTaxScheme>';
    expect(parseSupplierUblInvoice(xml.replace("</cac:Party>", tax + "</cac:Party>"))[0]?.supplierTaxId).toEqual({ value: "DE123", verified: false });
    expect(() => parseSupplierUblInvoice(xml.replace("</cac:Party>", tax + tax + "</cac:Party>"))).toThrow("UBL_AMBIGUOUS_TAX_ID");
  });
  it.each([
    xml.replace("</Invoice>", "<cac:AllowanceCharge/></Invoice>"),
    xml.replace(">380<", ">381<"), xml.replace("KGM", "BOX"),
    ...["constructor", "toString", "__proto__"].map((code) => xml.replace("KGM", code)), xml.replace('currencyID="EUR"', 'currencyID="USD"'),
    xml.replace("2026-10-01", "2026-02-30"), xml.replace("2.5", "-2"),
    xml.replace("<cbc:ID>INV-1</cbc:ID>", "<cbc:ID>1</cbc:ID><cbc:ID>2</cbc:ID>"),
    '<!DOCTYPE Invoice [<!ENTITY x "x">]>' + xml,
    xml.replace("</Invoice>", "<cac:InvoiceLine/></Invoice>")
  ])("rejects unsafe or ambiguous inputs", (input) => expect(() => parseSupplierUblInvoice(input)).toThrow());
});
