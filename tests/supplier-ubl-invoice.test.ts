import { describe, expect, it } from "vitest";
import { parseSupplierUblInvoice } from "../shared-core/src/supplier-ubl-invoice.js";

const xml = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>INV-1</cbc:ID><cbc:IssueDate>2026-10-01</cbc:IssueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Testlieferant</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="KGM">2.5</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Testware</cbc:Name></cac:Item></cac:InvoiceLine></Invoice>`;
describe("supplier UBL candidates", () => {
  it("preserves the stated quantity and line net as reviewable evidence", () => {
    expect(parseSupplierUblInvoice(xml)).toMatchObject([{ supplier: "Testlieferant", invoiceId: "INV-1", invoiceDate: "2026-10-01", lineId: "1", article: "Testware", quantity: "2.5", unit: "kg", lineNetEur: "10.00", reviewRequired: true }]);
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
