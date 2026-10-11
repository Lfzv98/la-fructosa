// Movimientos: por mes, con búsqueda, filtros, totales por día y exportación.
import { useMemo, useState } from 'react';
import { html, Icon, Money, Empty, Segmented } from '../ui.js';
import { useData } from '../store.js';
import { TxRow, PageHeader } from './common.js';
import { exportCSV } from '../export.js';
import { CATEGORIES, todayISO, monthKey, monthLabel, addMonths, dayLabel } from '../money.js';

export function Movements({ query }) {
  const { txs, accById, accounts, target } = useData();
  const [ym, setYm] = useState(monthKey(todayISO()));
  const [type, setType] = useState(query.get('tipo') || 'all');
  const [account, setAccount] = useState(query.get('cuenta') || '');
  const [category, setCategory] = useState(query.get('cat') || '');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const allMonths = ym === 'all';

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txs.filter((t) => (allMonths || needle || monthKey(t.date) === ym)
      && (type === 'all' || t.type === type)
      && (!account || t.account_id === account || t.to_account_id === account)
      && (!category || t.category === category)
      && (!needle || [t.description, t.category, accById[t.account_id]?.name, String(t.amount)].some((s) => s && String(s).toLowerCase().includes(needle))));
  }, [txs, ym, type, account, category, q]);

  const sum = filtered.reduce((s, t) => {
    if (t.type === 'income') s.inc += t.value; else if (t.type === 'expense') s.exp += t.value;
    return s;
  }, { inc: 0, exp: 0 });

  const groups = [];
  for (const t of filtered) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] });
  }
  const dayNet = (items) => items.reduce((s, t) => s + (t.type === 'income' ? t.value : t.type === 'expense' ? -t.value : 0), 0);
  const isCurrent = ym === monthKey(todayISO());
  const allCats = [...new Set([...CATEGORIES.expense, ...CATEGORIES.income].map((c) => c.name))];
  const activeFilters = (account ? 1 : 0) + (category ? 1 : 0);

  return html`<div class="page">
    <${PageHeader} title="Movimientos" actions=${html`
      <button class=${'icon-btn' + (searching ? ' on' : '')} onClick=${() => { setSearching(!searching); setQ(''); }} aria-label="Buscar"><${Icon} name="search" /></button>
      <button class="icon-btn" onClick=${() => exportCSV(filtered, accById)} aria-label="Exportar CSV" disabled=${!filtered.length}><${Icon} name="download" /></button>`} />

    ${searching && html`<div class="search"><${Icon} name="search" size=${18} />
      <input class="input" autofocus placeholder="Buscar en todos los meses…" value=${q} onInput=${(e) => setQ(e.target.value)} />
      ${q && html`<button class="icon-btn sm" onClick=${() => setQ('')} aria-label="Limpiar"><${Icon} name="x" size=${16} /></button>`}
    </div>`}

    ${!q && html`<div class="month-nav">
      <button class="icon-btn" onClick=${() => setYm(allMonths ? monthKey(todayISO()) : addMonths(ym, -1))} aria-label="Mes anterior"><${Icon} name="left" /></button>
      <button class="month-label" onClick=${() => setYm(allMonths ? monthKey(todayISO()) : 'all')}>${allMonths ? 'Todos los meses' : monthLabel(ym)}</button>
      <button class="icon-btn" disabled=${isCurrent || allMonths} onClick=${() => setYm(addMonths(ym, 1))} aria-label="Mes siguiente"><${Icon} name="right" /></button>
    </div>`}

    <div class="sum-row">
      <div><small>Ingresos</small><b class="inc"><${Money} v=${sum.inc} c=${target} /></b></div>
      <div><small>Gastos</small><b class="exp"><${Money} v=${sum.exp} c=${target} /></b></div>
      <div><small>Neto</small><b class=${sum.inc - sum.exp >= 0 ? 'inc' : 'exp'}><${Money} v=${sum.inc - sum.exp} c=${target} sign /></b></div>
    </div>

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
          text=${q ? `No hay movimientos que coincidan con "${q}".` : 'No hay movimientos con estos filtros en este mes.'} />`
      : groups.map((g) => html`<section key=${g.date} class="day-group">
          <div class="day-head"><span>${dayLabel(g.date)}</span><span class="num"><${Money} v=${dayNet(g.items)} c=${target} sign /></span></div>
          <div class="card list">${g.items.map((t) => html`<${TxRow} key=${t.id} t=${t} accById=${accById} />`)}</div>
        </section>`)}
    ${filtered.length > 0 && html`<p class="hint center">${filtered.length} movimiento${filtered.length === 1 ? '' : 's'} · totales convertidos a ${target} con la tasa de cada día</p>`}
  </div>`;
}
