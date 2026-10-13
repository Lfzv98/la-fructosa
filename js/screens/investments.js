// Inversiones: acciones, fondos, cripto, plazos fijos… con su ganancia o pérdida.
// Solo aparece si el perfil tiene el permiso investments_enabled (migración 015).
// No mueven dinero de tus cuentas; su valor actual sí suma al Patrimonio total.
import { useState } from 'react';
import { html, Icon, Money, Sheet, Field, Segmented, Empty, SectionTitle, toast, confirmDialog, errorText } from '../ui.js';
import { useData } from '../store.js';
import { PageHeader } from './common.js';
import { CURRENCIES, INVESTMENT_KINDS, investmentGain, consolidateInvestments, fmt, fmtPct, parseAmount, todayISO } from '../money.js';

const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const toInput = (v) => (v == null || v === '' ? '' : String(Number(v)).replace('.', ','));
const tone = (g) => (g > 0 ? 'pos' : g < 0 ? 'neg' : 'muted');
const pctText = (p) => (p == null ? '—' : (p > 0 ? '+' : '') + fmtPct(p, 2));

function AmountInput({ currency, value, onChange }) {
  return html`<div class="input-affix"><span>${CURRENCIES[currency]?.symbol || ''}</span>
    <input class="input num" inputmode="decimal" placeholder="0" value=${value} onInput=${(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} /></div>`;
}

export function Investments() {
  const { investments, target, rates, val } = useData();
  const [form, setForm] = useState(null);
  const sum = consolidateInvestments(investments, target, rates, val);

  // Por tipo, de mayor a menor valor actual.
  const groups = Object.keys(INVESTMENT_KINDS)
    .map((k) => ({ k, list: investments.filter((i) => (i.kind || 'otro') === k) }))
    .filter((g) => g.list.length)
    .map((g) => ({ ...g, sum: consolidateInvestments(g.list, target, rates, val) }))
    .sort((a, b) => b.sum.value - a.sum.value);

  return html`<div class="page">
    <${PageHeader} title="Inversiones" sub="Su valor actual suma a tu Patrimonio total" back="#/mas" actions=${html`
      <button class="btn sm primary" onClick=${() => setForm({})}><${Icon} name="plus" size=${16} /> Nueva</button>`} />

    ${investments.length > 0 && html`<section class="inv-sum">
      <div class="card pad"><small class="muted">Invertido</small><b class="num"><${Money} v=${sum.invested} c=${target} /></b></div>
      <div class="card pad"><small class="muted">Valor actual</small><b class="num"><${Money} v=${sum.value} c=${target} /></b></div>
      <div class="card pad"><small class="muted">${sum.gain < 0 ? 'Pérdida' : 'Ganancia'}</small>
        <b class=${'num ' + tone(sum.gain)}><${Money} v=${sum.gain} c=${target} sign /></b>
        <small class=${'num ' + tone(sum.gain)}>${pctText(sum.pct)}</small></div>
    </section>`}
    ${sum.missing && html`<p class="hint">Faltan tasas para convertir algunas inversiones a ${target}; no entran en el total.</p>`}

    ${investments.length === 0
      ? html`<${Empty} art="growth" title="Registra tu primera inversión" text="Acciones, fondos, cripto o un plazo fijo: anota cuánto pusiste y cuánto vale hoy, y verás tu ganancia o pérdida."
          action=${html`<button class="btn primary" onClick=${() => setForm({})}>Agregar inversión</button>`} />`
      : groups.map(({ k, list, sum: gs }) => html`<section key=${k} class="inv-group">
          <${SectionTitle} action=${html`<span class=${'num ' + tone(gs.gain)}>${pctText(gs.pct)}</span>`}>${INVESTMENT_KINDS[k].emoji} ${INVESTMENT_KINDS[k].label}<//>
          <div class="card list">${list.map((inv) => {
            const g = investmentGain(inv);
            return html`<button key=${inv.id} class="tx-row inv-row" onClick=${() => setForm(inv)}>
              <span class="tx-ico">${INVESTMENT_KINDS[inv.kind]?.emoji || '💼'}</span>
              <span class="tx-main"><b>${inv.name}</b>
                <small>Desde ${dmy(inv.invested_on)} · invertido ${fmt(g.invested, inv.currency)}${inv.note ? ' · ' + inv.note : ''}</small></span>
              <span class="inv-amt">
                <b class="num"><${Money} v=${g.value} c=${inv.currency} /></b>
                <small class=${'num ' + tone(g.gain)}><${Money} v=${g.gain} c=${inv.currency} sign /> · ${pctText(g.pct)}</small>
              </span>
            </button>`;
          })}</div>
        </section>`)}

    <p class="hint center">Las inversiones no mueven dinero de tus cuentas. Si el dinero salió de una cuenta, regístralo también como gasto o transferencia. Actualiza el valor actual cuando cambie.</p>
    ${form && html`<${InvestmentForm} inv=${form.id ? form : null} onClose=${() => setForm(null)} />`}
  </div>`;
}

function InvestmentForm({ inv, onClose }) {
  const { actions, target, region } = useData();
  const editing = Boolean(inv);
  const currencies = [...new Set([...region.currencies, ...(inv ? [inv.currency] : [])])];
  const [name, setName] = useState(inv?.name || '');
  const [kind, setKind] = useState(inv?.kind || 'acciones');
  const [currency, setCurrency] = useState(inv?.currency || (region.currencies.includes(target) ? target : region.base));
  const [invested, setInvested] = useState(toInput(inv?.invested_amount));
  const [value, setValue] = useState(toInput(inv?.current_value));
  const [date, setDate] = useState(inv?.invested_on || todayISO());
  const [note, setNote] = useState(inv?.note || '');
  const [err, setErr] = useState('');

  const a = parseAmount(invested);
  const v = value === '' ? a : parseAmount(value);
  const preview = a > 0 && v >= 0 ? investmentGain({ invested_amount: a, current_value: v }) : null;

  async function submit(close) {
    if (!name.trim()) return setErr('Escribe un nombre. Ej. "Acciones Apple" o "Plazo fijo Banesco".');
    if (!(a > 0)) return setErr('Escribe cuánto invertiste.');
    if (!(v >= 0)) return setErr('El valor actual no es válido.');
    if (!date) return setErr('Elige la fecha de la inversión.');
    try {
      await actions.save('investments', { name: name.trim(), kind, currency, invested_amount: a, current_value: v, invested_on: date, note: note.trim() || null }, inv?.id);
      close(); toast(editing ? 'Inversión actualizada' : 'Inversión agregada');
    } catch (e) { setErr(errorText(e)); }
  }
  async function remove(close) {
    if (!(await confirmDialog({ title: `¿Eliminar "${inv.name}"?`, body: 'Deja de sumar a tu patrimonio.', confirm: 'Eliminar', tone: 'danger' }))) return;
    try { await actions.remove('investments', inv.id); close(); toast('Inversión eliminada'); } catch (e) { setErr(errorText(e)); }
  }

  return html`<${Sheet} title=${editing ? 'Editar inversión' : 'Nueva inversión'} onClose=${onClose}
    footer=${(close) => html`<div class="foot-row">
      ${editing && html`<button class="btn ghost danger-text" onClick=${() => remove(close)} aria-label="Eliminar"><${Icon} name="trash" size=${18} /></button>`}
      <button class="btn primary grow" onClick=${() => submit(close)}>${editing ? 'Guardar' : 'Agregar inversión'}</button></div>`}>
    <div class="stack">
      <${Field} label="Nombre"><input class="input" maxLength="60" placeholder="Ej. Acciones Apple" value=${name} onInput=${(e) => { setName(e.target.value); setErr(''); }} /><//>
      <${Field} label="Tipo"><div class="emoji-pick">${Object.entries(INVESTMENT_KINDS).map(([k, t]) => html`<button key=${k} type="button"
        class=${'chip' + (kind === k ? ' on' : '')} onClick=${() => setKind(k)}>${t.emoji} ${t.label}</button>`)}</div><//>
      <${Field} label="Moneda"><${Segmented} value=${currency} onChange=${setCurrency} options=${currencies.map((c) => [c, c])} /><//>
      <${Field} label="Monto invertido"><${AmountInput} currency=${currency} value=${invested} onChange=${(x) => { setInvested(x); setErr(''); }} /><//>
      <${Field} label="Valor actual" hint="Cuánto vale hoy. Si lo dejas vacío, se usa el monto invertido."><${AmountInput} currency=${currency} value=${value} onChange=${(x) => { setValue(x); setErr(''); }} /><//>
      ${preview && html`<p class=${'inv-preview num ' + tone(preview.gain)}>${preview.gain < 0 ? 'Pérdida' : 'Ganancia'}: ${fmt(preview.gain, currency, { sign: true })} · ${pctText(preview.pct)}</p>`}
      <${Field} label="Fecha de la inversión"><input class="input" type="date" max=${todayISO()} value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
      <${Field} label="Nota" hint="Opcional. Ej. broker, tasa del plazo fijo, vencimiento."><input class="input" maxLength="200" value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
      ${err && html`<p class="form-error">${err}</p>`}
    </div>
  <//>`;
}
