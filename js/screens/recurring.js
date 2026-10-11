// Pagos fijos: alquiler, servicios, suscripciones. Avisos y registro con un toque.
import { useState } from 'react';
import { html, Icon, Money, Sheet, Field, Segmented, Empty, SectionTitle, Switch, toast, confirmDialog, errorText } from '../ui.js';
import { useData } from '../store.js';
import { Learn } from '../learn.js';
import { PageHeader, openTx, recurringStatus, dueLabel } from './common.js';
import { CATEGORIES, CURRENCIES, KINDS, categoryMeta, convert, parseAmount } from '../money.js';

// Prepara el formulario de pago según la moneda del fijo y la de la cuenta.
export function payRecurring(r, accById, rates) {
  const acc = accById[r.account_id];
  const preset = { type: 'expense', account_id: r.account_id, category: r.category || 'Servicios', description: r.name, recurring_id: r.id };
  if (!acc || acc.currency === r.currency) preset.amount = r.amount;
  else if (r.currency === 'VES') { preset.original_currency = 'VES'; preset.original_amount = r.amount; }
  else preset.amount = Number((convert(r.amount, r.currency, acc.currency, rates, 'BCV_USD') || r.amount).toFixed(2));
  openTx({ preset });
}

export function Recurring() {
  const { recurring, txs, accById, target, rates, val, missing } = useData();
  const [form, setForm] = useState(null);
  const items = recurring.map((r) => ({ r, s: recurringStatus(r, txs) }));
  const activeItems = items.filter(({ r }) => r.is_active !== false);
  const pending = activeItems.filter(({ s }) => !s.paid).sort((a, b) => a.s.diff - b.s.diff);
  const paid = activeItems.filter(({ s }) => s.paid);
  const paused = items.filter(({ r }) => r.is_active === false);
  const monthly = activeItems.reduce((s, { r }) => s + (convert(r.amount, r.currency, target, rates, val) ?? 0), 0);
  const pendingTotal = pending.reduce((s, { r }) => s + (convert(r.amount, r.currency, target, rates, val) ?? 0), 0);

  if (missing.includes('recurring_expenses')) {
    return html`<div class="page"><${PageHeader} title="Pagos fijos" back="#/mas" />
      <${Empty} art="database" title="Falta activar pagos fijos" text="Ejecuta supabase/migrations/002_mejoras.sql en el SQL Editor de Supabase y recarga." /></div>`;
  }

  const Row = ({ r, s }) => {
    const meta = categoryMeta(r.category);
    return html`<div class="due-row">
      <button class="due-main" onClick=${() => setForm(r)}>
        <span class="tx-ico" style=${{ '--cat': meta.color }}>${meta.emoji}</span>
        <span class="tx-main"><b>${r.name}</b><small class=${s.overdue ? 'bad-text' : ''}>${r.is_active === false ? `Pausado · día ${r.due_day}` : dueLabel(s)} · ${accById[r.account_id]?.name || 'sin cuenta'}</small></span>
        <${Money} v=${r.amount} c=${r.currency} />
      </button>
      ${r.is_active !== false && (s.paid
        ? html`<span class="paid-badge"><${Icon} name="check" size=${16} /></span>`
        : html`<button class="btn sm primary" onClick=${() => payRecurring(r, accById, rates)}>Pagar</button>`)}
    </div>`;
  };

  return html`<div class="page">
    <${PageHeader} title="Pagos fijos" back="#/mas" actions=${html`
      <button class="btn sm primary" onClick=${() => setForm({})}><${Icon} name="plus" size=${16} /> Nuevo</button>`} />

    ${activeItems.length > 0 && html`<section class="card pad">
      <div class="kpis">
        <div><small>Compromisos al mes <${Learn} term="fijos" /></small><b class="num"><${Money} v=${monthly} c=${target} /></b></div>
        <div><small>Falta pagar</small><b class="num exp"><${Money} v=${pendingTotal} c=${target} /></b></div>
      </div>
    </section>`}

    ${items.length === 0 && html`<${Empty} art="calendar" title="Sin pagos fijos" text="Registra alquiler, internet, colegio o Netflix una sola vez. La app te recuerda cuándo vencen y los registra con un toque."
      action=${html`<button class="btn primary" onClick=${() => setForm({})}>Agregar pago fijo</button>`} />`}

    ${pending.length > 0 && html`<section><${SectionTitle}>Por pagar<//><div class="card list">${pending.map((x) => html`<${Row} key=${x.r.id} ...${x} />`)}</div></section>`}
    ${paid.length > 0 && html`<section><${SectionTitle}>Pagados este mes<//><div class="card list">${paid.map((x) => html`<${Row} key=${x.r.id} ...${x} />`)}</div></section>`}
    ${paused.length > 0 && html`<section><${SectionTitle}>Pausados<//><div class="card list">${paused.map((x) => html`<${Row} key=${x.r.id} ...${x} />`)}</div></section>`}

    ${form && html`<${RecurringForm} item=${form.id ? form : null} onClose=${() => setForm(null)} />`}
  </div>`;
}

function RecurringForm({ item, onClose }) {
  const { active, actions, accById, region } = useData();
  const editing = Boolean(item);
  const [f, setF] = useState(item ? { ...item, amount: String(item.amount).replace('.', ',') }
    : { name: '', amount: '', currency: active[0]?.currency || 'USD', category: 'Servicios', due_day: Number(new Date().getDate()), account_id: active[0]?.id || '', is_active: true });
  const [err, setErr] = useState('');
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr(''); };

  async function submit(close) {
    const amount = parseAmount(f.amount);
    if (!f.name.trim()) return setErr('Ponle un nombre (ej. Alquiler).');
    if (!(amount > 0)) return setErr('Escribe el monto.');
    if (!f.account_id) return setErr('Elige desde qué cuenta lo pagas.');
    const day = Math.max(1, Math.min(31, Number(f.due_day) || 1));
    try {
      await actions.save('recurring_expenses', { name: f.name.trim(), amount, currency: f.currency, category: f.category, due_day: day, account_id: f.account_id, is_active: f.is_active }, item?.id);
      close(); toast(editing ? 'Pago fijo actualizado' : 'Pago fijo creado');
    } catch (e) { setErr(errorText(e)); }
  }
  async function remove(close) {
    if (!(await confirmDialog({ title: `¿Eliminar "${item.name}"?`, body: 'Los pagos ya registrados se conservan.', confirm: 'Eliminar', tone: 'danger' }))) return;
    await actions.remove('recurring_expenses', item.id); close(); toast('Pago fijo eliminado');
  }

  return html`<${Sheet} title=${editing ? 'Editar pago fijo' : 'Nuevo pago fijo'} onClose=${onClose}
    footer=${(close) => html`<div class="foot-row">
      ${editing && html`<button class="btn ghost danger-text" onClick=${() => remove(close)}><${Icon} name="trash" size=${18} /></button>`}
      <button class="btn primary grow" onClick=${() => submit(close)}>${editing ? 'Guardar' : 'Crear pago fijo'}</button></div>`}>
    <div class="stack">
      <${Field} label="Nombre"><input class="input" maxlength="60" placeholder="Ej. Alquiler, Internet, Netflix" value=${f.name} onInput=${(e) => set('name', e.target.value)} /><//>
      <div class="grid2">
        <${Field} label="Monto"><div class="input-affix"><span>${CURRENCIES[f.currency].symbol}</span>
          <input class="input num" inputmode="decimal" placeholder="0,00" value=${f.amount} onInput=${(e) => set('amount', e.target.value.replace(/[^\d.,]/g, ''))} /></div><//>
        <${Field} label="Día del mes"><input class="input num" type="number" min="1" max="31" inputmode="numeric" value=${f.due_day} onInput=${(e) => set('due_day', e.target.value)} /><//>
      </div>
      <${Field} label="Moneda" hint=${region.rates ? 'Si es en Bs. y lo pagas desde una cuenta en $, al pagar se activa la calculadora de brecha.' : ''}>
        <${Segmented} value=${f.currency} onChange=${(v) => set('currency', v)} options=${[...new Set([...region.currencies, f.currency])].map((c) => [c, c])} />
      <//>
      <${Field} label="Se paga desde">
        <select class="select block" value=${f.account_id} onChange=${(e) => { const a = accById[e.target.value]; setF((x) => ({ ...x, account_id: e.target.value, currency: editing ? x.currency : a?.currency || x.currency })); }}>
          ${active.map((a) => html`<option key=${a.id} value=${a.id}>${a.icon || KINDS[a.kind]?.emoji} ${a.name} · ${a.currency}</option>`)}
        </select>
      <//>
      <${Field} label="Categoría">
        <div class="chips">${CATEGORIES.expense.map((c) => html`<button key=${c.name} type="button" class=${'chip' + (f.category === c.name ? ' on' : '')} onClick=${() => set('category', c.name)}>${c.emoji} ${c.name}</button>`)}</div>
      <//>
      ${editing && html`<${Switch} checked=${f.is_active} onChange=${(v) => set('is_active', v)} label="Activo" sub="Pausa los avisos sin borrarlo" />`}
      ${err && html`<p class="form-error">${err}</p>`}
    </div>
  <//>`;
}
