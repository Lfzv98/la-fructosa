// Respaldo completo en Excel: todas tus cuentas, movimientos, presupuestos, pagos fijos y tasas.
// Se genera en el teléfono con los datos ya cargados; no pasa por ningún servidor adicional.
import { useEffect, useState } from 'react';
import { html, Icon, toast } from './ui.js';
import { buildXlsx, HEADER_STYLE } from './xlsx.js';
import { saveFile } from './export.js';
import { todayISO, monthKey, monthLabel, convert, REGIONS, RATE_LABELS, ADJUST_CATEGORY, INVESTMENT_KINDS, investmentGain } from './money.js';
import { api } from './api.js';

const TYPE = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };
const KIND = { cash: 'Efectivo', bank: 'Banco', digital: 'Digital', crypto: 'Cripto' };
const n = (v) => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));
const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
const day = (v) => (v ? String(v).slice(0, 10) : null);

export const BACKUP_EVERY_DAYS = 7;
const lastKey = (uid) => 'fructosa-last-backup-' + (uid || 'demo');
export function lastBackup(uid) { try { return localStorage.getItem(lastKey(uid)); } catch { return null; } }
function markBackup(uid) {
  try { localStorage.setItem(lastKey(uid), todayISO()); } catch { /* nada */ }
  api.push?.markBackup(todayISO()); // para que el aviso semanal al teléfono sepa que ya lo hiciste
  window.dispatchEvent(new Event('fructosa-backup'));
}
export function daysSince(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.parse(todayISO() + 'T12:00:00Z') - Date.parse(iso + 'T12:00:00Z')) / 86400000);
}

// Colores del Excel (también se explican en la hoja Resumen, sección "Guía de colores").
export const XL = {
  income:   { fill: 'E7F6EC', ink: '1E7B34' }, // verde: ingresos
  expense:  { fill: 'FDECEC', ink: 'B42318' }, // rojo: gastos
  transfer: { fill: 'E8F0FE', ink: '1A5FB4' }, // azul: transferencias entre tus cuentas
  adjust:   { fill: 'F2F4F7', ink: '6B7280' }, // gris: ajustes de saldo, archivadas, pausadas o saldadas
  total:    { fill: 'FFF4CC', ink: '1F2937' }, // amarillo: totales
  zebra:    'F7F8FA',
  navy:     '1F2A44',
};
const TONE_LABEL = {
  income: ['Ingreso', 'Dinero que entró. Monto en verde con signo +.'],
  expense: ['Gasto', 'Dinero que salió. Monto en rojo con signo −.'],
  transfer: ['Transferencia', 'Movimiento entre tus propias cuentas o cambio de divisa. No es gasto ni ingreso. Monto en azul.'],
  adjust: ['Ajuste / inactivo', 'Ajustes de saldo, cuentas archivadas, pagos fijos pausados y préstamos saldados.'],
  total: ['Total', 'Sumas y totales, en negrita con línea superior.'],
};
const SECTION = { bold: true, size: 12, color: XL.navy, border: 'none' };
const LABEL = { bold: true, color: '374151', fill: 'EEF2F7', border: 'thin', indent: 1 };
const VALUE = { border: 'thin', indent: 1 };
const GRAY = { italic: true, color: XL.adjust.ink };
const toneOf = (t) => (t.category === ADJUST_CATEGORY ? 'adjust' : t.type);
// Monto con color y signo según el tipo (el número guardado no cambia: el signo es solo visual).
const amountCell = (v, tone, fmt) => ({ v, s: { bold: tone !== 'adjust', color: XL[tone]?.ink, fmt: fmt || (tone === 'income' ? 'plus' : tone === 'expense' ? 'minus' : 'money'), align: 'right' } });
// Positivo en verde y negativo en rojo (netos, brecha). Con plain, el positivo va en el color normal (saldos).
const signed = (v, plain) => ({ v, s: { bold: true, fmt: 'money', align: 'right', color: v < 0 ? XL.expense.ink : v > 0 && !plain ? XL.income.ink : undefined } });
const zebra = (rows) => rows.map((cells, i) => ({ cells, s: { border: 'thin', ...(i % 2 ? { fill: XL.zebra } : {}) } }));
// Brecha en USD de un gasto pagado en bolívares: positivo = te ahorró, negativo = te costó.
const spreadOf = (t) => (t.original_currency === 'VES' && t.rate_bcv && t.rate_applied
  ? Number(t.original_amount) / Number(t.rate_bcv) - Number(t.original_amount) / Number(t.rate_applied) : null);

// Guía de colores (filas listas para una tabla de 2 columnas).
export function legendRows(region) {
  return Object.entries(TONE_LABEL).map(([k, [name, text]]) => [
    { v: name, s: { bold: true, fill: XL[k].fill, color: XL[k].ink, border: k === 'total' ? 'total' : 'thin', indent: 1 } },
    { v: text, s: { border: 'thin', wrap: true, indent: 1 } },
  ]).concat([
    ...(region?.rates ? [[{ v: 'Brecha', s: { bold: true, border: 'thin', indent: 1 } }, { v: 'En la columna Brecha USD: verde = pagar en bolívares te ahorró; rojo = te costó.', s: { border: 'thin', wrap: true, indent: 1 } }]] : []),
    [{ v: 'Saldo negativo', s: { bold: true, color: XL.expense.ink, border: 'thin', indent: 1 } }, { v: 'Cuentas o netos por debajo de cero se muestran en rojo.', s: { border: 'thin', wrap: true, indent: 1 } }],
    [{ v: 'Encabezado', s: { bold: true, color: 'FFFFFF', fill: XL.navy, border: 'thin', indent: 1 } }, { v: 'Títulos de cada columna. Tienen filtros: toca la flecha para ordenar o filtrar.', s: { border: 'thin', wrap: true, indent: 1 } }],
  ]);
}

// Hoja de movimientos con colores por tipo. Se usa en el respaldo y al exportar movimientos.
export function movementsSheet(txs, d, name = 'Movimientos') {
  const acc = (id) => d.accById[id]?.name ?? '';
  const withVes = txs.some((t) => t.original_currency === 'VES' || t.rate_bcv);
  const head = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Cuenta', 'Moneda', 'Monto', 'Cuenta destino', 'Monto destino', `Valor en ${d.target}`];
  const widths = [12, 14, 20, 34, 22, 9, 15, 22, 15, 16];
  if (withVes) { head.push('Pagado en', 'Monto pagado', 'Tasa usada', 'Tasa BCV', 'Tasa paralelo', 'Brecha USD'); widths.push(11, 15, 12, 12, 13, 13); }
  head.push('ID (técnico)', 'ID cuenta', 'ID cuenta destino'); widths.push(38, 38, 38);
  const rows = txs.map((t) => {
    const tone = toneOf(t);
    const cells = [t.date, { v: TYPE[t.type] || t.type, s: { bold: true, color: XL[tone]?.ink } }, t.category || '', t.description || '',
      acc(t.account_id), { v: t.currency, s: { align: 'center' } }, amountCell(n(t.amount), tone),
      t.to_account_id ? acc(t.to_account_id) : '', t.to_amount != null ? amountCell(n(t.to_amount), tone, 'money') : '',
      amountCell(r2(Number(t.value)), tone)];
    if (withVes) {
      const sp = spreadOf(t);
      cells.push({ v: t.original_currency || '', s: { align: 'center' } }, n(t.original_amount),
        { v: n(t.rate_applied), s: { fmt: 'rate' } }, { v: n(t.rate_bcv), s: { fmt: 'rate' } }, { v: n(t.rate_paralelo), s: { fmt: 'rate' } },
        sp == null ? '' : signed(r2(sp)));
    }
    cells.push(...[t.id, t.account_id, t.to_account_id || ''].map((v) => ({ v: v == null ? '' : String(v), s: { ...GRAY, size: 9 } })));
    return { cells, s: { fill: XL[tone]?.fill, border: 'thin', ...(tone === 'adjust' ? { italic: true } : {}) } };
  });
  const ids = [head.length - 3, head.length - 2, head.length - 1]; // columnas técnicas: ocultas (clic derecho › Mostrar)
  return { name, rows: [head, ...rows], widths, hidden: ids, filter: true, landscape: true, tab: XL.income.ink, title: 'La Fructosa · ' + name };
}

export function backupSheets(d) {
  const acc = (id) => d.accById[id]?.name ?? '';
  const T = d.target;
  const today = todayISO();
  const ym = monthKey(today);
  const reg = REGIONS[d.profile.region] || REGIONS.VE;
  const realTx = d.txs.filter((t) => t.type !== 'transfer' && t.category !== ADJUST_CATEGORY);
  const sum = (list, type) => r2(list.filter((t) => t.type === type).reduce((s, t) => s + (Number(t.value) || 0), 0));
  const month = realTx.filter((t) => monthKey(t.date) === ym);
  const inc = [sum(month, 'income'), sum(realTx, 'income')];
  const exp = [sum(month, 'expense'), sum(realTx, 'expense')];
  const active = d.accounts.filter((a) => !a.archived);
  const valueIn = (a) => r2(convert(a.balance, a.currency, T, d.rates || {}, d.val));

  const resumen = [
    { cells: [{ v: 'La Fructosa · Respaldo de tus finanzas', s: { bold: true, size: 18, color: XL.navy } }], h: 32 },
    { cells: [{ v: `Generado el ${today.split('-').reverse().join('/')} · ${reg.flag} ${reg.label} · Montos totales en ${T}`, s: { italic: true, color: '6B7280' } }] },
    [],
    { cells: [{ v: 'Datos generales', s: SECTION }], h: 22 },
    [{ v: 'Usuario', s: LABEL }, { v: d.profile.username ? '@' + d.profile.username : d.profile.display_name || '', s: VALUE }],
    [{ v: 'País', s: LABEL }, { v: `${reg.label} (${d.profile.region || 'VE'})`, s: VALUE }],
    [{ v: 'Moneda principal', s: LABEL }, { v: T, s: VALUE }],
    [{ v: 'Cuentas activas', s: LABEL }, { v: active.length, s: { ...VALUE, fmt: 'int', align: 'left' } }],
    [{ v: 'Movimientos registrados', s: LABEL }, { v: d.txs.length, s: { ...VALUE, fmt: 'int', align: 'left' } }],
    [],
    { cells: [{ v: `Ingresos y gastos (en ${T})`, s: SECTION }], h: 22 },
    [`Concepto`, `${monthLabel(ym)}`, 'Todo el historial'].map((v) => ({ v, s: HEADER_STYLE })),
    { cells: [{ v: 'Ingresos', s: { bold: true, indent: 1 } }, amountCell(inc[0], 'income'), amountCell(inc[1], 'income')], s: { fill: XL.income.fill, border: 'thin', full: false } },
    { cells: [{ v: 'Gastos', s: { bold: true, indent: 1 } }, amountCell(exp[0], 'expense'), amountCell(exp[1], 'expense')], s: { fill: XL.expense.fill, border: 'thin', full: false } },
    { cells: [{ v: 'Neto (ingresos − gastos)', s: { bold: true, indent: 1 } }, signed(r2(inc[0] - exp[0])), signed(r2(inc[1] - exp[1]))], s: { fill: XL.total.fill, border: 'total', full: false } },
    { cells: [{ v: 'No incluye transferencias entre tus cuentas ni ajustes de saldo.', s: { italic: true, color: '6B7280', size: 9 } }] },
    [],
    { cells: [{ v: 'Saldos por cuenta', s: SECTION }], h: 22 },
    ['Cuenta', 'Saldo', 'Moneda', `Valor en ${T}`].map((v) => ({ v, s: HEADER_STYLE })),
    ...active.map((a, i) => ({ cells: [{ v: a.name, s: { indent: 1 } }, signed(r2(n(a.balance)), true), { v: a.currency, s: { align: 'center' } }, signed(valueIn(a), true)],
      s: { border: 'thin', ...(i % 2 ? { fill: XL.zebra } : {}) } })),
    ...(d.investmentsOn ? [{ cells: [{ v: 'Inversiones (valor actual)', s: { indent: 1 } }, '', '', signed(r2(Number(d.total?.investments ?? 0)), true)], s: { border: 'thin' } }] : []),
    { cells: [{ v: 'Patrimonio total', s: { bold: true, indent: 1 } }, '', '', signed(r2(Number(d.total?.total ?? 0)), true)], s: { fill: XL.total.fill, border: 'total', bold: true } },
    [],
    { cells: [{ v: 'Guía de colores', s: SECTION }], h: 22 },
    { cells: ['Color', 'Qué significa', '', ''].map((v) => ({ v, s: HEADER_STYLE })) },
    // La explicación ocupa de la columna B a la D (celdas combinadas).
    ...legendRows(d.region).map(([color, text]) => ({ cells: [color, text, { v: '', s: text.s }, { v: '', s: text.s }], h: 32 })),
  ];
  const legendStart = resumen.length - legendRows(d.region).length - 1; // fila (0-based) del encabezado de la guía
  const merges = [];
  for (let r = legendStart; r < resumen.length; r++) merges.push(`B${r + 1}:D${r + 1}`);

  const sheets = [
    { name: 'Resumen', rows: resumen, merges, header: null, widths: [30, 22, 22, 22], grid: false, tab: XL.navy, title: 'La Fructosa · Resumen' },
    { name: 'Cuentas', widths: [28, 12, 9, 15, 15, 16, 12, 12, 38], hidden: [8], filter: true, tab: '1A5FB4', title: 'La Fructosa · Cuentas', rows: [
      ['Nombre', 'Tipo', 'Moneda', 'Saldo actual', 'Saldo inicial', `Valor en ${T}`, 'Estado', 'Creada', 'ID (técnico)'],
      ...d.accounts.map((a, i) => ({
        cells: [{ v: a.name, s: { bold: !a.archived, indent: 1 } }, KIND[a.kind] || a.kind, { v: a.currency, s: { align: 'center' } }, signed(r2(n(a.balance)), true), n(a.initial_balance),
          a.archived ? '' : signed(valueIn(a), true), { v: a.archived ? 'Archivada' : 'Activa', s: { align: 'center', color: a.archived ? XL.adjust.ink : XL.income.ink, bold: true } },
          day(a.created_at), { v: String(a.id ?? ''), s: { ...GRAY, size: 9 } }],
        s: a.archived ? { fill: XL.adjust.fill, border: 'thin', ...GRAY } : { border: 'thin', ...(i % 2 ? { fill: XL.zebra } : {}) },
      })),
    ] },
    movementsSheet(d.txs, d),
    { name: 'Presupuestos', widths: [24, 16, 10], filter: true, tab: 'B7791F', title: 'La Fructosa · Presupuestos', rows: [
      ['Categoría', 'Tope mensual', 'Moneda'],
      ...zebra((d.budgets || []).map((b) => [{ v: b.category, s: { indent: 1 } }, n(b.monthly_limit), { v: b.currency, s: { align: 'center' } }])),
    ] },
    { name: 'Pagos fijos', widths: [26, 18, 14, 9, 12, 22, 11], filter: true, tab: XL.expense.ink, title: 'La Fructosa · Pagos fijos', rows: [
      ['Nombre', 'Categoría', 'Monto', 'Moneda', 'Día de pago', 'Cuenta', 'Estado'],
      ...(d.recurring || []).map((r, i) => {
        const on = r.is_active !== false;
        return { cells: [{ v: r.name, s: { indent: 1, bold: on } }, r.category || '', amountCell(n(r.amount), on ? 'expense' : 'adjust'), { v: r.currency, s: { align: 'center' } },
          { v: n(r.due_day), s: { fmt: 'int', align: 'center' } }, acc(r.account_id), { v: on ? 'Activo' : 'Pausado', s: { align: 'center', bold: true, color: on ? XL.income.ink : XL.adjust.ink } }],
        s: on ? { border: 'thin', ...(i % 2 ? { fill: XL.zebra } : {}) } : { fill: XL.adjust.fill, border: 'thin', ...GRAY } };
      }),
    ] },
  ];
  if (d.goals?.length) sheets.push({ name: 'Metas', widths: [26, 14, 14, 14, 10, 9, 13, 12], filter: true, tab: '6D28D9', title: 'La Fructosa · Metas', rows: [
    ['Meta', 'Objetivo', 'Ahorrado', 'Falta', 'Avance', 'Moneda', 'Fecha límite', 'Estado'],
    ...d.goals.map((g, i) => {
      const goal = n(g.target_amount) || 0; const saved = n(g.saved_amount) || 0;
      return { cells: [{ v: g.name, s: { indent: 1, bold: true } }, goal, { v: saved, s: { color: XL.income.ink, bold: true } }, r2(Math.max(0, goal - saved)),
        { v: goal ? Math.min(1, saved / goal) : 0, s: { fmt: 'pct', align: 'center' } }, { v: g.currency, s: { align: 'center' } }, day(g.target_date),
        { v: g.done ? 'Cumplida' : 'En curso', s: { align: 'center', bold: true, color: g.done ? XL.income.ink : XL.transfer.ink } }],
      s: g.done ? { fill: XL.income.fill, border: 'thin' } : { border: 'thin', ...(i % 2 ? { fill: XL.zebra } : {}) } };
    }),
  ] });
  if (d.investmentsOn && d.investments?.length) sheets.push({ name: 'Inversiones', widths: [26, 13, 14, 14, 14, 10, 9, 12, 30], filter: true, tab: '1D4ED8', title: 'La Fructosa · Inversiones', rows: [
    ['Inversión', 'Tipo', 'Invertido', 'Valor actual', 'Ganancia', '%', 'Moneda', 'Fecha', 'Nota'],
    ...d.investments.map((inv, i) => {
      const g = investmentGain(inv);
      return { cells: [{ v: inv.name, s: { indent: 1, bold: true } }, INVESTMENT_KINDS[inv.kind]?.label || inv.kind, r2(g.invested), r2(g.value), signed(r2(g.gain)),
        { v: g.pct == null ? 0 : g.pct / 100, s: { fmt: 'pct', align: 'center', color: g.gain < 0 ? XL.expense.ink : XL.income.ink } }, { v: inv.currency, s: { align: 'center' } }, day(inv.invested_on), inv.note || ''],
      s: { border: 'thin', ...(i % 2 ? { fill: XL.zebra } : {}) } };
    }),
  ] });
  if (d.loans?.length) sheets.push({ name: 'Préstamos', widths: [22, 13, 13, 13, 13, 9, 12, 12, 11, 30], filter: true, tab: 'B7791F', title: 'La Fructosa · Préstamos', rows: [
    ['Persona', 'Tipo', 'Monto', 'Pagado', 'Pendiente', 'Moneda', 'Fecha', 'Vence', 'Estado', 'Nota'],
    ...d.loans.map((l) => {
      const tone = l.settled ? 'adjust' : l.direction === 'lent' ? 'income' : 'expense';
      const pend = r2(Math.max(0, (n(l.amount) || 0) - (n(l.paid_amount) || 0)));
      return { cells: [{ v: l.person, s: { indent: 1, bold: true } }, { v: l.direction === 'lent' ? 'Le presté' : 'Me prestó', s: { bold: true, color: XL[tone].ink } },
        n(l.amount), n(l.paid_amount), { v: pend, s: { bold: true, color: XL[tone].ink } }, { v: l.currency, s: { align: 'center' } },
        day(l.occurred_on), day(l.due_on), { v: l.settled ? 'Saldado' : 'Pendiente', s: { align: 'center', bold: true } }, { v: l.note || '', s: { wrap: true } }],
      s: { fill: XL[tone].fill, border: 'thin', ...(l.settled ? GRAY : {}) } };
    }),
  ] });
  if (d.region?.rates && d.rateHistory?.length) sheets.push({ name: 'Tasas', widths: [12, 18, 16, 30], filter: true, tab: '0F766E', title: 'La Fructosa · Tasas', rows: [
    ['Fecha', 'Tasa', 'Bs. por unidad', 'Fuente'],
    ...zebra(d.rateHistory.map((r) => [r.rate_date, RATE_LABELS[r.rate_type] || r.rate_type, { v: n(r.rate), s: { fmt: 'rate' } }, r.source || ''])),
  ] });
  return sheets;
}

// Exporta una lista de movimientos a Excel, con colores y la guía de colores.
export async function exportMovementsXlsx(txs, d, name = 'movimientos') {
  const sheets = [
    movementsSheet(txs, d),
    { name: 'Guía de colores', header: null, widths: [22, 70], grid: false, tab: XL.navy, rows: [
      { cells: [{ v: 'Guía de colores', s: { bold: true, size: 16, color: XL.navy } }], h: 28 },
      [],
      ['Color', 'Qué significa'].map((v) => ({ v, s: HEADER_STYLE })),
      ...legendRows(d.region).map((cells) => ({ cells, h: 30 })),
    ] },
  ];
  const file = new File([buildXlsx(sheets)], `la-fructosa-${name}-${todayISO()}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  if (!(await saveFile(file))) return;
  toast(txs.length === 1 ? 'Se exportó 1 movimiento' : `Se exportaron ${txs.length} movimientos`);
}

export async function downloadBackup(d) {
  const file = new File([buildXlsx(backupSheets(d))], `la-fructosa-respaldo-${todayISO()}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const ok = await saveFile(file);
  if (!ok) return false;
  markBackup(d.profile.id);
  toast('Respaldo listo. Guárdalo en una carpeta segura.');
  return true;
}

export function useLastBackup(uid) {
  const [v, setV] = useState(() => lastBackup(uid));
  useEffect(() => {
    const on = () => setV(lastBackup(uid));
    window.addEventListener('fructosa-backup', on);
    return () => window.removeEventListener('fructosa-backup', on);
  }, [uid]);
  return v;
}

// Botón para Ajustes.
export function BackupButton({ d }) {
  const last = useLastBackup(d.profile.id);
  const [busy, setBusy] = useState(false);
  const ago = daysSince(last);
  const sub = !last ? 'Nunca has descargado un respaldo' : ago === 0 ? 'Último respaldo: hoy' : ago === 1 ? 'Último respaldo: ayer' : `Último respaldo: hace ${ago} días`;
  return html`<button class="menu-row" disabled=${busy} onClick=${async () => {
    setBusy(true);
    try { await downloadBackup(d); } catch (e) { toast('No se pudo crear el respaldo: ' + (e?.message || e), { tone: 'bad' }); }
    setBusy(false);
  }}>
    <${Icon} name="download" /><span>Descargar todos mis datos (Excel)<small>${sub}</small></span><${Icon} name="right" class="muted" />
  </button>`;
}

// Recordatorio semanal en Inicio. "Luego" lo pospone un día en este dispositivo.
export function BackupReminder({ d }) {
  const last = useLastBackup(d.profile.id);
  const snoozeKey = 'fructosa-backup-snooze-' + d.profile.id;
  const [snoozed, setSnoozed] = useState(() => { try { return localStorage.getItem(snoozeKey) === todayISO(); } catch { return false; } });
  if (snoozed || !d.txs.length || daysSince(last) < BACKUP_EVERY_DAYS) return null;
  const later = () => { try { localStorage.setItem(snoozeKey, todayISO()); } catch { /* nada */ } setSnoozed(true); window.dispatchEvent(new Event('fructosa-backup')); };
  return html`<section class="card pad backup-nudge">
    <div class="backup-top"><span class="backup-ico"><${Icon} name="download" size=${20} /></span>
      <div class="grow"><b>${last ? 'Es hora de tu respaldo semanal' : 'Haz tu primer respaldo'}</b>
        <small class="muted">Descarga un Excel con todos tus datos y guárdalo en una carpeta segura.</small></div></div>
    <div class="row-btns backup-btns">
      <button class="btn ghost sm" onClick=${later}>Luego</button>
      <button class="btn primary sm" onClick=${() => downloadBackup(d).catch((e) => toast(String(e?.message || e), { tone: 'bad' }))}>Descargar</button>
    </div>
  </section>`;
}

// Banner delgado en la parte superior de las demás pantallas (en Inicio ya está la tarjeta grande). Comparte el "Luego".
export function BackupBanner({ d }) {
  const last = useLastBackup(d.profile.id);
  const snoozeKey = 'fructosa-backup-snooze-' + d.profile.id;
  const [snoozed, setSnoozed] = useState(() => { try { return localStorage.getItem(snoozeKey) === todayISO(); } catch { return false; } });
  useEffect(() => {
    const on = () => { try { setSnoozed(localStorage.getItem(snoozeKey) === todayISO()); } catch { /* nada */ } };
    window.addEventListener('fructosa-backup', on);
    return () => window.removeEventListener('fructosa-backup', on);
  }, [snoozeKey]);
  const ago = daysSince(last);
  if (snoozed || !d.txs.length || ago < BACKUP_EVERY_DAYS) return null;
  const later = () => { try { localStorage.setItem(snoozeKey, todayISO()); } catch { /* nada */ } setSnoozed(true); window.dispatchEvent(new Event('fructosa-backup')); };
  return html`<div class="backup-banner" role="status">
    <${Icon} name="download" size=${18} />
    <span class="grow">${last ? `${ago} días sin respaldo` : 'Aún no tienes respaldo'}</span>
    <button class="btn primary sm" onClick=${() => downloadBackup(d).catch((e) => toast(String(e?.message || e), { tone: 'bad' }))}>Descargar</button>
    <button class="icon-btn" aria-label="Recordar mañana" onClick=${later}><${Icon} name="x" size=${16} /></button>
  </div>`;
}
