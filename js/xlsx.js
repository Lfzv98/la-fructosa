// Escritor de Excel (.xlsx) sin librerías: varias hojas, texto, números, fechas y estilos
// (colores, bordes, formatos, anchos, filtros, márgenes de impresión).
// Un .xlsx es un ZIP con archivos XML; aquí se arma en el navegador y funciona sin conexión.

const enc = new TextEncoder();

// --- ZIP sin compresión (método "store"): suficiente y compatible con Excel/Numbers/Sheets ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    const crc = crc32(bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true);      // sin compresión
    local.setUint32(14, crc, true);
    local.setUint32(18, bytes.length, true);
    local.setUint32(22, bytes.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, bytes);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, bytes.length, true);
    cd.setUint32(24, bytes.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + bytes.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// --- Hojas ---
const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  // Excel rechaza caracteres de control dentro del XML.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const colName = (i) => { let s = ''; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Días desde 1899-12-30 (fecha base de Excel).
const excelDate = (iso) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;

// --- Estilos ---
// Una celda puede ser un valor o { v, s }, donde s describe su estilo:
//   bold, italic, size, color ('RRGGBB'), fill ('RRGGBB'), border ('thin' | 'total' | 'none'),
//   fmt ('date' | 'money' | 'plus' | 'minus' | 'rate' | 'pct' | 'int' | 'text'), align ('left' | 'center' | 'right'),
//   indent (número), wrap (true).
// Una fila puede ser un arreglo o { cells, s, h }: s se aplica a todas sus celdas (incluidas las vacías) y h es el alto.
export const FMT = {
  date: 'dd/mm/yyyy',
  money: '#,##0.00',
  plus: '"+"#,##0.00',
  minus: '"-"#,##0.00',
  rate: '#,##0.00##',
  pct: '0.0%',
  int: '0',
};
const FONT = 'Calibri';
const INK = '1F2937';
const LINE = 'D5DAE1';

class Styles {
  constructor() {
    this.fonts = []; this.fills = []; this.borders = []; this.fmts = []; this.xfs = [];
    this.index = new Map();
    this.font({}); // 0
    this.fills.push('<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>');
    this.borders.push('<border><left/><right/><top/><bottom/><diagonal/></border>');
    this.xf({}); // 0 = normal
  }
  add(list, xml) { let i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; }
  font(s) {
    return this.add(this.fonts, `<font>${s.bold ? '<b/>' : ''}${s.italic ? '<i/>' : ''}<sz val="${s.size || 11}"/><color rgb="FF${s.color || INK}"/><name val="${FONT}"/></font>`);
  }
  fill(c) { return c ? this.add(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`) : 0; }
  border(b) {
    if (!b || b === 'none') return 0;
    const thin = `style="thin"><color rgb="FF${LINE}"/>`;
    const top = b === 'total' ? 'style="medium"><color rgb="FF1F2A44"/>' : thin;
    const bottom = b === 'header' ? 'style="medium"><color rgb="FF1F2A44"/>' : thin;
    return this.add(this.borders, `<border><left ${thin}</left><right ${thin}</right><top ${top}</top><bottom ${bottom}</bottom><diagonal/></border>`);
  }
  fmt(f) {
    if (!f || f === 'text') return f === 'text' ? 49 : 0;
    const code = FMT[f] || f;
    return 164 + this.add(this.fmts, code);
  }
  xf(s) {
    const key = JSON.stringify(s);
    if (this.index.has(key)) return this.index.get(key);
    const numFmtId = this.fmt(s.fmt);
    const fontId = this.font(s);
    const fillId = this.fill(s.fill);
    const borderId = this.border(s.border);
    const align = `<alignment vertical="center"${s.align ? ` horizontal="${s.align}"` : ''}${s.indent ? ` indent="${s.indent}"` : ''}${s.wrap ? ' wrapText="1"' : ''}/>`;
    this.xfs.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`);
    const i = this.xfs.length - 1;
    this.index.set(key, i);
    return i;
  }
  xml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${this.fmts.length ? `<numFmts count="${this.fmts.length}">${this.fmts.map((c, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xmlEsc(c)}"/>`).join('')}</numFmts>` : ''}<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts><fills count="${this.fills.length}">${this.fills.join('')}</fills><borders count="${this.borders.length}">${this.borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

// Encabezado de tabla: texto blanco en negrita sobre azul oscuro.
export const HEADER_STYLE = { bold: true, color: 'FFFFFF', fill: '1F2A44', border: 'thin', align: 'center', wrap: true };

function cellXml(raw, ref, rowStyle, st, header) {
  const isObj = raw && typeof raw === 'object' && !Array.isArray(raw);
  let v = isObj ? raw.v : raw;
  const own = isObj ? raw.s || {} : {};
  const base = header ? HEADER_STYLE : {};
  // Formato automático según el tipo de dato.
  const auto = {};
  if (typeof v === 'number' && Number.isFinite(v)) { auto.fmt = 'money'; auto.align = 'right'; }
  else if (typeof v === 'string' && DATE_RE.test(v) && !header) { auto.fmt = 'date'; auto.align = 'center'; }
  else if (typeof v === 'boolean') { v = v ? 'Sí' : 'No'; auto.align = 'center'; }
  const s = { ...auto, ...base, ...rowStyle, ...own };
  const empty = v == null || v === '';
  const hasStyle = Object.keys(s).length > 0;
  if (empty && !hasStyle) return '';
  const sid = hasStyle ? st.xf(s) : 0;
  const sAttr = sid ? ` s="${sid}"` : '';
  if (empty) return `<c r="${ref}"${sAttr}/>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${sAttr}><v>${v}</v></c>`;
  if (typeof v === 'string' && DATE_RE.test(v) && s.fmt === 'date') return `<c r="${ref}"${sAttr}><v>${excelDate(v)}</v></c>`;
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
}

// sheet: { name, rows, widths?, header? (fila del encabezado, por defecto 0; null = ninguna), freeze? (fila),
//          filter? (true: filtro en el encabezado), tab? (color de la pestaña), grid? (false oculta la cuadrícula),
//          landscape?, merges? (['A1:F1']), title? (texto del encabezado al imprimir), hidden? (columnas ocultas) }
function sheetXml(sheet, st) {
  const rows = sheet.rows.map((r) => (Array.isArray(r) ? { cells: r } : r));
  const headerRow = sheet.header === undefined ? 0 : sheet.header;
  const nCols = rows.reduce((m, r) => Math.max(m, r.cells.length), 0);
  const widths = sheet.widths?.slice() || [];
  if (!sheet.widths) {
    rows.forEach((r) => r.cells.forEach((c, i) => {
      const v = c && typeof c === 'object' && !Array.isArray(c) ? c.v : c;
      const len = typeof v === 'number' ? Math.abs(v).toFixed(2).length + 4 : String(v ?? '').length;
      widths[i] = Math.min(48, Math.max(widths[i] || 10, len + 3));
    }));
  }
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w || 10}" customWidth="1"${sheet.hidden?.includes(i) ? ' hidden="1"' : ''}/>`).join('')}</cols>` : '';
  const body = rows.map((r, ri) => {
    const isHeader = ri === headerRow;
    const h = r.h || (isHeader ? 24 : 18);
    const cells = [];
    const n = r.s || isHeader ? Math.max(r.cells.length, r.s?.full === false ? 0 : nCols) : r.cells.length;
    const { full, ...rowStyle } = r.s || {};
    for (let ci = 0; ci < n; ci++) cells.push(cellXml(r.cells[ci], colName(ci) + (ri + 1), rowStyle, st, isHeader));
    return `<row r="${ri + 1}" ht="${h}" customHeight="1">${cells.join('')}</row>`;
  }).join('');
  const freezeAt = sheet.freeze ?? (headerRow != null && rows.length > headerRow + 1 ? headerRow + 1 : null);
  const pane = freezeAt ? `<pane ySplit="${freezeAt}" topLeftCell="A${freezeAt + 1}" activePane="bottomLeft" state="frozen"/>` : '';
  const view = `<sheetViews><sheetView workbookViewId="0"${sheet.grid === false ? ' showGridLines="0"' : ''}>${pane}</sheetView></sheetViews>`;
  const pr = `<sheetPr>${sheet.tab ? `<tabColor rgb="FF${sheet.tab}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr>`;
  const filter = sheet.filter && headerRow != null && rows.length > headerRow + 1 && nCols
    ? `<autoFilter ref="A${headerRow + 1}:${colName(nCols - 1)}${rows.length}"/>` : '';
  const merges = sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  const margins = '<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>';
  const setup = `<pageSetup paperSize="9" orientation="${sheet.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>`;
  const hf = `<headerFooter><oddHeader>&amp;L${xmlEsc(sheet.title || 'La Fructosa')}&amp;R&amp;D</oddHeader><oddFooter>&amp;CPágina &amp;P de &amp;N</oddFooter></headerFooter>`;
  const printTitles = headerRow != null ? headerRow : null;
  return { printTitles, xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pr}${view}<sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${body}</sheetData>${filter}${merges}${margins}${setup}${hf}</worksheet>` };
}

// sheets: [{ name, rows: [[encabezados...], [valores...], ...], ...opciones de sheetXml }]
export function buildXlsx(sheets) {
  const safe = sheets.map((s, i) => ({ ...s, name: String(s.name).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || `Hoja ${i + 1}` }));
  const st = new Styles();
  const built = safe.map((s) => sheetXml(s, st));
  // Al imprimir, el encabezado de cada tabla se repite en todas las páginas.
  const names = built.map((b, i) => (b.printTitles != null && safe[i].filter
    ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${safe[i].name.replace(/'/g, "''")}'!$${b.printTitles + 1}:$${b.printTitles + 1}</definedName>` : '')).join('');
  const filters = built.map((b, i) => {
    const s = safe[i];
    if (!s.filter || b.printTitles == null || s.rows.length <= b.printTitles + 1) return '';
    const n = s.rows.reduce((m, r) => Math.max(m, (Array.isArray(r) ? r : r.cells).length), 0);
    return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${s.name.replace(/'/g, "''")}'!$A$${b.printTitles + 1}:$${colName(n - 1)}$${s.rows.length}</definedName>`;
  }).join('');
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${safe.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safe.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${names || filters ? `<definedNames>${filters}${names}</definedNames>` : ''}</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safe.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${safe.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    ...built.map((b, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: b.xml })),
  ];
  // Los estilos se generan al final: ya se conocen todos los que usan las hojas.
  files.splice(4, 0, { name: 'xl/styles.xml', data: st.xml() });
  return zip(files);
}
