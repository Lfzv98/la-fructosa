// Movimientos: por mes, con búsqueda, filtros, totales por día y exportación.
import { useMemo, useState } from 'react';
import { html, Icon, Money, Empty, Segmented } from '../ui.js';
import { useData, usePref } from '../store.js';
import { TxRow, PageHeader } from './common.js';
import { exportMovementsXlsx } from '../backup.js';
import { categoriesFor, todayISO, monthKey, monthLabel, addMonths, dayLabel, daysInMonth, CURRENCIES } from '../money.js';

export function Movements({ query }) {
  const d = useData();
  const { txs, accById, accounts, target, region } = d;
  const [ym, setYm] = useState(monthKey(todayISO()));
  const [type, setType] = useState(query.get('tipo') || 'all');
  const [account, setAccount] = useState(query.get('cuenta') || '');
  const [category, setCategory] = useState(query.get('cat') || '');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [view, setView] = usePref('mov-view', 'list'); // 'list' | 'cal'
  const [day, setDay] = useState(null); // día elegido en el calendario
  const allMonths = ym === 'all';
  const calendar = view === 'cal' && !allMonths && !q.trim();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txs.filter((t) => (allMonths || needle || monthKey(t.date) === ym)
      && (type === 'all' || t.type === type)
      && (!account || t.account_id === account || t.to_account_id === account)
      && (!category || t.category === category)
      && (!needle || [t.description, t.category, accById[t.account_id]?.name, String(t.amount)].some((s) => s && String(s).toLowerCase().includes(needle))));
  }, [txs, ym, type, account, category, q]);

  const shown = calendar && day ? filtered.filter((t) => t.date === day) : filtered;
  const sum = shown.reduce((s, t) => {
    if (t.type === 'income') s.inc += t.value; else if (t.type === 'expense') s.exp += t.value;
    return s;
  }, { inc: 0, exp: 0 });

  const groups = [];
  for (const t of shown) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] });
  }
  const dayNet = (items) => items.reduce((s, t) => s + (t.type === 'income' ? t.value : t.type === 'expense' ? -t.value : 0), 0);
  const isCurrent = ym === monthKey(todayISO());
  const allCats = [...new Set([...categoriesFor(region, 'expense'), ...categoriesFor(region, 'income')].map((c) => c.name))];
  const activeFilters = (account ? 1 : 0) + (category ? 1 : 0);

  return html`<div class="page">
    <${PageHeader} title="Movimientos" actions=${html`
      <button class=${'icon-btn' + (view === 'cal' ? ' on' : '')} onClick=${() => { setView(view === 'cal' ? 'list' : 'cal'); setDay(null); }}
        aria-label=${view === 'cal' ? 'Ver como lista' : 'Ver calendario'} aria-pressed=${view === 'cal'}><${Icon} name=${view === 'cal' ? 'list' : 'calendar'} /></button>
      <button class=${'icon-btn' + (searching ? ' on' : '')} onClick=${() => { setSearching(!searching); setQ(''); }} aria-label="Buscar"><${Icon} name="search" /></button>
      <button class="icon-btn" onClick=${() => exportMovementsXlsx(filtered, d)} aria-label="Exportar a Excel" disabled=${!filtered.length}><${Icon} name="download" /></button>`} />

    ${searching && html`<div class="search"><${Icon} name="search" size=${18} />
      <input class="input" autofocus placeholder="Buscar en todos los meses…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      ${q && html`<button class="icon-btn sm" onClick=${() => setQ('')} aria-label="Limpiar"><${Icon} name="x" size=${16} /></button>`}
    </div>`}

    ${!q && html`<div class="month-nav">
      <button class="icon-btn" onClick=${() => { setDay(null); setYm(allMonths ? monthKey(todayISO()) : addMonths(ym, -1)); }} aria-label="Mes anterior"><${Icon} name="left" /></button>
      <button class="month-label" onClick=${() => { setDay(null); setYm(allMonths ? monthKey(todayISO()) : 'all'); }}>${allMonths ? 'Todos los meses' : monthLabel(ym)}</button>
      <button class="icon-btn" disabled=${isCurrent || allMonths} onClick=${() => { setDay(null); setYm(addMonths(ym, 1)); }} aria-label="Mes siguiente"><${Icon} name="right" /></button>
    </div>`}

    <div class="sum-row">
      <div><small>Ingresos</small><b class="inc"><${Money} v=${sum.inc} c=${target} /></b></div>
      <div><small>Gastos</small><b class="exp"><${Money} v=${sum.exp} c=${target} /></b></div>
      <div><small>Neto</small><b class=${sum.inc - sum.exp >= 0 ? 'inc' : 'exp'}><${Money} v=${sum.inc - sum.exp} c=${target} sign /></b></div>
    </div>

    ${calendar && html`<${MonthCalendar} ym=${ym} txs=${filtered} target=${target} day=${day} onPick=${(dd) => setDay(day === dd ? null : dd)} />`}
    ${calendar && day && html`<div class="cal-picked"><span>${dayLabel(day)}</span><button class="link" onClick=${() => setDay(null)}>Ver todo el mes</button></div>`}

    <${Segmented} value=${type} onChange=${setType} options=${[['all', 'Todos'], ['expense', 'Gastos'], ['income', 'Ingresos'], ['transfer', 'Transf.']]} />
    <div class="filters">
      <select class=${'select' + (account ? ' on' : '')} value=${account} onChange=${(e) => setAccount(e.target.value)} aria-label="Cuenta">
        <option value="">Todas las cuentas</option>
        ${accounts.map((a) => html`<option key=${a.id} value=${a.id}>${a.name} · ${a.currency}</option>`)}
      </select>
      <select class=${'select' + (category ? ' on' : '')} value=${category} onChange=${(e) => setCategory(e.target.value)} aria-label="Categoría">
        <option value="">Todas las categorías</option>
        ${allCats.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
      </select>
      ${activeFilters > 0 && html`<button class="link" onClick=${() => { setAccount(''); setCategory(''); }}>Limpiar</button>`}
    </div>

    ${groups.length === 0
      ? html`<${Empty} art=${q ? 'search' : 'receipt'} title=${q ? 'Sin resultados' : 'Sin movimientos'}
          text=${q ? `No hay movimientos que coincidan con "${q}".` : calendar && day ? 'Ese día no tiene movimientos con estos filtros.' : 'No hay movimientos con estos filtros en este mes.'} />`
      : groups.map((g) => html`<section key=${g.date} class="day-group">
          <div class="day-head"><span>${dayLabel(g.date)}</span><span class="num"><${Money} v=${dayNet(g.items)} c=${target} sign /></span></div>
          <div class="card list">${g.items.map((t) => html`<${TxRow} key=${t.id} t=${t} accById=${accById} />`)}</div>
        </section>`)}
    ${shown.length > 0 && html`<p class="hint center">${shown.length} movimiento${shown.length === 1 ? '' : 's'} · totales convertidos a ${target} con la tasa de cada día</p>`}
  </div>`;
}

// Calendario del mes: cuánto gastaste cada día. Más color = más gasto. Toca un día para ver sus movimientos.
const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
function short(v, c) {
  const a = Math.abs(v);
  const n = a >= 1e6 ? (a / 1e6).toFixed(1).replace('.', ',') + 'M' : a >= 1e4 ? Math.round(a / 1e3) + 'k' : a >= 1e3 ? (a / 1e3).toFixed(1).replace('.', ',') + 'k' : String(Math.round(a));
  const sym = CURRENCIES[c]?.symbol || '';
  return c === 'EUR' ? `${n} ${sym}` : `${sym}${n}`;
}
function MonthCalendar({ ym, txs, target, day, onPick }) {
  const per = {};
  for (const t of txs) {
    if (t.type === 'transfer') continue;
    const p = (per[t.date] ??= { exp: 0, inc: 0 });
    if (t.type === 'expense') p.exp += t.value; else p.inc += t.value;
  }
  const max = Math.max(1, ...Object.values(per).map((p) => p.exp));
  const n = daysInMonth(ym);
  const lead = (new Date(ym + '-01T12:00:00Z').getUTCDay() + 6) % 7; // lunes primero
  const today = todayISO();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)];
  return html`<section class="card cal" aria-label="Calendario de gastos">
    <div class="cal-grid">
      ${WEEK.map((w, i) => html`<span key=${'w' + i} class="cal-wd">${w}</span>`)}
      ${cells.map((dd, i) => {
        if (!dd) return html`<span key=${'e' + i}></span>`;
        const p = per[dd];
        const heat = p?.exp ? 0.15 + 0.6 * (p.exp / max) : 0;
        const future = dd > today;
        return html`<button key=${dd} type="button" disabled=${future}
          class=${'cal-day' + (dd === day ? ' on' : '') + (dd === today ? ' today' : '') + (p ? ' has' : '')}
          style=${{ '--heat': heat }} onClick=${() => onPick(dd)}
          aria-label=${`${Number(dd.slice(8))}${p?.exp ? ', gastos ' + short(p.exp, target) : ''}${p?.inc ? ', ingresos ' + short(p.inc, target) : ''}`}>
          <span class="cal-n">${Number(dd.slice(8))}</span>
          ${p?.exp ? html`<small class="cal-exp num">${short(p.exp, target)}</small>` : ''}
          ${p?.inc ? html`<i class="cal-inc" title="Hubo ingresos"></i>` : ''}
        </button>`;
      })}
    </div>
    <p class="cal-legend"><span><i class="cal-swatch"></i> Gastos del día</span><span><i class="cal-inc"></i> Ingresos</span></p>
  </section>`;
}
