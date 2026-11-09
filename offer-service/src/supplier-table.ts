import { SaxesParser } from 'saxes';

/** Only parts obtained from a validated, bounded workbook may be passed here.
 * This type is not evidence that a malware scan or source authorization occurred. */
export type SupplierTableParts = { sheet: Uint8Array; sharedStrings?: Uint8Array };
type Field = 'article' | 'description' | 'quantity' | 'unit' | 'price';
export type SupplierTableMapping = { headerRow: number; columns: Record<Field, string>; headers: Record<Field, string>; validFrom?: {row:number; column:string; format:'schwan'|'german'|'iso'} };
export type SupplierTableRow = Record<Field, string> & { row: number };
type Cell = { value: string; type: string; formula: boolean };
type Row = { row: number; hidden: boolean; cells: Map<string, Cell> };
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const fail = (): never => { throw new Error('Invalid or unsupported supplier worksheet'); };
const decode = (bytes: Uint8Array) => {
  if (!(bytes instanceof Uint8Array) || bytes.length > 2_097_152) return fail();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return fail(); }
};
function xml(bytes: Uint8Array, root: string, onOpen: (name: string, attrs: Record<string,string>, path: string[]) => void, onText: (value: string, path: string[]) => void, onClose: (name: string, path: string[]) => void) {
  const source = decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) return fail();
  const parser = new SaxesParser({ xmlns: true });
  const path: string[] = [];
  let nodes = 0;
  parser.on('opentag', tag => {
    if (++nodes > 300_000 || path.length > 32) return fail();
    path.push(tag.uri === ns ? tag.local : `{${tag.uri}}${tag.local}`);
    if (path.length === 1 && path[0] !== root) return fail();
    const attrs: Record<string,string> = {};
    for (const [key, attr] of Object.entries(tag.attributes)) if (!key.includes(':')) attrs[key] = attr.value;
    onOpen(tag.local, attrs, path);
  });
  parser.on('text', value => onText(value,path));
  parser.on('cdata', value => onText(value,path));
  parser.on('closetag', tag => { onClose(tag.local,path); path.pop(); });
  try { parser.write(source).close(); } catch { return fail(); }
}
function read(parts: SupplierTableParts): Row[] {
  if (!parts || parts.sheet.length + (parts.sharedStrings?.length ?? 0) > 4_194_304) return fail();
  const shared: string[] = [];
  let current = '';
  if (parts.sharedStrings) xml(parts.sharedStrings, 'sst', (name, _attrs, path) => {
    if (name === 'si' && path.join('/') === 'sst/si') current = '';
    if (path.includes('si') && ['v','is','si'].includes(name) && path.join('/') !== 'sst/si') return fail();
  }, (value,path) => {
    if (['sst/si/t', 'sst/si/r/t'].includes(path.join('/'))) { current += value; if (current.length > 4096) fail(); }
  }, (name,path) => { if (name === 'si' && path.join('/') === 'sst/si') { shared.push(current); if (shared.length > 100_000) fail(); } });
  const rows: Row[] = [];
  let row: Row | undefined, col = '', type = '', value = '', formula = false, valueNodes = 0;
  const rowIds = new Set<number>();
  let sheetDataCount = 0, inlineNodes = 0;
  xml(parts.sheet, 'worksheet', (name, attrs, path) => {
    if (path.join('/') === 'worksheet/sheetData' && ++sheetDataCount !== 1) return fail();
    if (path.includes('sheetData') && ['row','c','v','f','is'].includes(name) && !['worksheet/sheetData/row','worksheet/sheetData/row/c','worksheet/sheetData/row/c/v','worksheet/sheetData/row/c/f','worksheet/sheetData/row/c/is'].includes(path.join('/'))) return fail();
    if (name === 'row' && path.join('/') === 'worksheet/sheetData/row') {
      if (!/^[1-9]\d{0,6}$/.test(attrs.r ?? '')) return fail();
      const n = Number(attrs.r); if (rowIds.has(n) || n > 1_048_576) return fail(); rowIds.add(n);
      row = { row:n, hidden: attrs.hidden === '1' || attrs.hidden === 'true', cells:new Map() };
    }
    if (name === 'c' && path.join('/') === 'worksheet/sheetData/row/c') {
      const m = /^([A-Z]{1,3})([1-9]\d*)$/.exec(attrs.r ?? '');
      if (!row || !m || Number(m[2]) !== row.row || row.cells.has(m[1])) return fail();
      col=m[1]; type=attrs.t ?? 'n'; value=''; formula=false; valueNodes=0; inlineNodes=0;
    }
    if (name === 'f' && col) formula=true;
    if (name === 'v' && col && ++valueNodes > 1) return fail();
    if (name === 'is' && col && ++inlineNodes > 1) return fail();
    if (col && name === 't' && !['worksheet/sheetData/row/c/is/t','worksheet/sheetData/row/c/is/r/t'].includes(path.join('/'))) return fail();
  }, (text,path) => {
    if (col && ['worksheet/sheetData/row/c/v','worksheet/sheetData/row/c/is/t','worksheet/sheetData/row/c/is/r/t'].includes(path.join('/'))) { value += text; if (value.length > 4096) fail(); }
  }, (name,path) => {
    if (name === 'c' && path.join('/') === 'worksheet/sheetData/row/c') {
      if (!row || !col || (type === 'inlineStr' ? inlineNodes !== 1 || valueNodes !== 0 : inlineNodes !== 0 || valueNodes > 1)) return fail();
      if (type === 's') { if (!/^\d+$/.test(value) || Number(value) >= shared.length) return fail(); value=shared[Number(value)]; }
      row.cells.set(col,{value:value.trim(), type, formula}); col='';
    }
    if (name === 'row' && path.join('/') === 'worksheet/sheetData/row') { if (!row) return fail(); rows.push(row); row=undefined; if (rows.length > 10_100) fail(); }
  });
  if (sheetDataCount !== 1) return fail();
  return rows;
}
export function inspectSupplierTable(parts: SupplierTableParts): { rows: {row:number; cells: Record<string,string>}[] } {
  return {rows:read(parts).filter(r => !r.hidden).slice(0, 100).map(r => ({row:r.row,cells:Object.fromEntries([...r.cells].filter(([,c]) => !c.formula).map(([k,c]) => [k,c.value]))}))};
}
export function parseSupplierTable(parts: SupplierTableParts, mapping: SupplierTableMapping): {rows: SupplierTableRow[]; skipped: {row:number; reason:string; article?:string}[]; ambiguous:boolean; validFrom?: string} {
  const fields: Field[] = ['article','description','quantity','unit','price'];
  if (!mapping || typeof mapping !== 'object' || !mapping.columns || typeof mapping.columns !== 'object' || !mapping.headers || typeof mapping.headers !== 'object' || !Number.isSafeInteger(mapping.headerRow) || new Set(fields.map(f => mapping.columns[f])).size !== fields.length || fields.some(f => !/^[A-Z]{1,3}$/.test(mapping.columns[f]) || typeof mapping.headers[f] !== 'string' || !mapping.headers[f].trim())) return fail();
  if (mapping.validFrom && (!Number.isSafeInteger(mapping.validFrom.row) || mapping.validFrom.row < 1 || !/^[A-Z]{1,3}$/.test(mapping.validFrom.column) || !['schwan','german','iso'].includes(mapping.validFrom.format))) return fail();
  const rows = read(parts), header = rows.find(r => r.row === mapping.headerRow && !r.hidden);
  if (!header || fields.some(f => { const c=header.cells.get(mapping.columns[f]); return !c || c.formula || c.value !== mapping.headers[f]; })) return fail();
  const result: SupplierTableRow[] = [], skipped: {row:number; reason:string; article?:string}[] = [], articles = new Set<string>();
  let ambiguous = false;
  const skippedArticles = new Set<string>();
  for (const row of rows) {
    if (row.hidden || row.row <= mapping.headerRow) continue;
    const cells = fields.map(f => row.cells.get(mapping.columns[f]));
    if (cells.every(c => !c?.value && !c?.formula)) continue;
    const identity = cells[0];
    if (!identity?.value || identity.formula || !['n','s','inlineStr','str'].includes(identity.type)) {
      if (cells.slice(2).every(c => !c?.value && !c?.formula) && !identity?.formula) continue;
      ambiguous = true; skipped.push({row:row.row,reason:'unidentified price-bearing row'}); continue;
    }
    if (articles.has(identity.value)) return fail();
    if (cells.some(c => !c?.value || c.formula || !['n','s','inlineStr','str'].includes(c.type))) { skippedArticles.add(identity.value); skipped.push({row:row.row,reason:'incomplete or unsupported mapped cell',article:identity.value}); continue; }
    const [article,description,quantity,unit,priceCell] = cells as [Cell,Cell,Cell,Cell,Cell];
    const price = priceCell.type === 'n' ? priceCell.value : priceCell.value.replace(',', '.');
    if (!(priceCell.type === 'n' ? /^\d{1,6}(?:\.\d{1,4})?$/ : /^\d{1,6}(?:,\d{1,4})?$/).test(priceCell.value) || Number(price) <= 0) { skippedArticles.add(article.value); skipped.push({row:row.row,reason:'invalid or ambiguous price',article:article.value}); continue; }
    if (skippedArticles.has(article.value)) return fail();
    articles.add(article.value);
    result.push({row:row.row,article:article.value,description:description.value,quantity:quantity.value,unit:unit.value,price});
  }
  if (!result.length) return fail();
  let validFrom: string | undefined;
  if (mapping.validFrom) {
    const spec = mapping.validFrom, dateRow = rows.find(r => r.row === spec.row && !r.hidden), cell = dateRow?.cells.get(spec.column);
    if (!cell || cell.formula || !['s','inlineStr','str'].includes(cell.type)) return fail();
    const text = spec.format === 'schwan' ? cell.value.replace(/^(?:gilt|gültig) ab\s+/iu, '') : cell.value;
    if (spec.format === 'schwan' && text === cell.value) return fail();
    const match = spec.format === 'iso' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
    if (!match) return fail();
    const date = spec.format === 'iso' ? `${match[1]}-${match[2]}-${match[3]}` : `${match[3]}-${match[2]}-${match[1]}`;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) return fail();
    validFrom = date;
  }
  return {rows:result, skipped, ambiguous, ...(validFrom ? {validFrom} : {})};
}
