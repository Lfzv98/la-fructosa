// Registro financiero en PDF: resumen, cuentas, inversiones y todos los movimientos.
// Se arma en el teléfono, sin librerías ni internet (PDF básico con Helvetica).
import { todayISO, monthKey, monthLabel, convert, fmt, REGIONS, ADJUST_CATEGORY, INVESTMENT_KINDS, investmentGain } from './money.js';

// --- Escritor de PDF mínimo ---
const W = 595.28, H = 841.89, M = 40; // A4 en puntos y margen
// Anchos de Helvetica (1/1000 em) para ASCII 32–126; el resto usa 556.
const AFM = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556,
  333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const WIN = { '€': 0x80, '‚': 0x82, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '−': 0x2d, '→': 0x3e, '₮': -1 };
// Texto → caracteres de WinAnsi (los acentos y la ñ se conservan; emojis y símbolos raros se quitan).
function clean(s) {
  let out = '';
  for (const ch of String(s ?? '').replace(/₮/g, 'USDT').replace(/‍|️/g, '')) {
    const c = ch.codePointAt(0);
    if (WIN[ch] > 0) out += String.fromCharCode(WIN[ch]);
    else if (c >= 32 && c < 127) out += ch;
    else if (c >= 160 && c <= 255) out += ch;
  }
  return out.trim();
}
const charW = (ch, bold) => { const c = ch.charCodeAt(0); const w = c >= 32 && c <= 126 ? AFM[c - 32] : 556; return bold ? w * 1.06 : w; };
const textW = (s, size, bold) => [...s].reduce((t, ch) => t + charW(ch, bold), 0) * size / 1000;
function fit(s, width, size, bold) {
  if (textW(s, size, bold) <= width) return s;
  while (s.length > 1 && textW(s + '...', size, bold) > width) s = s.slice(0, -1);
  return s.trimEnd() + '...';
}
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const rgb = (hex) => { const n = parseInt(hex, 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(3)).join(' '); };

class Doc {
  constructor() { this.pages = []; this.newPage(); }
  newPage() { this.ops = []; this.pages.push(this.ops); this.y = H - M; }
  ensure(h) { if (this.y - h < M + 24) this.newPage(); }
  rect(x, y, w, h, fill) { this.ops.push(`${rgb(fill)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
  text(s, x, y, { size = 10, bold = false, color = '1F2937', align = 'left', width } = {}) {
    let t = clean(s);
    if (width) t = fit(t, width, size, bold);
    if (!t) return;
    const tw = textW(t, size, bold);
    const tx = align === 'right' ? x + (width ?? 0) - tw : align === 'center' ? x + ((width ?? 0) - tw) / 2 : x;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${tx.toFixed(2)} ${y.toFixed(2)} Td (${esc(t)}) Tj ET`);
  }
  // Tabla con encabezado azul, filas alternas y saltos de página (repite el encabezado).
  table(cols, rows) {
    const total = W - 2 * M;
    const sum = cols.reduce((s, c) => s + c.w, 0);
    const ws = cols.map((c) => (c.w / sum) * total);
    const head = () => {
      this.ensure(36);
      this.rect(M, this.y - 18, total, 18, '1E3A5F');
      let x = M;
      cols.forEach((c, i) => { this.text(c.label, x + 4, this.y - 12.5, { size: 8.5, bold: true, color: 'FFFFFF', align: c.align, width: ws[i] - 8 }); x += ws[i]; });
      this.y -= 18;
    };
    head();
    rows.forEach((r, k) => {
      if (this.y - 16 < M + 24) { this.newPage(); head(); }
      if (r.fill || k % 2) this.rect(M, this.y - 16, total, 16, r.fill || 'F5F7FA');
      let x = M;
      r.cells.forEach((v, i) => {
        const cell = typeof v === 'object' && v ? v : { v };
        this.text(cell.v ?? '', x + 4, this.y - 11.3, { size: 8.5, bold: cell.bold || r.bold, color: cell.color || r.color, align: cols[i].align, width: ws[i] - 8 });
        x += ws[i];
      });
      this.y -= 16;
    });
    this.y -= 14;
  }
  h1(s) { this.ensure(30); this.text(s, M, this.y - 20, { size: 20, bold: true, color: '1E3A5F' }); this.y -= 30; }
  h2(s) { this.ensure(48); this.y -= 6; this.text(s, M, this.y - 13, { size: 13, bold: true, color: '1E3A5F' }); this.y -= 22; }
  p(s, opts = {}) { this.ensure(16); this.text(s, M, this.y - 10, { size: 9.5, color: '6B7280', ...opts }); this.y -= 15; }

  bytes(footer) {
    const n = this.pages.length;
    this.pages.forEach((ops, i) => ops.push(`BT /F1 8 Tf ${rgb('9CA3AF')} rg ${M} 22 Td (${esc(clean(footer))}) Tj ET`,
      `BT /F1 8 Tf ${rgb('9CA3AF')} rg ${(W - M - 60).toFixed(2)} 22 Td (${esc(clean(`Página ${i + 1} de ${n}`))}) Tj ET`));
    const objs = [];
    const add = (s) => { objs.push(s); return objs.length; };
    const font = (name) => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
    const f1 = font('Helvetica'), f2 = font('Helvetica-Bold');
    const pagesId = objs.length + 1 + n * 2 + 1; // se reserva al final
    const kids = [];
    for (const ops of this.pages) {
      const body = ops.join('\n');
      const c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${c} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> >>`));
    }
    const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    add(`<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${n} >>`);
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const b = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255;
    return b;
  }
}

// --- Contenido ---
const TYPE = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };
const KIND = { cash: 'Efectivo', bank: 'Banco', digital: 'Digital', crypto: 'Cripto' };
const GREEN = '1E7B34', RED = 'B42318', GRAY = '6B7280';
const dmy = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const money = (v, c) => (v == null || !isFinite(v) ? '—' : fmt(v, c));

export function buildPdfReport(d) {
  const T = d.target;
  const today = todayISO();
  const ym = monthKey(today);
  const reg = REGIONS[d.profile.region] || REGIONS.VE;
  const real = d.txs.filter((t) => t.type !== 'transfer' && t.category !== ADJUST_CATEGORY);
  const sum = (list, type) => list.filter((t) => t.type === type).reduce((s, t) => s + (Number(t.value) || 0), 0);
  const month = real.filter((t) => monthKey(t.date) === ym);
  const active = d.accounts.filter((a) => !a.archived);
  const acc = (id) => d.accById[id]?.name ?? '';

  const doc = new Doc();
  doc.h1('La Fructosa · Registro financiero');
  const who = d.profile.username ? '@' + d.profile.username : d.profile.display_name || '';
  doc.p(`Generado el ${dmy(today)} · ${who} · ${reg.label} · Totales en ${T}`);

  doc.h2('Resumen');
  const inc = [sum(month, 'income'), sum(real, 'income')], exp = [sum(month, 'expense'), sum(real, 'expense')];
  doc.table([{ label: 'Concepto', w: 3 }, { label: monthLabel(ym), w: 2, align: 'right' }, { label: 'Todo el historial', w: 2, align: 'right' }], [
    { cells: ['Ingresos', { v: money(inc[0], T), color: GREEN }, { v: money(inc[1], T), color: GREEN }] },
    { cells: ['Gastos', { v: money(exp[0], T), color: RED }, { v: money(exp[1], T), color: RED }] },
    { cells: ['Neto (ingresos - gastos)', money(inc[0] - exp[0], T), money(inc[1] - exp[1], T)], bold: true, fill: 'FFF4CC' },
    { cells: ['Patrimonio total hoy', '', money(d.total?.total, T)], bold: true, fill: 'E8EEF7' },
  ]);
  doc.p('El resumen no incluye transferencias entre tus cuentas ni ajustes de saldo.', { size: 8.5 });

  doc.h2(`Cuentas (${active.length})`);
  doc.table([{ label: 'Cuenta', w: 4 }, { label: 'Tipo', w: 1.6 }, { label: 'Moneda', w: 1.3 }, { label: 'Saldo', w: 2.4, align: 'right' }, { label: `Valor en ${T}`, w: 2.4, align: 'right' }],
    active.map((a) => ({ cells: [a.name, KIND[a.kind] || a.kind, a.currency, { v: money(a.balance, a.currency), color: a.balance < 0 ? RED : undefined },
      money(convert(a.balance, a.currency, T, d.rates || {}, d.val), T)] })));

  if (d.investmentsOn && d.investments?.length) {
    doc.h2(`Inversiones (${d.investments.length})`);
    doc.table([{ label: 'Inversión', w: 4 }, { label: 'Tipo', w: 1.6 }, { label: 'Invertido', w: 2.2, align: 'right' }, { label: 'Valor actual', w: 2.2, align: 'right' }, { label: 'Ganancia', w: 2.2, align: 'right' }],
      d.investments.map((inv) => { const g = investmentGain(inv); return { cells: [inv.name, INVESTMENT_KINDS[inv.kind]?.label || '', money(g.invested, inv.currency), money(g.value, inv.currency),
        { v: (g.gain > 0 ? '+' : '') + money(g.gain, inv.currency), color: g.gain < 0 ? RED : GREEN }] }; }));
  }

  doc.h2(`Movimientos (${d.txs.length})`);
  const txs = [...d.txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  doc.table([{ label: 'Fecha', w: 1.5 }, { label: 'Tipo', w: 1.6 }, { label: 'Categoría', w: 2 }, { label: 'Descripción', w: 3.2 }, { label: 'Cuenta', w: 2.6 }, { label: 'Monto', w: 2.2, align: 'right' }],
    txs.map((t) => {
      const c = d.accById[t.account_id]?.currency || 'USD';
      const sign = t.type === 'income' ? 1 : t.type === 'expense' ? -1 : 0;
      const color = t.category === ADJUST_CATEGORY ? GRAY : t.type === 'income' ? GREEN : t.type === 'expense' ? RED : '1D4ED8';
      return { cells: [dmy(t.date), { v: TYPE[t.type] || t.type, color }, t.category || '', t.description || '',
        t.type === 'transfer' ? `${acc(t.account_id)} > ${acc(t.to_account_id)}` : acc(t.account_id),
        { v: (sign > 0 ? '+' : '') + fmt(sign ? sign * t.amount : t.amount, c), color }] };
    }));

  return doc.bytes(`La Fructosa · Registro financiero de ${who} · ${dmy(today)} · Documento privado`);
}
