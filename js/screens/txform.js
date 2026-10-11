// Registrar / editar un movimiento: gasto, ingreso o transferencia,
// con la calculadora de brecha integrada al pagar en bolívares.
import { useMemo, useState } from 'react';
import { html, Icon, Sheet, Segmented, Field, Money, toast, confirmDialog, errorText, vibrate } from '../ui.js';
import { useData, usePref } from '../store.js';
import { Learn } from '../learn.js';
import {
  CATEGORIES, CURRENCIES, KINDS, RATE_LABELS, convert, fmt, fmtRate, fmtPct, marketRateFor, parseAmount,
  spreadCalc, todayISO, monthKey,
} from '../money.js';

const TYPE_LABEL = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' };

export function TxForm({ tx, preset = {}, onClose }) {
  const d = useData();
  const { active, accById, rates, region, actions, budgets, txs, target } = d;
  const editing = Boolean(tx?.id);
  const [lastAcc, setLastAcc] = usePref('last-account', null);
  const src = tx || preset;

  const firstAcc = src.account_id || (accById[lastAcc] && !accById[lastAcc].archived ? lastAcc : active[0]?.id) || '';
  const [type, setType] = useState(src.type || 'expense');
  const [accountId, setAccountId] = useState(firstAcc);
  const [toAccountId, setToAccountId] = useState(src.to_account_id || active.find((a) => a.id !== firstAcc)?.id || '');
  const [amount, setAmount] = useState(src.amount != null && !src.original_amount ? String(src.amount).replace('.', ',') : '');
  const [toAmount, setToAmount] = useState(src.to_amount != null ? String(src.to_amount).replace('.', ',') : '');
  const [toTouched, setToTouched] = useState(Boolean(src.to_amount));
  const [category, setCategory] = useState(src.category || '');
  const [description, setDescription] = useState(src.description || '');
  const [date, setDate] = useState(src.date || src.occurred_on || todayISO());
  const [payVes, setPayVes] = useState(src.original_currency === 'VES');
  const [ves, setVes] = useState(src.original_amount ? String(src.original_amount).replace('.', ',') : '');
  const [rateMode, setRateMode] = useState(src.rate_applied ? 'manual' : 'market');
  const [manualRate, setManualRate] = useState(src.rate_applied ? String(src.rate_applied).replace('.', ',') : '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const acc = accById[accountId];
  const toAcc = accById[toAccountId];
  const cur = acc?.currency || 'USD';
  const canPayVes = region.rates && type === 'expense' && acc && cur !== 'VES' && rates.BCV_USD;
  const usingVes = canPayVes && payVes;

  // Tasa aplicada al pagar en Bs.
  const rateOptions = [
    ['market', cur === 'USDT' ? 'USDT' : cur === 'EUR' ? 'Euro BCV' : 'Paralelo'],
    ['bcv', 'BCV'],
    ['manual', 'Otra'],
  ];
  const rateUsed = rateMode === 'bcv' ? (cur === 'EUR' ? rates.BCV_EUR : rates.BCV_USD)
    : rateMode === 'manual' ? parseAmount(manualRate) : marketRateFor(cur, rates);
  const vesNum = parseAmount(ves);
  const spread = usingVes && vesNum > 0 && rateUsed > 0 ? spreadCalc(vesNum, rates, rateUsed) : null;
  const finalAmount = usingVes ? (vesNum > 0 && rateUsed > 0 ? vesNum / rateUsed : NaN) : parseAmount(amount);

  // Transferencia entre monedas distintas: sugerimos el monto destino.
  const crossCurrency = type === 'transfer' && acc && toAcc && acc.currency !== toAcc.currency;
  const transferRate = (() => {
    if (!crossCurrency) return null;
    const pair = [acc.currency, toAcc.currency];
    if (pair.includes('VES')) {
      const fx = pair.find((c) => c !== 'VES');
      return { ves: marketRateFor(fx, rates), fx };
    }
    return null;
  })();
  const suggestedTo = crossCurrency && finalAmount > 0
    ? (transferRate
      ? (acc.currency === 'VES' ? finalAmount / transferRate.ves : finalAmount * transferRate.ves)
      : convert(finalAmount, acc.currency, toAcc.currency, rates, 'BCV_USD'))
    : null;
  const toFinal = crossCurrency ? (toTouched ? parseAmount(toAmount) : suggestedTo) : finalAmount;
  const impliedRate = crossCurrency && finalAmount > 0 && toFinal > 0
    ? (acc.currency === 'VES' ? finalAmount / toFinal : toAcc.currency === 'VES' ? toFinal / finalAmount : toFinal / finalAmount)
    : null;

  const cats = CATEGORIES[type];
  const effectiveCategory = type === 'transfer' ? (category && cats.some((c) => c.name === category) ? category : crossCurrency ? 'Cambio de divisa' : 'Transferencia interna') : category;

  // Presupuesto de la categoría elegida (contexto didáctico mientras registras).
  const budget = type === 'expense' && budgets.find((b) => b.category === category);
  const spentInCat = useMemo(() => {
    if (!budget) return 0;
    const ym = monthKey(todayISO());
    return txs.filter((t) => t.type === 'expense' && t.category === category && monthKey(t.date) === ym && t.id !== tx?.id)
      .reduce((s, t) => s + (convert(t.value, target, budget.currency, rates, d.val) ?? 0), 0);
  }, [budget, category, txs]);

  function validate() {
    const e = {};
    if (!acc) e.account = 'Elige una cuenta.';
    if (usingVes) {
      if (!(vesNum > 0)) e.ves = 'Escribe cuántos bolívares pagaste.';
      if (!(rateUsed > 0)) e.rate = 'Escribe la tasa a la que cambiaste.';
    } else if (!(finalAmount > 0)) e.amount = 'Escribe un monto mayor que cero.';
    if (type === 'transfer') {
      if (!toAcc) e.to = 'Elige la cuenta destino.';
      else if (toAccountId === accountId) e.to = 'La cuenta destino debe ser distinta.';
      if (crossCurrency && !(toFinal > 0)) e.toAmount = 'Escribe cuánto llegó a la cuenta destino.';
    } else if (!category) e.category = 'Elige una categoría.';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit(ev, close) {
    ev?.preventDefault();
    if (!validate() || busy) return;
    setBusy(true);
    const round = (n, dec = 8) => Number(Number(n).toFixed(dec));
    const row = {
      type, account_id: accountId, amount: round(finalAmount, 2), category: effectiveCategory,
      description: description.trim() || null, occurred_on: date,
      to_account_id: type === 'transfer' ? toAccountId : null,
      to_amount: type === 'transfer' ? round(toFinal, 2) : null,
      original_amount: usingVes ? round(vesNum, 2) : null,
      original_currency: usingVes ? 'VES' : null,
      rate_applied: usingVes ? round(rateUsed) : null,
      rate_bcv: usingVes ? round(rates.BCV_USD) : null,
      rate_paralelo: usingVes ? round(rateUsed) : null,
    };
    if (src.recurring_id) row.recurring_id = src.recurring_id;
    try {
      const saved = await actions.save('transactions', row, editing ? tx.id : null);
      setLastAcc(accountId);
      vibrate();
      close();
      const what = `${TYPE_LABEL[type]} ${editing ? 'actualizado' : 'registrado'} · ${fmt(row.amount, cur)}`;
      toast(type === 'transfer' ? what.replace('actualizado', 'actualizada').replace('registrado', 'registrada') : what, editing ? {} : {
        action: { label: 'Deshacer', fn: () => actions.remove('transactions', saved.id).then(() => toast('Movimiento deshecho')) },
      });
    } catch (e) {
      setErrors({ form: errorText(e) });
      setBusy(false);
    }
  }

  async function remove(close) {
    const ok = await confirmDialog({ title: '¿Eliminar este movimiento?', body: 'El saldo de la cuenta se recalcula al instante. No se puede deshacer.', confirm: 'Eliminar', tone: 'danger' });
    if (!ok) return;
    try { await actions.remove('transactions', tx.id); close(); toast('Movimiento eliminado'); } catch (e) { setErrors({ form: errorText(e) }); }
  }

  if (!active.length) {
    return html`<${Sheet} title="Nuevo movimiento" onClose=${onClose}>
      <div class="empty"><div class="empty-emoji">🏦</div><h3>Primero crea una cuenta</h3>
      <p>Todo movimiento sale o entra de una cuenta (efectivo, banco, Zelle…).</p>
      <button class="btn primary" onClick=${() => { onClose(); setTimeout(() => { location.hash = '#/cuentas?nueva=1'; }, 150); }}>Crear cuenta</button></div>
    <//>`;
  }

  const accountPicker = ({ value, onPick, exclude, error }) => html`<div>
    <div class="acc-picker" role="listbox">
      ${active.filter((a) => a.id !== exclude).map((a) => html`<button key=${a.id} type="button" role="option" aria-selected=${value === a.id}
        class=${'acc-pick' + (value === a.id ? ' on' : '')} onClick=${() => { onPick(a.id); setErrors({}); }} style=${{ '--acc': a.color || 'var(--blue)' }}>
        <span class="acc-pick-emoji">${a.icon || KINDS[a.kind]?.emoji || '💼'}</span>
        <span class="acc-pick-name">${a.name}</span>
        <${Money} v=${a.balance} c=${a.currency} class="acc-pick-bal" />
      </button>`)}
    </div>
    ${error && html`<span class="field-error">${error}</span>`}
  </div>`;

  return html`<${Sheet} title=${editing ? 'Editar movimiento' : 'Nuevo movimiento'} onClose=${onClose}
    footer=${(close) => html`<div class="foot-row">
      ${editing && html`<button type="button" class="btn ghost danger-text" onClick=${() => remove(close)}><${Icon} name="trash" size=${18} /></button>`}
      <button type="button" class=${'btn primary grow t-' + type} disabled=${busy} onClick=${(e) => submit(e, close)}>
        ${busy ? 'Guardando…' : editing ? 'Guardar cambios' : `Registrar ${TYPE_LABEL[type].toLowerCase()}`}
      </button>
    </div>`}>
    ${(close) => html`<form class="stack" onSubmit=${(e) => submit(e, close)}>
      <${Segmented} value=${type} onChange=${(v) => { setType(v); setCategory(''); setErrors({}); }} tone="types"
        options=${[['expense', 'Gasto', 't-expense'], ['income', 'Ingreso', 't-income'], ['transfer', 'Transferencia', 't-transfer']]} />

      ${!usingVes && html`<div class=${'amount-box t-' + type}>
        <span class="amount-cur">${CURRENCIES[cur]?.symbol}</span>
        <input class="amount-input num" inputmode="decimal" placeholder="0,00" autofocus=${!editing} aria-label="Monto"
          value=${amount} onInput=${(e) => { setAmount(e.target.value.replace(/[^\d.,]/g, '')); setErrors({}); }} />
        <span class="amount-code">${cur}</span>
      </div>`}
      ${errors.amount && html`<span class="field-error center">${errors.amount}</span>`}
      ${!usingVes && cur === 'VES' && finalAmount > 0 && rates.BCV_USD && html`<p class="hint center">
        ≈ ${fmt(finalAmount / rates.BCV_USD, 'USD')} a tasa BCV${rates.PARALELO ? ` · ${fmt(finalAmount / rates.PARALELO, 'USD')} a Paralelo` : ''}</p>`}

      <${Field} label=${type === 'transfer' ? 'Desde' : type === 'income' ? 'Entra a' : 'Sale de'}>
        ${accountPicker({ value: accountId, onPick: (id) => { setAccountId(id); if (id === toAccountId) setToAccountId(active.find((a) => a.id !== id)?.id || ''); }, error: errors.account })}
      <//>

      ${canPayVes && html`<div class=${'ves-card' + (payVes ? ' on' : '')}>
        <button type="button" class="ves-toggle" role="switch" aria-checked=${payVes} onClick=${() => setPayVes(!payVes)}>
          <span class="ves-flag">🇻🇪</span>
          <span><b>Pagué en bolívares</b><small>Calcula el costo real en ${cur} y la brecha</small></span>
          <span class=${'switch' + (payVes ? ' on' : '')}><i></i></span>
        </button>
        ${payVes && html`<div class="stack sm">
          <div class="grid2">
            <${Field} label="Monto en Bs." error=${errors.ves}>
              <input class="input num" inputmode="decimal" placeholder="3.600,00" value=${ves} onInput=${(e) => { setVes(e.target.value.replace(/[^\d.,]/g, '')); setErrors({}); }} />
            <//>
            <${Field} label=${`Tasa usada (Bs./${cur})`} error=${errors.rate}>
              ${rateMode === 'manual'
                ? html`<input class="input num" inputmode="decimal" placeholder="Ej. 250,00" value=${manualRate} onInput=${(e) => setManualRate(e.target.value.replace(/[^\d.,]/g, ''))} />`
                : html`<div class="input num readonly">${fmtRate(rateUsed)}</div>`}
            <//>
          </div>
          <${Segmented} value=${rateMode} onChange=${setRateMode} options=${rateOptions} />
          ${spread && html`<div class="spread">
            <div class="spread-row big"><span>Se debita de ${acc.name}</span><b class="num">${fmt(spread.realCost, cur)}</b></div>
            <div class="spread-row"><span>Precio a tasa BCV (${fmtRate(spread.bcv)})</span><span class="num">${fmt(spread.usdAtBcv, 'USD')}</span></div>
            <div class=${'spread-row verdict ' + (spread.diff >= 0 ? 'good' : 'bad')}>
              <span>${spread.diff >= 0 ? 'Te ahorraste por la brecha' : 'Perdiste en el cambio'}</span>
              <b class="num">${fmt(Math.abs(spread.diff), 'USD')} · ${fmtPct(Math.abs(spread.diffPct))}</b>
            </div>
            <p class="spread-note">${spread.diff >= 0
              ? `Pagaste Bs. ${fmtRate(vesNum)} con bolívares conseguidos a ${fmtRate(rateUsed)}: te costaron menos dólares que el precio oficial.`
              : `Cambiaste a ${fmtRate(rateUsed)}, por debajo del BCV: pagar en divisas te habría salido mejor.`}
              <${Learn} term="costoReal" label="¿Cómo se calcula?" /></p>
          </div>`}
        </div>`}
      </div>`}

      ${type === 'transfer' && html`<${Field} label="Hacia">
        ${accountPicker({ value: toAccountId, onPick: setToAccountId, exclude: accountId, error: errors.to })}
      <//>`}
      ${crossCurrency && html`<div class="card soft stack sm">
        <${Field} label=${`Llegó a ${toAcc.name} (${toAcc.currency})`} error=${errors.toAmount}
          hint=${suggestedTo ? `Sugerido con la tasa ${transferRate ? (transferRate.fx === 'USDT' ? 'USDT' : 'Paralelo') : 'del día'}: ${fmt(suggestedTo, toAcc.currency)}` : ''}>
          <input class="input num" inputmode="decimal" placeholder=${suggestedTo ? fmt(suggestedTo, toAcc.currency, { decimals: 2 }).replace(/^\S+\s/, '') : '0,00'}
            value=${toTouched ? toAmount : ''} onInput=${(e) => { setToTouched(Boolean(e.target.value)); setToAmount(e.target.value.replace(/[^\d.,]/g, '')); }} />
        <//>
        ${impliedRate && html`<p class="hint">Tasa de este cambio: <b class="num">${fmtRate(impliedRate)}</b> ${transferRate ? `Bs./${transferRate.fx}` : `${toAcc.currency}/${acc.currency}`}
          ${transferRate && rates.BCV_USD ? ` · BCV ${fmtRate(rates.BCV_USD)}` : ''}</p>`}
      </div>`}
      ${type === 'transfer' && html`<p class="hint">Mover dinero entre tus cuentas no cambia tu patrimonio. <${Learn} term="transferencia" label="Saber más" /></p>`}

      ${type !== 'transfer' && html`<${Field} label="Categoría" error=${errors.category}>
        <div class="cat-grid">
          ${cats.map((c) => html`<button key=${c.name} type="button" class=${'cat' + (category === c.name ? ' on' : '')}
            style=${{ '--cat': c.color }} onClick=${() => { setCategory(c.name); setErrors({}); }}>
            <span class="cat-emoji">${c.emoji}</span><span class="cat-name">${c.name}</span>
          </button>`)}
        </div>
      <//>`}
      ${budget && html`<div class="budget-hint">
        <span>Presupuesto de ${category}: <b class="num">${fmt(spentInCat, budget.currency)}</b> de <span class="num">${fmt(budget.monthly_limit, budget.currency)}</span> este mes</span>
        <div class=${'progress ' + (spentInCat / budget.monthly_limit >= 1 ? 'bad' : spentInCat / budget.monthly_limit >= 0.8 ? 'warn' : 'ok')}><i style=${{ width: Math.min(100, (spentInCat / budget.monthly_limit) * 100) + '%' }}></i></div>
      </div>`}

      <div class="grid2">
        <${Field} label="Descripción">
          <input class="input" placeholder=${type === 'income' ? 'Ej. Quincena' : 'Ej. Panadería'} maxlength="80" value=${description} onInput=${(e) => setDescription(e.target.value)} />
        <//>
        <${Field} label="Fecha">
          <input class="input" type="date" max=${todayISO()} value=${date} onInput=${(e) => setDate(e.target.value || todayISO())} />
        <//>
      </div>
      ${errors.form && html`<p class="form-error">${errors.form}</p>`}
      <button type="submit" hidden></button>
    </form>`}
  <//>`;
}
