// Piezas compartidas entre pantallas.
import { html, Icon, Money } from '../ui.js';
import { categoryMeta, fmt, KINDS, todayISO, monthKey, daysInMonth } from '../money.js';

// Abrir el formulario de movimiento desde cualquier parte.
export const openTx = (detail = {}) => window.dispatchEvent(new CustomEvent('fructosa-open-tx', { detail }));
export const go = (hash) => { location.hash = hash; };

export function TxRow({ t, accById, showDate = false }) {
  const meta = categoryMeta(t.category, t.type);
  const acc = accById[t.account_id];
  const to = accById[t.to_account_id];
  const title = t.description || meta.name;
  const sub = t.type === 'transfer'
    ? `${acc?.name || '¿?'} → ${to?.name || '¿?'}`
    : [t.description ? meta.name : null, acc?.name].filter(Boolean).join(' · ');
  const sign = t.type === 'income' ? 1 : t.type === 'expense' ? -1 : 0;
  return html`<button class="tx-row" onClick=${() => openTx({ tx: t })}>
    <span class="tx-ico" style=${{ '--cat': meta.color }}>${meta.emoji}</span>
    <span class="tx-main">
      <b>${title}</b>
      <small>${sub}${t.original_currency === 'VES' ? html` · <span class="num">${fmt(t.original_amount, 'VES', { decimals: 0 })}</span>` : ''}${showDate ? ' · ' + t.date.slice(8) + '/' + t.date.slice(5, 7) : ''}${t.pending ? html`<span class="tx-pending" title="Guardado en el teléfono; se subirá cuando vuelva la conexión"> ⏳ por subir</span>` : ''}</small>
    </span>
    <span class=${'tx-amt ' + t.type}>
      <${Money} v=${sign ? sign * t.amount : t.amount} c=${acc?.currency || 'USD'} sign=${sign !== 0} />
      ${t.type === 'transfer' && to && to.currency !== acc?.currency && html`<small><${Money} v=${t.to_amount} c=${to.currency} /></small>`}
      ${t.recurring_id && html`<small class="tag">fijo</small>`}
      ${t.receipt_path && html`<small class="tag" title="Tiene comprobante">📎</small>`}
    </span>
  </button>`;
}

export function AccountRow({ a, target, converted, onClick }) {
  return html`<button class="acc-row" onClick=${onClick} style=${{ '--acc': a.color || 'var(--blue)' }}>
    <span class="acc-ico">${a.icon || KINDS[a.kind]?.emoji || '💼'}</span>
    <span class="acc-main"><b>${a.name}</b><small>${KINDS[a.kind]?.label || ''} · ${a.currency}${a.archived ? ' · archivada' : ''}</small></span>
    <span class="acc-bal">
      <${Money} v=${a.balance} c=${a.currency} class=${a.balance < 0 ? 'neg' : ''} />
      ${a.currency !== target && converted != null && html`<small>≈ <${Money} v=${converted} c=${target} /></small>`}
    </span>
    <${Icon} name="right" size=${16} class="muted" />
  </button>`;
}

// Estado de un pago fijo en el mes actual.
export function recurringStatus(r, txs) {
  const today = todayISO();
  const ym = monthKey(today);
  const day = Math.min(r.due_day, daysInMonth(ym));
  const due = `${ym}-${String(day).padStart(2, '0')}`;
  const paidTx = txs.find((t) => monthKey(t.date) === ym && (t.recurring_id === r.id ||
    (!t.recurring_id && t.type === 'expense' && t.description === r.name && t.account_id === r.account_id)));
  const diff = Math.round((new Date(due + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 864e5);
  return { due, diff, paid: Boolean(paidTx), paidTx, overdue: !paidTx && diff < 0, soon: !paidTx && diff >= 0 && diff <= 7 };
}

export function dueLabel(s) {
  if (s.paid) return 'Pagado este mes';
  if (s.overdue) return `Vencido hace ${-s.diff} día${s.diff === -1 ? '' : 's'}`;
  if (s.diff === 0) return 'Vence hoy';
  if (s.diff === 1) return 'Vence mañana';
  return `Vence en ${s.diff} días`;
}

export function PageHeader({ title, sub, actions, back }) {
  return html`<header class="page-head">
    ${back && html`<button class="icon-btn" onClick=${() => history.length > 1 ? history.back() : go(back)} aria-label="Volver"><${Icon} name="left" /></button>`}
    <div class="page-title"><h1>${title}</h1>${sub && html`<p>${sub}</p>`}</div>
    <div class="page-actions">${actions}</div>
  </header>`;
}

// Aviso cuando las tasas llevan 2 días o más sin actualizarse (la función automática pudo fallar).
export function RatesStale({ rateMeta, onRetry }) {
  const last = ['BCV_USD', 'PARALELO', 'USDT'].map((k) => rateMeta?.[k]?.rate_date).filter(Boolean).sort().pop();
  if (!last) return null;
  const days = Math.round((Date.parse(todayISO() + 'T12:00:00Z') - Date.parse(last + 'T12:00:00Z')) / 864e5);
  if (days < 2) return null;
  return html`<div class="callout warn rates-stale-note" role="status">
    ⚠️ Las tasas llevan <b>${days} días</b> sin actualizarse (última: ${last.slice(8)}/${last.slice(5, 7)}). Los montos en bolívares pueden no ser exactos.
    ${onRetry && html`<button class="btn sm soft" onClick=${onRetry}>Reintentar</button>`}
  </div>`;
}
