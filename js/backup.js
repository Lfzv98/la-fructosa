// Respaldo completo en Excel: todas tus cuentas, movimientos, presupuestos, pagos fijos y tasas.
// Se arma en el teléfono con lo que ya está cargado; no pasa por ningún servidor extra.
import { useEffect, useState } from 'react';
import { html, Icon, toast } from './ui.js';
import { buildXlsx } from './xlsx.js';
import { saveFile } from './export.js';
import { todayISO } from './money.js';
import { api } from './api.js';

const TYPE = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };
const KIND = { cash: 'Efectivo', bank: 'Banco', digital: 'Digital', crypto: 'Cripto' };
const n = (v) => (v == null || v === '' ? null : Number(v));
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

export function backupSheets(d) {
  const acc = (id) => d.accById[id]?.name ?? '';
  const sheets = [
    { name: 'Resumen', rows: [
      ['Respaldo de La Fructosa', ''],
      ['Fecha', todayISO()],
      ['Usuario', d.profile.username ? '@' + d.profile.username : d.profile.display_name || ''],
      ['País', d.profile.region || 'VE'],
      ['Moneda principal', d.target],
      [`Patrimonio total (${d.target})`, n(Number(d.total?.total ?? 0).toFixed(2))],
      ['Cuentas', d.accounts.length],
      ['Movimientos', d.txs.length],
      ['', ''],
      ['Cuenta', 'Saldo', 'Moneda'],
      ...d.accounts.filter((a) => !a.archived).map((a) => [a.name, n(a.balance), a.currency]),
    ] },
    { name: 'Cuentas', rows: [
      ['Nombre', 'Moneda', 'Tipo', 'Saldo actual', 'Saldo inicial', 'Archivada', 'Creada', 'id'],
      ...d.accounts.map((a) => [a.name, a.currency, KIND[a.kind] || a.kind, n(a.balance), n(a.initial_balance), Boolean(a.archived), day(a.created_at), a.id]),
    ] },
    { name: 'Movimientos', rows: [
      ['Fecha', 'Tipo', 'Cuenta', 'Moneda', 'Monto', 'Categoría', 'Descripción', 'Cuenta destino', 'Monto destino',
        'Pagado en', 'Monto pagado', 'Tasa usada', 'Tasa BCV', 'Tasa paralelo', 'Brecha USD', `Valor en ${d.target}`, 'id', 'cuenta_id', 'cuenta_destino_id'],
      ...d.txs.map((t) => [t.date, TYPE[t.type] || t.type, acc(t.account_id), t.currency, n(t.amount), t.category || '', t.description || '',
        t.to_account_id ? acc(t.to_account_id) : '', n(t.to_amount), t.original_currency || '', n(t.original_amount), n(t.rate_applied),
        n(t.rate_bcv), n(t.rate_paralelo), n(t.spread_usd), n(Number(t.value).toFixed(2)), t.id, t.account_id, t.to_account_id || '']),
    ] },
    { name: 'Presupuestos', rows: [
      ['Categoría', 'Tope mensual', 'Moneda'],
      ...(d.budgets || []).map((b) => [b.category, n(b.monthly_limit), b.currency]),
    ] },
    { name: 'Pagos fijos', rows: [
      ['Nombre', 'Monto', 'Moneda', 'Categoría', 'Día de pago', 'Cuenta', 'Activo'],
      ...(d.recurring || []).map((r) => [r.name, n(r.amount), r.currency, r.category || '', r.due_day, acc(r.account_id), r.is_active !== false]),
    ] },
  ];
  if (d.goals?.length) sheets.push({ name: 'Metas', rows: [
    ['Meta', 'Objetivo', 'Ahorrado', 'Moneda', 'Fecha límite', 'Cumplida'],
    ...d.goals.map((g) => [g.name, n(g.target_amount), n(g.saved_amount), g.currency, day(g.target_date), Boolean(g.done)]),
  ] });
  if (d.loans?.length) sheets.push({ name: 'Préstamos', rows: [
    ['Persona', 'Tipo', 'Monto', 'Pagado', 'Moneda', 'Fecha', 'Vence', 'Saldado', 'Nota'],
    ...d.loans.map((l) => [l.person, l.direction === 'lent' ? 'Le presté' : 'Me prestó', n(l.amount), n(l.paid_amount), l.currency,
      day(l.occurred_on), day(l.due_on), Boolean(l.settled), l.note || '']),
  ] });
  if (d.region?.rates && d.rateHistory?.length) sheets.push({ name: 'Tasas', rows: [
    ['Fecha', 'Tipo', 'Bs. por unidad', 'Fuente'],
    ...d.rateHistory.map((r) => [r.rate_date, r.rate_type, n(r.rate), r.source || '']),
  ] });
  return sheets;
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
      <div class="grow"><b>${last ? 'Toca tu respaldo semanal' : 'Haz tu primer respaldo'}</b>
        <small class="muted">Descarga un Excel con todos tus datos y guárdalo en una carpeta segura.</small></div></div>
    <div class="row-btns backup-btns">
      <button class="btn ghost sm" onClick=${later}>Luego</button>
      <button class="btn primary sm" onClick=${() => downloadBackup(d).catch((e) => toast(String(e?.message || e), { tone: 'bad' }))}>Descargar</button>
    </div>
  </section>`;
}

// Banner fino arriba de las demás pantallas (en Inicio ya está la tarjeta grande). Comparte el "Luego".
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
