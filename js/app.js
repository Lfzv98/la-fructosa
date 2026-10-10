import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { supabase } from './supabase.js';
import { api, isDemo } from './api.js';
import {
  CURRENCIES, RATE_LABELS, CATEGORIES, LIVE_RATE_KEYS, LIVE_RATES_NOTE,
  consolidate, convert, spreadCalc, marketRateFor, fmt, fmtRate,
} from './money.js';

const html = htm.bind(React.createElement);
// Fecha local de Venezuela, no UTC (a las 8 p.m. en Caracas ya es mañana en UTC).
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

// ---------------------------------------------------------------------
// UI básicos
// ---------------------------------------------------------------------
const card = 'rounded-2xl bg-white/85 dark:bg-azul-800/55 border border-azul-100 dark:border-azul-700 shadow-sm';
const accountCard = 'rounded-2xl bg-azul-100/90 dark:bg-azul-800/70 border border-azul-200 dark:border-azul-700 shadow-sm';
const rateCard = 'rounded-2xl bg-sol-100/90 dark:bg-sol-900/45 border border-sol-200/80 dark:border-sol-800 shadow-sm';
const input = 'w-full rounded-xl border border-azul-100 dark:border-azul-700 bg-white dark:bg-azul-900 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-salmon';
const btnPrimary = 'w-full rounded-xl bg-salmon text-azul-900 font-semibold py-3 active:scale-[.99] disabled:opacity-50 shadow-sm';
const currencyBadge = 'inline-flex items-center rounded-full bg-sol text-azul-900 text-[10px] font-bold px-2 py-0.5';

function Field({ label, children }) {
  return html`<label class="block space-y-1"><span class="text-sm opacity-70">${label}</span>${children}</label>`;
}

function Segmented({ value, onChange, options }) {
  return html`
    <div class="grid gap-1 p-1 rounded-xl bg-azul-50 dark:bg-azul-900" style=${{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      ${options.map(([v, label]) => html`
        <button key=${v} type="button" onClick=${() => onChange(v)}
          class=${'py-2 rounded-lg text-sm font-medium ' + (value === v ? 'bg-white dark:bg-azul-700 text-azul-900 dark:text-papel shadow' : 'opacity-60')}>
          ${label}
        </button>`)}
    </div>`;
}

function ErrorBox({ error }) {
  if (!error) return null;
  return html`<p class="text-sm text-salmon-800 dark:text-salmon-100 bg-salmon-100/80 dark:bg-salmon-900/50 rounded-lg p-2">${error.message ?? String(error)}</p>`;
}

// ---------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------
function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: name } },
        });
        if (error) throw error;
        if (!data.session) setNotice('Te enviamos un correo para confirmar tu cuenta.');
      }
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return html`
    <main class="min-h-screen safe-top px-6 flex flex-col justify-center max-w-sm mx-auto">
      <div class="text-center mb-8">
        <img src="./icons/icon-192.png" alt="" class="w-20 h-20 rounded-2xl mx-auto shadow" />
        <h1 class="text-3xl font-bold mt-4">La Fructosa</h1>
        <p class="opacity-70 mt-1">Tus cuentas, solo tuyas.</p>
      </div>
      <form onSubmit=${submit} class="space-y-4">
        <${Segmented} value=${mode} onChange=${setMode} options=${[['login', 'Entrar'], ['signup', 'Crear cuenta']]} />
        ${mode === 'signup' && html`
          <${Field} label="Nombre"><input class=${input} value=${name} onInput=${(e) => setName(e.target.value)} autocomplete="name" /><//>`}
        <${Field} label="Correo">
          <input class=${input} type="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="email" />
        <//>
        <${Field} label="Contraseña">
          <input class=${input} type="password" required minlength="8" value=${password}
            onInput=${(e) => setPassword(e.target.value)} autocomplete=${mode === 'login' ? 'current-password' : 'new-password'} />
        <//>
        <${ErrorBox} error=${error} />
        ${notice && html`<p class="text-sm bg-sol-100 text-azul-900 rounded-lg p-2">${notice}</p>`}
        <button class=${btnPrimary} disabled=${busy}>${busy ? '…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
    </main>`;
}

// ---------------------------------------------------------------------
// Inicio: saldo consolidado + cuentas
// ---------------------------------------------------------------------
const KIND_ICON = { cash: '💵', bank: '🏦', digital: '📲', crypto: '🪙' };

function Home({ profile, balances, rates, onAddAccount, onToggleCurrency, onRefreshRates, ratesBusy, ratesNote }) {
  const target = profile.preferred_currency;
  const { total, missing } = consolidate(balances, target, rates, profile.valuation_rate);
  return html`
    <section class="space-y-4">
      <div class="rounded-3xl bg-azul-200 dark:bg-azul-800 text-azul-900 dark:text-papel p-5 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-sm opacity-80">Saldo total</span>
          <button onClick=${onToggleCurrency} class=${currencyBadge + ' text-xs px-3 py-1'}>
            ${target} · ${RATE_LABELS[profile.valuation_rate]}
          </button>
        </div>
        <p class="text-4xl font-bold mt-2 tabular">${fmt(total, target)}</p>
        ${missing && html`<p class="text-xs mt-2 rounded-lg bg-sol-100 text-azul-900 px-2 py-1">Faltan tasas para convertir algunas cuentas.</p>`}
      </div>

      <${RatesStrip} rates=${rates} onRefresh=${onRefreshRates} busy=${ratesBusy} note=${ratesNote} />

      <div class="flex items-center justify-between pt-2">
        <h2 class="font-semibold">Cuentas</h2>
        <button onClick=${onAddAccount} class="text-sm font-semibold text-salmon-700 dark:text-salmon-200">+ Nueva</button>
      </div>
      ${balances.length === 0 && html`
        <div class=${card + ' p-5 text-center opacity-80'}>Crea tu primera cuenta: Efectivo USD, Zelle, Pago Móvil, Binance…</div>`}
      <ul class="space-y-2">
        ${balances.map((a) => html`
          <li key=${a.id} class=${accountCard + ' p-4 flex items-center gap-3'}>
            <span class="text-2xl">${KIND_ICON[a.kind] ?? '💼'}</span>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">${a.name}</p>
              <p class=${currencyBadge + ' mt-1'}>${a.currency}</p>
            </div>
            <div class="text-right">
              <p class="font-semibold tabular">${fmt(a.balance, a.currency)}</p>
              ${a.currency !== target && html`
                <p class="text-xs opacity-60 tabular">≈ ${fmt(convert(Number(a.balance), a.currency, target, rates, profile.valuation_rate), target)}</p>`}
            </div>
          </li>`)}
      </ul>
    </section>`;
}

function RatesStrip({ rates, onRefresh, busy, note }) {
  return html`
    <div class="space-y-2">
      <div class="grid grid-cols-3 gap-2 text-center">
        ${LIVE_RATE_KEYS.map((k) => html`
          <div key=${k} class=${rateCard + ' py-2 px-1'}>
            <p class="text-[10px] uppercase tracking-wide opacity-60">${RATE_LABELS[k].replace('Dólar ', '')}</p>
            <p class="text-sm font-semibold tabular">${rates[k] ? fmtRate(rates[k]) : '—'}</p>
          </div>`)}
      </div>
      <div class="flex items-center justify-between gap-2">
        <p class="text-[11px] text-azul-700 dark:text-sol-100">${note || ''}</p>
        <button type="button" onClick=${onRefresh} disabled=${busy}
          class="shrink-0 rounded-full bg-salmon text-azul-900 text-sm font-semibold px-3 py-1.5 disabled:opacity-50"
          aria-label="Actualizar tasas">
          ${busy ? '…' : '🔄'}
        </button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Nueva cuenta
// ---------------------------------------------------------------------
function NewAccount({ onDone, onCancel }) {
  const [form, setForm] = useState({ name: '', currency: 'USD', kind: 'cash', initial_balance: '' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createAccount({ ...form, initial_balance: Number(form.initial_balance || 0) });
      onDone();
    } catch (err) { setError(err); }
  }

  return html`
    <form onSubmit=${submit} class="space-y-4">
      <h2 class="text-xl font-bold">Nueva cuenta</h2>
      <${Field} label="Nombre"><input class=${input} required placeholder="Ej. Pago Móvil Bancamiga" value=${form.name} onInput=${set('name')} /><//>
      <${Field} label="Moneda">
        <${Segmented} value=${form.currency} onChange=${(v) => setForm({ ...form, currency: v })}
          options=${Object.keys(CURRENCIES).map((c) => [c, c])} />
      <//>
      <${Field} label="Tipo">
        <${Segmented} value=${form.kind} onChange=${(v) => setForm({ ...form, kind: v })}
          options=${[['cash', 'Efectivo'], ['bank', 'Banco'], ['digital', 'Digital'], ['crypto', 'Cripto']]} />
      <//>
      <${Field} label="Saldo inicial">
        <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any" value=${form.initial_balance} onInput=${set('initial_balance')} />
      <//>
      <${ErrorBox} error=${error} />
      <button class=${btnPrimary}>Guardar</button>
      <button type="button" onClick=${onCancel} class="w-full py-2 opacity-70">Cancelar</button>
    </form>`;
}

// ---------------------------------------------------------------------
// Nueva transacción + calculadora de brecha
// ---------------------------------------------------------------------
function NewTransaction({ balances, rates, onDone }) {
  const [type, setType] = useState('expense');
  const [accountId, setAccountId] = useState(balances[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(balances[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [paidInVes, setPaidInVes] = useState(false);
  const [vesAmount, setVesAmount] = useState('');
  const [rateApplied, setRateApplied] = useState('');
  const [category, setCategory] = useState(CATEGORIES.expense[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const account = balances.find((a) => a.id === accountId);
  const toAccount = balances.find((a) => a.id === toAccountId);
  const canPayInVes = type !== 'transfer' && account && account.currency !== 'VES';
  const usingVes = canPayInVes && paidInVes;

  useEffect(() => { setCategory(CATEGORIES[type][0]); }, [type]);
  useEffect(() => {
    if (account) setRateApplied(String(marketRateFor(account.currency, rates) ?? ''));
  }, [accountId, rates]);

  // Monto que se debita de la cuenta cuando se pagó en bolívares.
  const debit = usingVes ? Number(vesAmount) / Number(rateApplied) : Number(amount);
  const spread = usingVes ? spreadCalc(Number(vesAmount), rates, account.currency) : null;

  // Sugerencia de monto recibido en transferencias entre monedas distintas.
  const suggestedTo = type === 'transfer' && account && toAccount
    ? convert(Number(amount), account.currency, toAccount.currency, rates, 'PARALELO') : null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (!account) throw new Error('Primero crea una cuenta.');
      if (!(debit > 0)) throw new Error('Monto inválido.');
      const tx = { type, account_id: account.id, amount: Number(debit.toFixed(8)), category, description: description || null, occurred_on: date };
      if (type === 'transfer') {
        if (!toAccount || toAccount.id === account.id) throw new Error('Elige una cuenta destino distinta.');
        tx.to_account_id = toAccount.id;
        tx.to_amount = Number(toAmount || (toAccount.currency === account.currency ? amount : suggestedTo?.toFixed(8)));
      }
      if (usingVes) {
        Object.assign(tx, {
          original_amount: Number(vesAmount), original_currency: 'VES',
          rate_applied: Number(rateApplied), rate_bcv: rates.BCV_USD ?? null,
          rate_paralelo: marketRateFor(account.currency, rates) ?? null,
        });
      }
      await api.createTransaction(tx);
      onDone();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  if (balances.length === 0) {
    return html`<div class=${card + ' p-5 text-center'}>Crea una cuenta en Inicio para registrar movimientos.</div>`;
  }

  const accountOptions = balances.map((a) => html`<option key=${a.id} value=${a.id}>${a.name} · ${a.currency}</option>`);

  return html`
    <form onSubmit=${submit} class="space-y-4">
      <${Segmented} value=${type} onChange=${setType}
        options=${[['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia']]} />

      <${Field} label=${type === 'transfer' ? 'Desde' : 'Cuenta'}>
        <select class=${input} value=${accountId} onChange=${(e) => setAccountId(e.target.value)}>${accountOptions}</select>
      <//>

      ${canPayInVes && html`
        <label class="flex items-center gap-3 ${card} p-3">
          <input type="checkbox" class="w-5 h-5 accent-salmon" checked=${paidInVes} onChange=${(e) => setPaidInVes(e.target.checked)} />
          <span class="text-sm">${type === 'expense' ? 'Pagué' : 'Recibí'} en bolívares</span>
        </label>`}

      ${usingVes ? html`
        <div class="grid grid-cols-2 gap-3">
          <${Field} label="Monto en Bs.">
            <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any" required value=${vesAmount} onInput=${(e) => setVesAmount(e.target.value)} />
          <//>
          <${Field} label=${'Tasa usada (Bs./' + account.currency + ')'}>
            <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any" required value=${rateApplied} onInput=${(e) => setRateApplied(e.target.value)} />
          <//>
        </div>
        <${SpreadCard} spread=${spread} debit=${debit} currency=${account.currency} />
      ` : html`
        <${Field} label=${'Monto (' + (account?.currency ?? '') + ')'}>
          <input class=${input + ' text-2xl font-semibold tabular'} type="number" inputmode="decimal" step="any" required value=${amount} onInput=${(e) => setAmount(e.target.value)} />
        <//>`}

      ${type === 'transfer' && html`
        <${Field} label="Hacia">
          <select class=${input} value=${toAccountId} onChange=${(e) => setToAccountId(e.target.value)}>${accountOptions}</select>
        <//>
        ${toAccount && account && toAccount.currency !== account.currency && html`
          <${Field} label=${'Recibido (' + toAccount.currency + ')'}>
            <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any"
              placeholder=${suggestedTo ? suggestedTo.toFixed(2) + ' (a tasa paralelo)' : ''}
              value=${toAmount} onInput=${(e) => setToAmount(e.target.value)} />
          <//>`}`}

      <div class="flex flex-wrap gap-2">
        ${CATEGORIES[type].map((c) => html`
          <button key=${c} type="button" onClick=${() => setCategory(c)}
            class=${'px-3 py-1.5 rounded-full text-sm border ' + (category === c ? 'bg-salmon border-salmon text-azul-900 font-semibold' : 'border-azul-100 dark:border-azul-700')}>${c}</button>`)}
      </div>

      <div class="grid grid-cols-[1fr_auto] gap-3">
        <input class=${input} placeholder="Descripción (opcional)" value=${description} onInput=${(e) => setDescription(e.target.value)} />
        <input class=${input} type="date" value=${date} onInput=${(e) => setDate(e.target.value)} />
      </div>

      <${ErrorBox} error=${error} />
      <button class=${btnPrimary} disabled=${busy}>Guardar</button>
    </form>`;
}

function SpreadCard({ spread, debit, currency }) {
  if (!spread) return html`<p class="text-sm opacity-60">Escribe el monto en Bs. para ver la brecha.</p>`;
  const marketLabel = currency === 'USDT' ? 'USDT' : 'Paralelo';
  // Costo real (lo debitado) frente al precio en $ que el comercio cobró a tasa BCV.
  const vsBcv = debit - spread.usdAtBcv;
  const overpaid = vsBcv > 0.005;
  return html`
    <div class="${card} p-4 space-y-2 text-sm">
      <div class="flex justify-between"><span class="opacity-70">Costo real (se debita)</span><b class="tabular">${fmt(debit, currency)}</b></div>
      <div class="flex justify-between"><span class="opacity-70">Precio a tasa BCV (${fmtRate(spread.bcv)})</span><span class="tabular">${fmt(spread.usdAtBcv)}</span></div>
      <div class="flex justify-between"><span class="opacity-70">Precio a tasa ${marketLabel} (${fmtRate(spread.market)})</span><span class="tabular">${fmt(spread.usdAtMarket)}</span></div>
      <div class="flex justify-between"><span class="opacity-70">Brecha cambiaria</span>
        <span class="tabular">${fmt(Math.abs(spread.spread))} (${Math.abs(spread.spreadPct).toFixed(1)}%)</span></div>
      <div class=${'flex justify-between rounded-lg px-2 py-1 ' + (overpaid ? 'bg-salmon-100 text-salmon-800 dark:bg-salmon-900/50 dark:text-salmon-100' : 'bg-azul-50 dark:bg-azul-900')}>
        <span>${overpaid ? 'Pagaste de más vs. BCV' : 'Ahorro vs. precio BCV'}</span>
        <b class="tabular">${fmt(Math.abs(vsBcv), currency)}</b>
      </div>
      <p class="text-xs opacity-60">Brecha entre tasas BCV y ${marketLabel}: ${spread.gapPct.toFixed(1)}%</p>
    </div>`;
}

// ---------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------
function Movements({ txs }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const t of txs) { if (!m.has(t.occurred_on)) m.set(t.occurred_on, []); m.get(t.occurred_on).push(t); }
    return [...m.entries()];
  }, [txs]);
  if (txs.length === 0) return html`<div class=${card + ' p-5 text-center opacity-80'}>Aún no hay movimientos.</div>`;
  return html`
    <section class="space-y-4">
      ${groups.map(([day, list]) => html`
        <div key=${day}>
          <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">${new Date(day + 'T12:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
          <ul class=${card + ' divide-y divide-azul-100 dark:divide-azul-800 overflow-hidden'}>
            ${list.map((t) => html`
              <li key=${t.id} class=${'p-3 flex items-center gap-3 ' + (t.type === 'expense' ? 'bg-salmon-50/80 dark:bg-salmon-900/25' : '')}>
                <span class="text-xl">${t.type === 'income' ? '⬇️' : t.type === 'expense' ? '⬆️' : '🔁'}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">${t.description || t.category}</p>
                  <p class="text-xs opacity-60 truncate">
                    ${t.account?.name}${t.to_account ? ' → ' + t.to_account.name : ''}
                    ${t.original_currency === 'VES' ? ` · ${fmt(t.original_amount, 'VES')}` : ''}
                  </p>
                </div>
                <div class="text-right">
                  <p class=${'font-semibold tabular ' + (t.type === 'income' ? 'text-azul-600 dark:text-azul-200' : t.type === 'expense' ? 'text-salmon-700 dark:text-salmon-200' : '')}>
                    ${t.type === 'income' ? '+' : '−'}${fmt(t.amount, t.account?.currency)}
                  </p>
                  ${t.spread_usd != null && html`<p class="text-[11px] opacity-60 tabular">brecha ${fmt(Math.abs(t.spread_usd))}</p>`}
                </div>
              </li>`)}
          </ul>
        </div>`)}
    </section>`;
}

// ---------------------------------------------------------------------
// Tasas + calculadora rápida
// ---------------------------------------------------------------------
function Rates({ rows, rates, onRefresh, busy, note, error }) {
  const [ves, setVes] = useState('');
  const market = rates.USDT ?? rates.PARALELO;
  const gap = rates.BCV_USD && market ? ((market - rates.BCV_USD) / rates.BCV_USD) * 100 : null;
  return html`
    <section class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-azul-700 dark:text-sol-100">${note || 'Tasas BCV y USDT Binance P2P'}</p>
        <button type="button" onClick=${onRefresh} disabled=${busy}
          class="shrink-0 rounded-full bg-salmon text-azul-900 text-sm font-semibold px-3 py-1.5 disabled:opacity-50">
          ${busy ? 'Actualizando…' : '🔄 Actualizar'}
        </button>
      </div>
      ${error && html`<${ErrorBox} error=${error} />`}
      <div class="grid grid-cols-1 gap-3">
        ${LIVE_RATE_KEYS.map((k) => {
          const r = rows.find((x) => x.rate_type === k);
          return html`
            <div key=${k} class=${rateCard + ' p-4'}>
              <p class="text-xs opacity-60">${RATE_LABELS[k]}</p>
              <p class="text-2xl font-bold tabular">${r ? fmtRate(r.rate) : '—'}</p>
              <p class="text-[11px] opacity-50">${r ? `${r.rate_date} · ${r.source ?? ''}` : 'sin datos'}</p>
            </div>`;
        })}
      </div>
      ${gap != null && html`
        <div class="rounded-2xl bg-sol-100 text-azul-900 p-4">
          <p class="text-sm">Brecha BCV vs. USDT Binance</p>
          <p class="text-3xl font-bold tabular">${gap.toFixed(1)}%</p>
        </div>`}
      <div class=${card + ' p-4 space-y-3'}>
        <h3 class="font-semibold">Calculadora</h3>
        <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any" placeholder="Monto en Bs." value=${ves} onInput=${(e) => setVes(e.target.value)} />
        ${Number(ves) > 0 && html`
          <ul class="text-sm space-y-1">
            ${LIVE_RATE_KEYS.filter((k) => rates[k]).map((k) => html`
              <li key=${k} class="flex justify-between"><span class="opacity-70">${RATE_LABELS[k]}</span>
                <b class="tabular">${fmt(Number(ves) / rates[k], k === 'USDT' ? 'USDT' : k === 'BCV_EUR' ? 'EUR' : 'USD')}</b></li>`)}
          </ul>`}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------
function Settings({ profile, onSave }) {
  return html`
    <section class="space-y-4">
      <div class=${card + ' p-4 space-y-4'}>
        <${Field} label="Moneda para el saldo total">
          <${Segmented} value=${profile.preferred_currency} onChange=${(v) => onSave({ preferred_currency: v })}
            options=${[['USD', 'Dólares'], ['VES', 'Bolívares']]} />
        <//>
        <${Field} label="Valorar dólares a tasa">
          <${Segmented} value=${profile.valuation_rate} onChange=${(v) => onSave({ valuation_rate: v })}
            options=${[['BCV_USD', 'BCV'], ['PARALELO', 'USDT']]} />
        <//>
      </div>
      ${!isDemo && html`
        <button class="w-full rounded-xl border border-salmon-600 text-salmon-700 dark:text-salmon-200 dark:border-salmon-300 py-3 font-semibold"
          onClick=${() => supabase.auth.signOut()}>Cerrar sesión</button>`}
    </section>`;
}

// ---------------------------------------------------------------------
// Shell con navegación inferior
// ---------------------------------------------------------------------
const TABS = [
  ['home', 'Inicio', '🏠'],
  ['movs', 'Movimientos', '📒'],
  ['new', 'Nuevo', '➕'],
  ['rates', 'Tasas', '📈'],
  ['settings', 'Ajustes', '⚙️'],
];

function MainApp() {
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balances, setBalances] = useState([]);
  const [txs, setTxs] = useState([]);
  const [rates, setRates] = useState({});
  const [rateRows, setRateRows] = useState([]);
  const [ratesBusy, setRatesBusy] = useState(false);
  const [ratesNote, setRatesNote] = useState('');
  const [ratesError, setRatesError] = useState(null);
  const [error, setError] = useState(null);

  const applyLiveRates = useCallback(async () => {
    setRatesBusy(true); setRatesError(null);
    try {
      const live = await api.refreshRates();
      setRates(live.rates);
      setRateRows(live.rows);
      setRatesNote(live.sourceNote || LIVE_RATES_NOTE);
    } catch (err) {
      setRatesError(err);
      try {
        const [r, rr] = await Promise.all([api.latestRates(), api.latestRateRows()]);
        setRates(r); setRateRows(rr);
      } catch { /* se mantienen las últimas tasas en pantalla */ }
    } finally {
      setRatesBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [p, b, t] = await Promise.all([
        api.getProfile(), api.listBalances(), api.listTransactions(),
      ]);
      setProfile(p); setBalances(b); setTxs(t);
      await applyLiveRates();
    } catch (err) { setError(err); }
  }, [applyLiveRates]);
  useEffect(() => { load(); }, [load]);

  async function saveProfile(patch) {
    setProfile(await api.updateProfile(patch));
  }

  if (error) return html`<main class="p-6"><${ErrorBox} error=${error} /></main>`;
  if (!profile) return html`<main class="min-h-screen grid place-items-center opacity-60">Cargando…</main>`;

  const title = TABS.find(([k]) => k === tab)[1];

  return html`
    <div class="min-h-screen flex flex-col max-w-md mx-auto">
      <header class="safe-top px-5 pt-4 pb-2 flex items-end justify-between">
        <div>
          <p class="text-xs opacity-60">${tab === 'home' ? `Hola, ${profile.display_name ?? ''}` : 'La Fructosa'}</p>
          <h1 class="text-2xl font-bold">${tab === 'home' ? 'La Fructosa' : title}</h1>
        </div>
        ${isDemo && html`<span class="text-[10px] font-bold uppercase bg-sol text-azul-900 rounded-full px-2 py-1">Demo</span>`}
      </header>

      <main class="flex-1 px-5 pb-28 pt-2">
        ${tab === 'home' && html`<${Home} profile=${profile} balances=${balances} rates=${rates}
          onAddAccount=${() => setSheet('account')}
          onToggleCurrency=${() => saveProfile({ preferred_currency: profile.preferred_currency === 'USD' ? 'VES' : 'USD' })}
          onRefreshRates=${applyLiveRates} ratesBusy=${ratesBusy} ratesNote=${ratesNote} />`}
        ${tab === 'movs' && html`<${Movements} txs=${txs} />`}
        ${tab === 'new' && html`<${NewTransaction} balances=${balances} rates=${rates} onDone=${() => { load(); setTab('movs'); }} />`}
        ${tab === 'rates' && html`<${Rates} rows=${rateRows} rates=${rates} onRefresh=${applyLiveRates}
          busy=${ratesBusy} note=${ratesNote} error=${ratesError} />`}
        ${tab === 'settings' && html`<${Settings} profile=${profile} onSave=${saveProfile} />`}
      </main>

      <nav class="fixed bottom-0 inset-x-0 safe-bottom bg-azul-50/95 dark:bg-azul-900/95 backdrop-blur border-t border-azul-100 dark:border-azul-800">
        <ul class="max-w-md mx-auto grid grid-cols-5">
          ${TABS.map(([k, label, icon]) => html`
            <li key=${k}>
              <button onClick=${() => setTab(k)} class=${'w-full pt-2 pb-1 flex flex-col items-center text-[11px] ' + (tab === k ? 'font-semibold text-azul-700 dark:text-azul-200' : 'opacity-50')}>
                <span class=${k === 'new' ? 'text-xl grid place-items-center w-10 h-10 -mt-1 rounded-full bg-salmon text-azul-900' : 'text-xl'}>${icon}</span>
                ${label}
              </button>
            </li>`)}
        </ul>
      </nav>

      ${sheet === 'account' && html`
        <div class="fixed inset-0 z-20 bg-black/40 flex items-end" onClick=${() => setSheet(null)}>
          <div class="w-full max-w-md mx-auto bg-papel dark:bg-azul-900 rounded-t-3xl p-5 safe-bottom" onClick=${(e) => e.stopPropagation()}>
            <${NewAccount} onCancel=${() => setSheet(null)} onDone=${() => { setSheet(null); load(); }} />
          </div>
        </div>`}
    </div>`;
}

function App() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    if (isDemo) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (isDemo) return html`<${MainApp} />`;
  if (session === undefined) return html`<main class="min-h-screen grid place-items-center opacity-60">Cargando…</main>`;
  return session ? html`<${MainApp} key=${session.user.id} />` : html`<${AuthScreen} />`;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
