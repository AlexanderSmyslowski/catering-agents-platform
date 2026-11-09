import { describe, expect, it } from 'vitest';
import { inspectSupplierTable, parseSupplierTable } from '../offer-service/src/supplier-table.js';
const enc = new TextEncoder();
const cell = (r: string, value: string) => `<c r="${r}" t="inlineStr"><is><t>${value}</t></is></c>`;
const sheet = (rows: string) => ({sheet: enc.encode(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`)});
const header = `<row r="9">${cell('A9','Artikel-Nr')}${cell('D9','Produkt')}${cell('G9','Inhalt')}${cell('N9','Einheit')}${cell('P9','Preis neu')}</row>`;
const row = `<row r="13">${cell('A13','SYN-1')}${cell('D13','Reis')}${cell('G13','5 kg')}${cell('N13','Kolli')}<c r="P13"><v>12.5</v></c></row>`;
const mapping = {headerRow:9, columns:{article:'A',description:'D',quantity:'G',unit:'N',price:'P'}, headers:{article:'Artikel-Nr',description:'Produkt',quantity:'Inhalt',unit:'Einheit',price:'Preis neu'}};
describe('supplier table parts', () => {
 it('inspects and parses a Schwan-shaped list without inventing pack basis', () => {
  const input=sheet(header+row);
  expect(inspectSupplierTable(input).rows[0].cells.P).toBe('Preis neu');
  expect(parseSupplierTable(input,mapping).rows).toEqual([{row:13,article:'SYN-1',description:'Reis',quantity:'5 kg',unit:'Kolli',price:'12.5'}]);
 });
 it('rejects changed headers, formulas, ambiguous numeric text and duplicate cells', () => {
  expect(() => parseSupplierTable(sheet(header.replace('Preis neu','Preis alt')+row),mapping)).toThrow();
  expect(() => parseSupplierTable(sheet(header+row.replace('<v>12.5</v>','<f>1+1</f><v>2</v>')),mapping)).toThrow();
  expect(() => parseSupplierTable(sheet(header+row.replace('<c r="P13"><v>12.5</v></c>',cell('P13','1.250'))),mapping)).toThrow();
  expect(() => parseSupplierTable(sheet(header+row.replace('</row>',cell('P13','3')+'</row>')),mapping)).toThrow();
 });
});
describe('alternative layout and boundaries', () => {
 it('uses explicitly mapped headers in different columns', () => {
  const h=`<row r="1">${cell('B1','Name')}${cell('C1','Artikel')}${cell('F1','Preis')}${cell('H1','Menge')}${cell('J1','Einheit')}</row>`;
  const r=`<row r="2">${cell('B2','Mehl')}${cell('C2','X2')}${cell('F2','4,20')}${cell('H2','1')}${cell('J2','kg')}</row>`;
  const m={headerRow:1,columns:{article:'C',description:'B',price:'F',quantity:'H',unit:'J'},headers:{article:'Artikel',description:'Name',price:'Preis',quantity:'Menge',unit:'Einheit'}};
  expect(parseSupplierTable(sheet(h+r),m).rows[0]).toEqual({row:2,article:'X2',description:'Mehl',price:'4.20',quantity:'1',unit:'kg'});
 });
 it('rejects XML declarations and invalid shared-string indices', () => {
  expect(() => inspectSupplierTable({sheet:enc.encode('<!DOCTYPE worksheet><worksheet/>')})).toThrow();
  expect(() => inspectSupplierTable(sheet('<row r="1"><c r="A1" t="s"><v>99</v></c></row>'))).toThrow();
 });
});
it('rejects repeated value nodes instead of combining them into a price', () => {
 expect(() => parseSupplierTable(sheet(header+row.replace('<v>12.5</v>','<v>1</v><v>2</v>')),mapping)).toThrow();
});
it('reports incomplete rows and ignores unrelated unsupported cell types', () => {
 const incomplete=`<row r="14">${cell('A14','X')}${cell('D14','Unvollständig')}</row>`;
 const result=parseSupplierTable(sheet(header+row.replace('</row>','<c r="Z13" t="b"><v>1</v></c></row>')+incomplete),mapping);
 expect(result.rows).toHaveLength(1);
 expect(result.skipped).toEqual([{row:14,reason:'incomplete or unsupported mapped cell',article:'X'}]);
});
it('reads an explicitly configured valid-from cell, including Schwan labels', () => {
 for (const label of ['gültig ab', 'gilt ab']) {
  const date=`<row r="3">${cell('H3',`${label} 03.11.2026`)}</row>`;
  expect(parseSupplierTable(sheet(date+header+row),{...mapping,validFrom:{row:3,column:'H',format:'schwan'}}).validFrom).toBe('2026-11-03');
 }
 const other=`<row r="2">${cell('B2','2026-12-01')}</row>`;
 expect(parseSupplierTable(sheet(other+header+row),{...mapping,validFrom:{row:2,column:'B',format:'iso'}}).validFrom).toBe('2026-12-01');
 const bad=`<row r="3">${cell('H3','gültig ab 30.02.2026')}</row>`;
 expect(() => parseSupplierTable(sheet(bad+header+row),{...mapping,validFrom:{row:3,column:'H',format:'schwan'}})).toThrow();
});
it('rejects nested or duplicate value structures, but allows unrelated metadata namespaces', () => {
 expect(() => parseSupplierTable(sheet(header+row.replace('<v>12.5</v>','<is><v>12.5</v></is>')),mapping)).toThrow();
 expect(() => inspectSupplierTable(sheet(header+row).sheet ? {sheet:enc.encode('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/><sheetData/></worksheet>')} : sheet(''))).toThrow();
 const withMetadata=sheet(header+row);
 const input=new TextDecoder().decode(withMetadata.sheet).replace('<sheetData>', '<ext xmlns="urn:vendor"><field/></ext><sheetData>');
 expect(parseSupplierTable({sheet:enc.encode(input)},mapping).rows).toHaveLength(1);
});
it('reads rich shared strings without phonetic annotations', () => {
 const strings=enc.encode('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><r><t>Artikel-</t></r><r><t>Nr</t></r><rPh><t>not part</t></rPh></si></sst>');
 const h=header.replace(cell('A9','Artikel-Nr'),'<c r="A9" t="s"><v>0</v></c>');
 expect(parseSupplierTable({...sheet(h+row),sharedStrings:strings},mapping).rows).toHaveLength(1);
});
it('does not let foreign-namespace string items shift shared-string indices', () => {
 const strings=enc.encode('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Artikel-Nr</t></si><si xmlns="urn:foreign"><t>unexpected</t></si></sst>');
 const h=header.replace(cell('A9','Artikel-Nr'),'<c r="A9" t="s"><v>1</v></c>');
 expect(() => parseSupplierTable({...sheet(h+row),sharedStrings:strings},mapping)).toThrow();
});
it('reports an invalid price while preserving other usable rows', () => {
 const invalid=row.replaceAll('13','14').replace('12.5','0');
 const result=parseSupplierTable(sheet(header+row+invalid.replace('SYN-1','SYN-2')),mapping);
 expect(result.rows).toHaveLength(1);
 expect(result.skipped).toEqual([{row:14,reason:'invalid or ambiguous price',article:'SYN-2'}]);
});

it('distinguishes decorative headings from price-bearing rows of unknown identity', () => {
 const heading=`<row r="14">${cell('D14','Heading')}</row>`;
 const unknown=`<row r="15">${cell('D15','Unknown')}${cell('P15','5,00')}</row>`;
 const result=parseSupplierTable(sheet(header+row+heading+unknown),mapping);
 expect(result.ambiguous).toBe(true);
 expect(result.skipped).toEqual([{row:15,reason:'unidentified price-bearing row'}]);
});
it('rejects duplicate identifiers even when one row is incomplete', () => {
 const incomplete=`<row r="14">${cell('A14','SYN-1')}${cell('D14','Incomplete')}</row>`;
 expect(() => parseSupplierTable(sheet(header+row+incomplete),mapping)).toThrow();
});
