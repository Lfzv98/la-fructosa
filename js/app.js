import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { supabase } from './supabase.js';
import { api, isDemo } from './api.js';
import {
  CURRENCIES, RATE_LABELS, CATEGORIES, LIVE_RATE_KEYS, LIVE_RATES_NOTE,
  ACCOUNT_PRESETS, accountIcon, presetForAccount, REGIONS, regionOf,
  presetsForRegion, currenciesForRegion, patchForRegion, normalizeProfile,
  consolidate, convert, balanceBreakdown, spreadCalc, marketRateFor, fmt, fmtRate,
  monthBounds, yearBounds, spentInCategory, budgetTone, recurringStatus,
  transactionsToCsv, downloadCsv, txDay,
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

// Mensajes de formulario en español claro (nunca textos técnicos de la API).
function friendlyError(error) {
  const raw = String(error?.message ?? error ?? '').toLowerCase();
  if (raw.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (raw.includes('already registered') || raw.includes('already been registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (raw.includes('email not confirmed')) return 'Confirma tu correo antes de entrar.';
  if (raw.includes('password') && raw.includes('least')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (raw.includes('rate limit') || raw.includes('too many')) return 'Demasiados intentos. Espera un momento.';
  if (raw.includes('failed to fetch') || raw.includes('network')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  if (error?.message && !/[{}]|pgrst|schema cache|relationship|column/i.test(error.message)) return error.message;
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
}

function ErrorBox({ error }) {
  if (!error) return null;
  return html`<p class="form-note" role="alert">${friendlyError(error)}</p>`;
}

// Acciones secundarias: un fallo se registra en consola y nunca rompe la UI.
const quietly = (fn) => async (...args) => {
  try { await fn(...args); } catch (err) { console.warn(err?.message || err); }
};

function calcFormat(n) {
  if (!Number.isFinite(n)) return '0';
  const s = String(Number(n.toPrecision(12)));
  return s;
}

function Calculator({ onClose }) {
  const [expr, setExpr] = useState('0');
  const [acc, setAcc] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(false);
  const [copied, setCopied] = useState(false);

  const value = () => Number(expr) || 0;
  const apply = (a, operator, b) => {
    if (operator === '+') return a + b;
    if (operator === '−') return a - b;
    if (operator === '×') return a * b;
    if (operator === '÷') return b === 0 ? a : a / b;
    return b;
  };

  function digit(d) {
    setCopied(false);
    if (fresh || expr === '0') {
      setExpr(d === '.' ? '0.' : d);
      setFresh(false);
      return;
    }
    if (d === '.' && expr.includes('.')) return;
    setExpr(expr + d);
  }

  function operate(next) {
    const n = value();
    if (op && !fresh) {
      const r = apply(acc ?? n, op, n);
      setAcc(r);
      setExpr(calcFormat(r));
    } else setAcc(n);
    setOp(next);
    setFresh(true);
    setCopied(false);
  }

  function equals() {
    if (!op) return;
    const r = apply(acc ?? 0, op, value());
    setExpr(calcFormat(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
    setCopied(false);
  }

  async function copy() {
    const text = expr;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
  }

  const keys = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  function press(k) {
    if (k === 'C') { setExpr('0'); setAcc(null); setOp(null); setFresh(false); setCopied(false); return; }
    if (k === '⌫') {
      if (fresh || expr.length <= 1) setExpr('0');
      else setExpr(expr.slice(0, -1));
      return;
    }
    if (k === '%') { setExpr(calcFormat(value() / 100)); setFresh(true); return; }
    if (k === '=') { equals(); return; }
    if ('+−×÷'.includes(k)) { operate(k); return; }
    digit(k);
  }

  return html`
    <div class="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center px-4" onClick=${onClose}>
      <div class=${card + ' w-full max-w-sm p-4 mb-24 sm:mb-0 safe-bottom'} onClick=${(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold">🧮 Calculadora</h2>
          <button type="button" class="w-10 h-10 rounded-full bg-azul-50 dark:bg-azul-900" onClick=${onClose} aria-label="Cerrar">✕</button>
        </div>
        <p class="rounded-2xl bg-sol-100/80 dark:bg-sol-900/40 text-right text-3xl font-bold tabular px-4 py-3 mb-3 overflow-x-auto">${expr}</p>
        <div class="grid grid-cols-4 gap-2">
          ${keys.flatMap((row) => row.map((k) => html`
            <button key=${k} type="button" onClick=${() => press(k)}
              class=${'min-h-[48px] rounded-2xl font-semibold text-lg active:scale-[.98] ' + (k === '0' ? 'col-span-2 ' : '') + ('+−×÷='.includes(k) ? 'bg-salmon text-azul-900' : k === 'C' || k === '⌫' || k === '%' ? 'bg-azul-100 dark:bg-azul-900' : 'bg-white dark:bg-azul-900 border border-azul-100 dark:border-azul-700')}>
              ${k}
            </button>`))}
        </div>
        <button type="button" class=${btnPrimary + ' mt-3'} onClick=${copy}>
          ${copied ? 'Copiado' : 'Copiar resultado'}
        </button>
      </div>
    </div>`;
}

function RegionPicker({ value, onChange }) {
  return html`
    <div class="space-y-2">
      ${Object.values(REGIONS).map((r) => html`
        <button key=${r.id} type="button" onClick=${() => onChange(r.id)}
          class=${'w-full text-left rounded-2xl border px-4 py-3 flex items-start gap-3 min-h-[56px] ' + (value === r.id ? 'border-salmon bg-salmon/20' : 'border-azul-100 dark:border-azul-700')}>
          <span class="text-2xl" aria-hidden="true">${r.flag}</span>
          <div class="min-w-0">
            <p class="font-semibold text-sm">${r.label}</p>
            <p class="text-xs opacity-60">${r.hint}</p>
          </div>
        </button>`)}
    </div>`;
}

// ---------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------
function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const canSubmit = Boolean(region) && !busy && email && password && (mode === 'login' || name.trim());

  async function persistProfile(id, displayName) {
    const patch = { ...patchForRegion(id) };
    if (displayName) patch.display_name = displayName;
    try { await api.updateProfile(patch); } catch { /* el trigger de alta ya guardó la región */ }
  }

  async function submit(e) {
    e.preventDefault();
    if (!region) {
      setError(new Error('Elige tu región y moneda base para continuar.'));
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await persistProfile(region);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: name.trim(), region } },
        });
        if (error) throw error;
        if (data.session) await persistProfile(region, name.trim());
        else setNotice('Te enviamos un correo para confirmar tu cuenta.');
      }
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  const regionBlock = html`
    <div class="space-y-2">
      <p class="auth-label text-sm font-medium">Región y moneda base <span class="auth-required">*</span></p>
      <div class="space-y-2" role="radiogroup" aria-label="Región y moneda base">
        ${Object.values(REGIONS).map((r) => html`
          <button key=${r.id} type="button" role="radio" aria-checked=${region === r.id}
            class="auth-region" onClick=${() => { setRegion(r.id); setError(null); }}>
            <span class="text-xl leading-none" aria-hidden="true">${r.flag}</span>
            <span>${r.cover}</span>
          </button>`)}
      </div>
    </div>`;

  return html`
    <main class="auth-page safe-top safe-bottom px-5 flex flex-col justify-center">
      <div class="w-full max-w-sm mx-auto">
        <header class="auth-brand">
          <img src="./icons/icon-192.png" alt="La Fructosa" class="w-16 h-16 rounded-2xl mx-auto shadow-sm" />
          <h1>La Fructosa</h1>
          <p>Finanzas Personales</p>
        </header>

        <form onSubmit=${submit} class="auth-card space-y-4">
          <div class="auth-tabs" role="tablist" aria-label="Acceso">
            <button type="button" role="tab" class="auth-tab" aria-selected=${mode === 'login'}
              onClick=${() => { setMode('login'); setError(null); setNotice(null); }}>Iniciar Sesión</button>
            <button type="button" role="tab" class="auth-tab" aria-selected=${mode === 'signup'}
              onClick=${() => { setMode('signup'); setError(null); setNotice(null); }}>Crear Cuenta</button>
          </div>

          ${mode === 'signup' && html`
            <label class="block space-y-1">
              <span class="text-sm font-medium">Nombre completo</span>
              <input class="auth-input" required value=${name} onInput=${(e) => setName(e.target.value)}
                autocomplete="name" name="name" placeholder="Inserta tu nombre aquí" />
            </label>`}

          ${regionBlock}

          <label class="block space-y-1">
            <span class="text-sm font-medium">Correo electrónico</span>
            <input class="auth-input" type="email" required name="email" value=${email} placeholder="tu@correo.com"
              onInput=${(e) => setEmail(e.target.value)} autocomplete="email" />
          </label>

          <label class="block space-y-1">
            <span class="text-sm font-medium">Contraseña</span>
            <div class="relative">
              <input class="auth-input auth-input-pass" type=${showPass ? 'text' : 'password'} required minlength="8"
                name=${mode === 'login' ? 'password' : 'new-password'} value=${password} placeholder="Mínimo 8 caracteres"
                onInput=${(e) => setPassword(e.target.value)}
                autocomplete=${mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" class="auth-eye" onClick=${() => setShowPass((v) => !v)}
                aria-label=${showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                ${showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          <${ErrorBox} error=${error} />
          ${notice && html`<p class="auth-notice">${notice}</p>`}

          <button class="auth-submit" disabled=${!canSubmit}>
            ${busy ? '…' : mode === 'login' ? 'Entrar' : 'Registrarse'}
          </button>
        </form>
      </div>
    </main>`;
}

// ---------------------------------------------------------------------
// Inicio: saldo consolidado + cuentas
// ---------------------------------------------------------------------
function greetName(profile) {
  const raw = String(profile?.display_name || '').trim();
  if (!raw || /^la\s*fructosa$/i.test(raw)) return '';
  const n = raw.includes('@') ? raw.split('@')[0] : raw.split(/\s+/)[0];
  return n;
}

function Home({ profile, balances, rates, onAddAccount, onEditAccount, onToggleCurrency, onRefreshRates, ratesBusy, ratesNote }) {
  const target = profile.preferred_currency;
  const valuation = profile.valuation_rate;
  const zone = regionOf(profile);
  const { total, missing } = consolidate(balances, target, rates, valuation);
  const parts = balanceBreakdown(balances, target, rates, valuation);
  const market = rates.USDT ?? rates.PARALELO;
  const gapText = rates.BCV_USD && market
    ? `Brecha BCV vs. USDT: ${(((market - rates.BCV_USD) / rates.BCV_USD) * 100).toFixed(1)} %`
    : '';
  const subtitle = zone.showRates
    ? `Convertido a tasa ${RATE_LABELS[valuation]} del día`
    : `Expresado en ${CURRENCIES[target]?.label ?? target}`;
  return html`
    <section class="space-y-5">
      <div class="dash-balance">
        <div class="flex items-center justify-between gap-3">
          <span class="dash-balance-label">Saldo total en ${target}</span>
          <button type="button" onClick=${zone.showRates ? onToggleCurrency : undefined}
            class=${currencyBadge + ' text-xs px-3 py-1'}>
            ${zone.flag} ${target}${zone.showRates ? ` · ${RATE_LABELS[valuation]}` : ''}
          </button>
        </div>
        <p class="dash-balance-amount tabular">${fmt(total, target)}</p>
        <p class="dash-balance-note">${subtitle}</p>
        ${parts.length > 0 && html`
          <ul class="mt-3 space-y-1 text-xs" style=${{ color: '#2C528A' }}>
            ${parts.map((p) => html`
              <li key=${p.currency} class="flex justify-between gap-2 tabular">
                <span>${p.currency} ${fmt(p.native, p.currency)}</span>
                <span>${p.currency === target ? 'en tu moneda' : p.missing ? 'sin tasa' : `≈ ${fmt(p.converted, target)}`}</span>
              </li>`)}
          </ul>`}
        ${missing && html`<p class="text-xs mt-2 rounded-lg px-2 py-1" style=${{ background: '#FEFCBF', color: '#152033' }}>Faltan tasas para convertir algunas cuentas.</p>`}
        ${zone.showRates && html`
          <div class="dash-rates">
            ${LIVE_RATE_KEYS.map((k) => html`
              <button key=${k} type="button" class="dash-rate" onClick=${onRefreshRates} disabled=${ratesBusy}>
                <p>${RATE_LABELS[k]}</p>
                <p class="tabular">${rates[k] ? fmtRate(rates[k]) : '—'}</p>
              </button>`)}
          </div>`}
        ${zone.showRates && html`
          <div class="flex items-center justify-between gap-2 mt-2">
            <p class="dash-balance-note">${gapText || ratesNote || LIVE_RATES_NOTE}</p>
            <button type="button" onClick=${onRefreshRates} disabled=${ratesBusy}
              class="rounded-full text-xs font-semibold px-3 py-1.5" style=${{ background: '#FFADAD', color: '#152033' }}
              aria-label="Actualizar tasas">${ratesBusy ? '…' : '🔄'}</button>
          </div>`}
      </div>

      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-papel">Cuentas</h2>
        <button type="button" onClick=${onAddAccount} class="text-sm font-semibold" style=${{ color: '#FFADAD' }}>+ Nueva cuenta</button>
      </div>
      ${balances.length === 0 && html`
        <div class="dash-empty w-full">
          <p class="text-2xl" aria-hidden="true">💳</p>
          <h3>Crea tu primera cuenta</h3>
          <p>Zelle, PayPal, Wise, Efectivo, Wire o Pago Móvil.</p>
          <button type="button" onClick=${onAddAccount} class="dash-empty-cta">+ Nueva cuenta</button>
        </div>`}
      <ul class="space-y-2">
        ${balances.map((a) => html`
          <li key=${a.id}>
            <button type="button" onClick=${() => onEditAccount(a)} class="dash-account">
              <span class="text-2xl">${accountIcon(a)}</span>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">${a.name}</p>
                <p class=${currencyBadge + ' mt-1'}>${a.currency}</p>
              </div>
              <div class="text-right">
                <p class="font-semibold tabular">${fmt(a.balance, a.currency)}</p>
                ${a.currency !== target && html`
                  <p class="text-xs opacity-70 tabular">${convert(Number(a.balance), a.currency, target, rates, valuation) == null
                    ? 'sin tasa'
                    : `≈ ${fmt(convert(Number(a.balance), a.currency, target, rates, valuation), target)}`}</p>`}
              </div>
            </button>
          </li>`)}
      </ul>
    </section>`;
}

// ---------------------------------------------------------------------
// Nueva cuenta
// ---------------------------------------------------------------------
function AccountForm({ account, onDone, onCancel, region = 'VE' }) {
  const editing = Boolean(account);
  const visible = presetsForRegion(region, account);
  const current = presetForAccount(account);
  const start = visible.find((p) => p.id === current.id) ?? visible[0] ?? current;
  const [presetId, setPresetId] = useState(start.id);
  const [form, setForm] = useState({
    name: account?.name ?? start.names[0] ?? '',
    currency: account?.currency ?? currenciesForRegion(region, start.currencies, start.id)[0],
    kind: account?.kind ?? start.kind,
    icon: account?.icon ?? start.icon,
    initial_balance: '',
  });
  const [error, setError] = useState(null);
  const preset = ACCOUNT_PRESETS.find((p) => p.id === presetId) ?? start;
  const currencyOptions = currenciesForRegion(region, preset.currencies, preset.id);

  function applyPreset(next) {
    setPresetId(next.id);
    const allowed = currenciesForRegion(region, next.currencies, next.id);
    const currency = allowed.includes(form.currency) ? form.currency : allowed[0];
    setForm({
      ...form,
      kind: next.kind,
      icon: next.icon,
      currency,
      name: next.id === 'custom' ? form.name : (next.names.includes(form.name) ? form.name : (next.names[0] ?? '')),
    });
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const payload = { name: form.name.trim(), currency: form.currency, kind: form.kind, icon: form.icon };
      if (!payload.name) throw new Error('Escribe un nombre para la cuenta.');
      if (editing) await api.updateAccount(account.id, payload);
      else await api.createAccount({ ...payload, initial_balance: Number(form.initial_balance || 0) });
      onDone();
    } catch (err) { setError(err); }
  }

  return html`
    <form onSubmit=${submit} class="space-y-4">
      <h2 class="text-xl font-bold">${editing ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
      <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-0.5">
        ${visible.map((p) => html`
          <button key=${p.id} type="button" onClick=${() => applyPreset(p)}
            class=${'text-left rounded-2xl border px-3 py-2 ' + (presetId === p.id ? 'border-salmon bg-salmon/20' : 'border-azul-100 dark:border-azul-700')}>
            <p class="font-medium text-sm">${p.icon} ${p.label}</p>
            <p class="text-[11px] opacity-60">${p.hint}</p>
          </button>`)}
      </div>
      ${preset.names.length > 1 && html`
        <div class="flex flex-wrap gap-2">
          ${preset.names.map((n) => html`
            <button key=${n} type="button" onClick=${() => setForm({ ...form, name: n })}
              class=${'px-3 py-1.5 rounded-full text-sm border ' + (form.name === n ? 'bg-sol border-sol text-azul-900 font-semibold' : 'border-azul-100 dark:border-azul-700')}>${n}</button>`)}
        </div>`}
      <${Field} label="Nombre">
        <input class=${input} required maxlength="60" placeholder=${preset.names[0] || 'Ej. Pago Móvil Bancamiga'}
          value=${form.name} onInput=${(e) => setForm({ ...form, name: e.target.value })} />
      <//>
      <${Field} label="Moneda">
        <${Segmented} value=${form.currency} onChange=${(v) => setForm({ ...form, currency: v })}
          options=${currencyOptions.map((c) => [c, c])} />
      <//>
      ${preset.id === 'custom' && html`
        <${Field} label="Tipo">
          <${Segmented} value=${form.kind} onChange=${(v) => setForm({ ...form, kind: v, icon: accountIcon({ kind: v }) })}
            options=${[['cash', 'Efectivo'], ['bank', 'Banco'], ['digital', 'Digital'], ['crypto', 'Cripto']]} />
        <//>`}
      ${editing
        ? html`<p class="text-sm opacity-70">Saldo actual: <b class="tabular">${fmt(account.balance, account.currency)}</b></p>`
        : html`<${Field} label="Saldo inicial">
            <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any" value=${form.initial_balance}
              onInput=${(e) => setForm({ ...form, initial_balance: e.target.value })} />
          <//>`}
      <${ErrorBox} error=${error} />
      <button class=${btnPrimary}>${editing ? 'Guardar cambios' : 'Crear cuenta'}</button>
      <button type="button" onClick=${onCancel} class="w-full py-2 opacity-70">Cancelar</button>
    </form>`;
}

function AccountPicker({ label, balances, value, onChange, excludeId }) {
  const list = balances.filter((a) => a.id !== excludeId);
  return html`
    <div class="block space-y-1">
      <span class="text-sm opacity-70">${label}</span>
      <div class="space-y-2 max-h-56 overflow-y-auto">
        ${list.map((a) => html`
          <button key=${a.id} type="button" onClick=${() => onChange(a.id)}
            class=${'w-full text-left p-3 rounded-xl border flex items-center gap-3 ' + (value === a.id ? 'border-salmon bg-salmon/20' : 'border-azul-100 dark:border-azul-700')}>
            <span class="text-xl">${accountIcon(a)}</span>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">${a.name}</p>
              <p class="text-xs opacity-60">${a.currency} · ${fmt(a.balance, a.currency)}</p>
            </div>
          </button>`)}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Nueva transacción + calculadora de brecha
// ---------------------------------------------------------------------
function NewTransaction({ balances, rates, onDone, profile }) {
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
  const canPayInVes = regionOf(profile).showRates && type !== 'transfer' && account && account.currency !== 'VES';
  const usingVes = canPayInVes && paidInVes;

  useEffect(() => { setCategory(CATEGORIES[type][0]); }, [type]);
  useEffect(() => {
    if (account) setRateApplied(String(marketRateFor(account.currency, rates) ?? ''));
  }, [accountId, rates]);
  useEffect(() => {
    if (type === 'transfer' && toAccountId === accountId) {
      const other = balances.find((a) => a.id !== accountId);
      if (other) setToAccountId(other.id);
    }
  }, [accountId, type, toAccountId, balances]);

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

  const actionHint = !account ? ''
    : type === 'income' ? `El ingreso se registrará en ${account.name} · ${account.currency}`
    : type === 'expense' ? `El gasto se descontará de ${account.name} · ${account.currency}`
    : `Sale de ${account.name} · ${account.currency}`;

  return html`
    <form onSubmit=${submit} class="space-y-4">
      <${Segmented} value=${type} onChange=${setType}
        options=${[['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia']]} />

      <${AccountPicker} label=${type === 'transfer' ? 'Cuenta de origen' : 'Cuenta'}
        balances=${balances} value=${accountId} onChange=${setAccountId} />
      ${account && html`<p class="text-xs opacity-60">${actionHint}</p>`}

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
        <${AccountPicker} label="Cuenta de destino" balances=${balances} value=${toAccountId}
          onChange=${setToAccountId} excludeId=${accountId} />
        ${toAccount && html`<p class="text-xs opacity-60">Llega a ${toAccount.name} · ${toAccount.currency}</p>`}
        ${toAccount && account && toAccount.currency !== account.currency && html`
          <${Field} label=${'Recibido (' + toAccount.currency + ')'}>
            <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any"
              placeholder=${suggestedTo ? suggestedTo.toFixed(2) + ' (a tasa USDT)' : ''}
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
// Periodos
// ---------------------------------------------------------------------
const TX_LABEL = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };

function periodRange(period) {
  if (period === 'prev') return monthBounds(-1);
  if (period === 'year') return yearBounds();
  return monthBounds(0);
}

// ---------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------
const TYPE_FILTERS = [['all', 'Todos'], ['income', 'Ingresos'], ['expense', 'Gastos'], ['transfer', 'Transf.']];

function Movements({ txs, balances }) {
  const [period, setPeriod] = useState('current');
  const [kind, setKind] = useState('all');
  const [accountId, setAccountId] = useState('');
  const range = periodRange(period);
  const filtered = useMemo(() => txs.filter((t) => {
    const day = txDay(t);
    return (!day || (day >= range.from && day <= range.to))
      && (kind === 'all' || t.type === kind)
      && (!accountId || t.account_id === accountId || t.to_account_id === accountId);
  }), [txs, range.from, range.to, kind, accountId]);
  const groups = useMemo(() => {
    const m = new Map();
    for (const t of filtered) {
      const day = txDay(t) || 'sin-fecha';
      if (!m.has(day)) m.set(day, []);
      m.get(day).push(t);
    }
    return [...m.entries()];
  }, [filtered]);

  return html`
    <section class="space-y-4">
      <${Segmented} value=${period} onChange=${setPeriod}
        options=${[['current', 'Mes actual'], ['prev', 'Mes ant.'], ['year', 'Año']]} />
      <${Segmented} value=${kind} onChange=${setKind} options=${TYPE_FILTERS} />
      <div class="grid grid-cols-[1fr_auto] gap-2">
        <select class=${input} value=${accountId} onChange=${(e) => setAccountId(e.target.value)} aria-label="Filtrar por cuenta">
          <option value="">Todas las cuentas</option>
          ${balances.map((a) => html`<option key=${a.id} value=${a.id}>${accountIcon(a)} ${a.name}</option>`)}
        </select>
        <button type="button" class="rounded-xl border border-azul-700 px-4 text-sm font-semibold disabled:opacity-40"
          disabled=${filtered.length === 0}
          onClick=${() => downloadCsv(`la-fructosa-${range.from}_${range.to}.csv`, transactionsToCsv(filtered))}>
          📥 CSV
        </button>
      </div>
      ${filtered.length === 0
        ? html`<div class=${card + ' p-5 text-center opacity-80'}>No hay movimientos con estos filtros.</div>`
        : groups.map(([day, list]) => html`
          <div key=${day}>
            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">${day === 'sin-fecha' ? 'Sin fecha' : new Date(day + 'T12:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
            <ul class=${card + ' divide-y divide-azul-800 overflow-hidden'}>
              ${list.map((t) => html`
                <li key=${t.id} class="p-3 flex items-center gap-3">
                  <span class="text-xl" aria-hidden="true">${t.type === 'income' ? '⬇️' : t.type === 'expense' ? '⬆️' : '🔁'}</span>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">${t.description || t.category || TX_LABEL[t.type]}</p>
                    <p class="text-xs opacity-60 truncate">
                      ${TX_LABEL[t.type]} · ${t.account?.name ?? 'Cuenta'}${t.to_account ? ' → ' + t.to_account.name : ''}
                      ${t.original_currency === 'VES' ? ` · ${fmt(t.original_amount, 'VES')}` : ''}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class=${'font-semibold tabular ' + (t.type === 'income' ? 'text-azul-200' : t.type === 'expense' ? 'text-salmon-200' : '')}>
                      ${t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}${fmt(t.amount, t.account?.currency)}
                    </p>
                    ${t.spread_usd != null && html`<p class="text-[11px] opacity-60 tabular">brecha ${fmt(Math.abs(t.spread_usd))}</p>`}
                  </div>
                </li>`)}
            </ul>
          </div>`)}
    </section>`;
}

// ---------------------------------------------------------------------
// Presupuestos mensuales
// ---------------------------------------------------------------------
function BudgetForm({ onDone, onCancel }) {
  const [category, setCategory] = useState(CATEGORIES.expense[0]);
  const [limit, setLimit] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const monthly_limit = Number(limit);
      if (!(monthly_limit > 0)) throw new Error('Indica un límite mayor a 0.');
      await api.upsertBudget({ category, monthly_limit, currency });
      onDone();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return html`
    <form onSubmit=${submit} class="space-y-3">
      <h3 class="font-semibold">Nuevo presupuesto</h3>
      <${Field} label="Categoría">
        <select class=${input} value=${category} onChange=${(e) => setCategory(e.target.value)}>
          ${CATEGORIES.expense.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
        </select>
      <//>
      <div class="grid grid-cols-2 gap-3">
        <${Field} label="Límite mensual">
          <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any" required
            value=${limit} onInput=${(e) => setLimit(e.target.value)} />
        <//>
        <${Field} label="Moneda">
          <select class=${input} value=${currency} onChange=${(e) => setCurrency(e.target.value)}>
            ${Object.keys(CURRENCIES).map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
          </select>
        <//>
      </div>
      <${ErrorBox} error=${error} />
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-xl border border-azul-200 dark:border-azul-600 py-3" onClick=${onCancel}>Cancelar</button>
        <button class=${btnPrimary} disabled=${busy}>${busy ? '…' : 'Guardar'}</button>
      </div>
    </form>`;
}

function Budgets({ budgets, txs, rates, profile, onChanged }) {
  const [adding, setAdding] = useState(false);
  const month = monthBounds(0);
  return html`
    <div class="space-y-3">
      <p class="text-xs opacity-60 capitalize">${month.label}</p>
      ${budgets.length === 0 && !adding && html`
        <div class=${card + ' p-5 text-center opacity-80'}>Define un límite mensual por categoría.</div>`}
      ${budgets.map((b) => {
        const { total, missing } = spentInCategory(txs, b.category, month.from, month.to, b.currency, rates, profile.valuation_rate);
        const limit = Number(b.monthly_limit);
        const pct = limit > 0 ? Math.min(999, (total / limit) * 100) : 0;
        const tone = budgetTone(pct);
        return html`
          <article key=${b.id} class=${card + ' p-4 space-y-2'}>
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="font-semibold">${b.category}</p>
                <p class=${'text-xs ' + tone.text}>${tone.label}${missing ? ' · falta tasa' : ''}</p>
              </div>
              <div class="text-right">
                <p class="text-sm tabular font-semibold">${fmt(total, b.currency)} / ${fmt(limit, b.currency)}</p>
                <button type="button" class="text-[11px] opacity-50" onClick=${quietly(async () => { await api.deleteBudget(b.id); onChanged(); })}>Quitar</button>
              </div>
            </div>
            <div class="h-2.5 rounded-full bg-azul-50 dark:bg-azul-900 overflow-hidden">
              <div class=${'h-full rounded-full transition-all ' + tone.bar} style=${{ width: `${Math.min(100, pct)}%` }}></div>
            </div>
            <p class="text-[11px] opacity-60 tabular">${pct.toFixed(0)}% del límite</p>
          </article>`;
      })}
      ${adding
        ? html`<div class=${card + ' p-4'}><${BudgetForm} onCancel=${() => setAdding(false)} onDone=${() => { setAdding(false); onChanged(); }} /></div>`
        : html`<button type="button" class=${btnPrimary} onClick=${() => setAdding(true)}>+ Presupuesto</button>`}
    </div>`;
}

// ---------------------------------------------------------------------
// Pagos recurrentes / suscripciones
// ---------------------------------------------------------------------
function RecurringForm({ balances, onDone, onCancel }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(balances[0]?.currency || 'USD');
  const [category, setCategory] = useState('Servicios');
  const [dueDay, setDueDay] = useState('5');
  const [accountId, setAccountId] = useState(balances[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const n = Number(amount);
      const day = Number(dueDay);
      if (!(n > 0)) throw new Error('Indica un monto mayor a 0.');
      if (!accountId) throw new Error('Elige la cuenta de cobro.');
      if (!(day >= 1 && day <= 31)) throw new Error('El día de pago debe ser entre 1 y 31.');
      await api.createRecurring({
        name: name.trim(), amount: n, currency, category, due_day: day, account_id: accountId, is_active: true,
      });
      onDone();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return html`
    <form onSubmit=${submit} class="space-y-3">
      <h3 class="font-semibold">Nuevo pago fijo</h3>
      <${Field} label="Nombre">
        <input class=${input} required placeholder="Internet, Netflix, Alquiler…" value=${name} onInput=${(e) => setName(e.target.value)} />
      <//>
      <div class="grid grid-cols-2 gap-3">
        <${Field} label="Monto">
          <input class=${input + ' tabular'} type="number" inputmode="decimal" step="any" required
            value=${amount} onInput=${(e) => setAmount(e.target.value)} />
        <//>
        <${Field} label="Moneda">
          <select class=${input} value=${currency} onChange=${(e) => setCurrency(e.target.value)}>
            ${Object.keys(CURRENCIES).map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
          </select>
        <//>
      </div>
      <${Field} label="Categoría">
        <select class=${input} value=${category} onChange=${(e) => setCategory(e.target.value)}>
          ${CATEGORIES.expense.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
        </select>
      <//>
      <div class="grid grid-cols-2 gap-3">
        <${Field} label="Día de pago (1–31)">
          <input class=${input + ' tabular'} type="number" inputmode="numeric" min="1" max="31" required
            value=${dueDay} onInput=${(e) => setDueDay(e.target.value)} />
        <//>
        <${Field} label="Cuenta de cobro">
          <select class=${input} value=${accountId} onChange=${(e) => setAccountId(e.target.value)}>
            ${balances.map((a) => html`<option key=${a.id} value=${a.id}>${accountIcon(a)} ${a.name}</option>`)}
          </select>
        <//>
      </div>
      <${ErrorBox} error=${error} />
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="rounded-xl border border-azul-200 dark:border-azul-600 py-3" onClick=${onCancel}>Cancelar</button>
        <button class=${btnPrimary} disabled=${busy}>${busy ? '…' : 'Guardar'}</button>
      </div>
    </form>`;
}

function Recurring({ items, txs, balances, rates, profile, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const month = monthBounds(0);
  const active = items.filter((r) => r.is_active);

  async function pay(rec) {
    setBusyId(rec.id); setError(null);
    try {
      const acc = balances.find((a) => a.id === rec.account_id);
      if (!acc) throw new Error('La cuenta asociada ya no existe.');
      let amount = Number(rec.amount);
      if (acc.currency !== rec.currency) {
        const v = convert(amount, rec.currency, acc.currency, rates, profile.valuation_rate);
        if (v == null) throw new Error('No hay tasa para convertir el pago.');
        amount = v;
      }
      await api.createTransaction({
        type: 'expense',
        account_id: rec.account_id,
        amount: Number(amount.toFixed(8)),
        category: rec.category || 'Otros',
        description: rec.name,
        occurred_on: todayISO(),
        original_amount: Number(rec.amount),
        original_currency: rec.currency,
      });
      onChanged();
    } catch (err) { setError(err); } finally { setBusyId(null); }
  }

  return html`
    <div class="space-y-3">
      <${ErrorBox} error=${error} />
      ${active.length === 0 && !adding && html`
        <div class=${card + ' p-5 text-center opacity-80'}>Registra alquiler, internet, streaming u otros fijos.</div>`}
      ${active.map((r) => {
        const acc = balances.find((a) => a.id === r.account_id);
        const st = recurringStatus(r, txs, month.from, month.to);
        return html`
          <article key=${r.id} class=${card + ' p-4 space-y-3'}>
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="font-semibold">${r.name}</p>
                <p class="text-xs opacity-60">${r.category} · ${acc ? acc.name : 'sin cuenta'} · día ${r.due_day}</p>
              </div>
              <p class="font-semibold tabular">${fmt(r.amount, r.currency)}</p>
            </div>
            ${st.soon && html`
              <span class="inline-flex text-[11px] font-bold uppercase tracking-wide rounded-full bg-sol text-azul-900 px-2 py-0.5">${st.label}</span>`}
            ${!st.soon && html`<span class=${'text-[11px] ' + (st.kind === 'late' ? 'text-salmon-700 dark:text-salmon-200' : 'opacity-60')}>${st.label}</span>`}
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class=${btnPrimary + (st.kind === 'paid' ? ' opacity-50' : '')}
                disabled=${busyId === r.id || st.kind === 'paid'} onClick=${() => pay(r)}>
                ${st.kind === 'paid' ? 'Pagado' : busyId === r.id ? '…' : 'Registrar pago'}
              </button>
              <button type="button" class="rounded-xl border border-azul-200 dark:border-azul-600 text-sm"
                onClick=${quietly(async () => { await api.updateRecurring(r.id, { is_active: false }); onChanged(); })}>
                Pausar
              </button>
            </div>
          </article>`;
      })}
      ${adding
        ? html`<div class=${card + ' p-4'}><${RecurringForm} balances=${balances} onCancel=${() => setAdding(false)} onDone=${() => { setAdding(false); onChanged(); }} /></div>`
        : html`<button type="button" class=${btnPrimary} onClick=${() => setAdding(true)}>+ Pago recurrente</button>`}
    </div>`;
}

function Plan({ budgets, recurring, txs, balances, rates, profile, onChanged }) {
  return html`
    <section class="space-y-6">
      <div class="space-y-3">
        <h2 class="font-semibold">📊 Presupuestos</h2>
        <${Budgets} budgets=${budgets} txs=${txs} rates=${rates} profile=${profile} onChanged=${onChanged} />
      </div>
      <div class="space-y-3">
        <h2 class="font-semibold">🔄 Pagos recurrentes</h2>
        <${Recurring} items=${recurring} txs=${txs} balances=${balances} rates=${rates} profile=${profile} onChanged=${onChanged} />
      </div>
    </section>`;
}

// ---------------------------------------------------------------------
// Manual de Uso
// ---------------------------------------------------------------------
const MANUAL = [
  {
    id: 'cuentas',
    icon: '💵',
    title: 'Mis Cuentas y Divisas',
    steps: [
      '1. En Inicio, toca + Nueva cuenta.',
      '2. Elige el tipo (Zelle, PayPal, Wise, Efectivo, Wire, Pago Móvil, USDT o personalizada), su nombre y su moneda.',
      '3. La tarjeta de saldo de Inicio suma todas tus cuentas y las convierte a tu moneda base con la tasa del día.',
      '4. Toca una cuenta para editarla. El total se actualiza solo al registrar movimientos.',
    ],
  },
  {
    id: 'tasas',
    icon: '📈',
    title: 'Tasas de Cambio (Venezuela)',
    steps: [
      '1. Al abrir la app se cargan Dólar BCV, Euro BCV y USDT Binance. Las ves dentro de la tarjeta de saldo en Inicio.',
      '2. Toca 🔄 para refrescarlas. Si no hay conexión, se conservan las últimas disponibles.',
      '3. En Más eliges si el total valora el dólar a tasa BCV o a USDT. Solo cambia la conversión del total, no el dinero de cada cuenta.',
    ],
  },
  {
    id: 'movimientos',
    icon: '💸',
    title: 'Registrar y Revisar Movimientos',
    steps: [
      '1. Toca el botón ＋ del centro. Se abre un único formulario.',
      '2. Ingreso: cuenta que recibe, categoría y monto. Gasto: cuenta de la que sale. Transferencia: origen y destino.',
      '3. Si pagaste en bolívares desde una cuenta en divisa, marca «Pagué en bolívares» e indica la tasa usada.',
      '4. En Movs ves el historial por día y filtras por periodo, tipo (Ingresos, Gastos, Transferencias) y cuenta.',
      '5. El botón 📥 CSV descarga lo que estás viendo, listo para Excel o Numbers.',
    ],
  },
  {
    id: 'plan',
    icon: '📊',
    title: 'Plan: Presupuestos y Pagos Recurrentes',
    steps: [
      '1. En Plan defines un límite mensual por categoría. La barra compara el tope con tus gastos del mes: azul va bien, amarillo desde 75 %, salmón si te pasaste.',
      '2. Más abajo registras pagos fijos (alquiler, internet, streaming) con su día de cobro y cuenta.',
      '3. Cuando falten 1 a 5 días verás una insignia amarilla. Toca Registrar pago para crear el gasto en un clic.',
    ],
  },
  {
    id: 'privacidad',
    icon: '🔐',
    title: 'Privacidad y Seguridad',
    steps: [
      'Cada persona entra con su propio correo. La base de datos aplica seguridad RLS: una fila solo se ve si pertenece a tu usuario.',
      'Nadie más puede leer, editar o borrar tus cuentas, movimientos, presupuestos o pagos recurrentes.',
      'Puedes instalar la app desde el navegador (Compartir → Agregar a inicio en iPhone, o el botón Instalar en Chrome). Cierra sesión desde Más si usas un equipo compartido.',
    ],
  },
];

function UserManual() {
  const [open, setOpen] = useState(null);
  return html`
    <div class=${card + ' overflow-hidden'}>
      <div class="px-4 pt-4 pb-3 bg-sol-100/80 dark:bg-sol-900/40">
        <h3 class="font-semibold text-azul-900 dark:text-papel">📖 Manual de Uso</h3>
        <p class="text-xs opacity-70 mt-1">Guía paso a paso. Toca un tema para abrirlo.</p>
      </div>
      ${MANUAL.map((ch) => {
        const active = open === ch.id;
        return html`
          <div key=${ch.id} class="border-t border-azul-100 dark:border-azul-700">
            <button type="button" aria-expanded=${active}
              class=${'w-full text-left px-4 py-3.5 flex items-center gap-3 min-h-[48px] ' + (active ? 'bg-azul-50/80 dark:bg-azul-900/50' : '')}
              onClick=${() => setOpen(active ? null : ch.id)}>
              <span class="text-xl" aria-hidden="true">${ch.icon}</span>
              <span class="flex-1 font-medium text-sm">${ch.title}</span>
              <span class=${'text-sm ' + (active ? 'text-salmon-700 dark:text-salmon-200' : 'opacity-40')}>${active ? '▾' : '▸'}</span>
            </button>
            ${active && html`
              <div class="px-4 pb-4 space-y-2 text-sm leading-relaxed">
                ${ch.steps.map((s) => html`<p key=${s} class="opacity-90">${s}</p>`)}
              </div>`}
          </div>`;
      })}
    </div>`;
}

// ---------------------------------------------------------------------
// Más: perfil, preferencias y ayuda (una sola página, sin submenús)
// ---------------------------------------------------------------------
function More({ profile, onSave }) {
  const zone = regionOf(profile);
  const who = greetName(profile);
  return html`
    <section class="space-y-4">
      <div class=${card + ' p-4 flex items-center gap-3'}>
        <span class="dash-avatar" aria-hidden="true">${(who || 'F').slice(0, 1).toUpperCase()}</span>
        <div class="min-w-0">
          <p class="font-semibold truncate">${profile.display_name || 'Mi perfil'}</p>
          <p class="text-xs opacity-70">${zone.flag} Moneda base · ${profile.preferred_currency}</p>
        </div>
      </div>

      <div class=${card + ' p-4 space-y-4'}>
        <div class="space-y-2">
          <p class="text-sm opacity-70">Región y moneda base</p>
          <${RegionPicker} value=${zone.id} onChange=${(id) => onSave(patchForRegion(id, profile))} />
        </div>
        <${Field} label="Mostrar el saldo total en">
          <${Segmented} value=${profile.preferred_currency} onChange=${(v) => onSave({ preferred_currency: v })}
            options=${[['EUR', 'Euros'], ['USD', 'Dólares'], ['VES', 'Bolívares']]} />
        <//>
        ${zone.showRates && html`
          <${Field} label="Valorar dólares a tasa">
            <${Segmented} value=${profile.valuation_rate} onChange=${(v) => onSave({ valuation_rate: v })}
              options=${[['BCV_USD', 'BCV oficial'], ['PARALELO', 'USDT / paralelo']]} />
          <//>`}
      </div>

      <${UserManual} />

      ${!isDemo && html`
        <button type="button" class="w-full rounded-xl border border-salmon-300 text-salmon-200 py-3 font-semibold"
          onClick=${() => supabase.auth.signOut()}>Cerrar sesión</button>`}
    </section>`;
}

// ---------------------------------------------------------------------
// Shell con navegación inferior
// ---------------------------------------------------------------------
// 'new' no es una pestaña: abre el modal de movimiento rápido.
const TABS = [
  ['home', 'Inicio', '🏠'],
  ['movs', 'Movs', '📒'],
  ['new', 'Nuevo', '＋'],
  ['plan', 'Plan', '📊'],
  ['more', 'Más', '✨'],
];

function MainApp() {
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [balances, setBalances] = useState([]);
  const [txs, setTxs] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [rates, setRates] = useState({});
  const [ratesBusy, setRatesBusy] = useState(false);
  const [ratesNote, setRatesNote] = useState('');
  const [syncIssue, setSyncIssue] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const applyLiveRates = useCallback(async () => {
    setRatesBusy(true);
    try {
      const live = await api.refreshRates();
      setRates(live.rates);
      setRatesNote(live.sourceNote || LIVE_RATES_NOTE);
    } catch (err) {
      console.warn('Tasas en vivo no disponibles:', err?.message || err);
      try { setRates(await api.latestRates()); } catch { /* se conservan las últimas tasas */ }
    } finally {
      setRatesBusy(false);
    }
  }, []);

  // Carga defensiva: cada consulta falla por separado y la UI siempre se muestra.
  const load = useCallback(async () => {
    const [pRes, bRes, tRes, buRes, reRes] = await Promise.allSettled([
      api.getProfile(), api.listBalances(), api.listTransactions(), api.listBudgets(), api.listRecurring(),
    ]);
    let failed = 0;
    const take = (res, ok) => {
      if (res.status === 'fulfilled') ok(res.value);
      else { failed += 1; console.warn('Consulta fallida:', res.reason?.message || res.reason); }
    };
    take(pRes, setProfile);
    if (pRes.status === 'rejected') {
      setProfile((prev) => prev || normalizeProfile({ display_name: '', preferred_currency: 'USD', region: 'VE' }));
    }
    take(bRes, setBalances);
    take(tRes, setTxs);
    take(buRes, setBudgets);
    take(reRes, setRecurring);
    setSyncIssue(failed > 0);
    await applyLiveRates();
  }, [applyLiveRates]);
  useEffect(() => { load(); }, [load]);

  async function saveProfile(patch) {
    try { setProfile(await api.updateProfile(patch)); }
    catch (err) { console.warn('No se guardó el perfil:', err?.message || err); setSyncIssue(true); }
  }

  if (!profile) return html`<main class="min-h-screen grid place-items-center opacity-60">Cargando…</main>`;

  const title = TABS.find(([k]) => k === tab)[1];
  const who = greetName(profile);

  return html`
    <div class="dash-shell flex flex-col max-w-md mx-auto">
      <header class="safe-top px-5 pt-4 pb-3 dash-header">
        <div class="min-w-0">
          ${tab === 'home'
            ? html`<h1 class="dash-greet truncate">${who ? `Hola, ${who}` : 'Bienvenido'}</h1>
                <p class="dash-greet-sub">La Fructosa</p>`
            : html`<p class="dash-greet-sub">La Fructosa</p>
                <h1 class="dash-greet truncate">${title}</h1>`}
        </div>
        <div class="dash-toolbar">
          ${isDemo && html`<span class="text-[10px] font-bold uppercase rounded-full px-2 py-1" style=${{ background: '#FDFFB6', color: '#152033' }}>Demo</span>`}
          <button type="button" class="dash-icon-btn" onClick=${() => setCalcOpen(true)} aria-label="Calculadora">🧮</button>
        </div>
      </header>

      <main class="flex-1 px-5 pb-28 pt-2">
        ${syncIssue && html`
          <p class="dash-sync" role="status">
            Mostrando los datos disponibles.
            <button type="button" onClick=${() => { setSyncIssue(false); load(); }}>Reintentar</button>
          </p>`}
        ${tab === 'home' && html`<${Home} profile=${profile} balances=${balances} rates=${rates}
          onAddAccount=${() => setSheet({ mode: 'create' })}
          onEditAccount=${(a) => setSheet({ mode: 'edit', account: a })}
          onToggleCurrency=${() => saveProfile({ preferred_currency: profile.preferred_currency === 'USD' ? 'VES' : 'USD' })}
          onRefreshRates=${applyLiveRates} ratesBusy=${ratesBusy} ratesNote=${ratesNote} />`}
        ${tab === 'movs' && html`<${Movements} txs=${txs} balances=${balances} />`}
        ${tab === 'plan' && html`<${Plan} budgets=${budgets} recurring=${recurring} txs=${txs}
          balances=${balances} rates=${rates} profile=${profile} onChanged=${load} />`}
        ${tab === 'more' && html`<${More} profile=${profile} onSave=${saveProfile} />`}
      </main>

      <nav class="dash-dock fixed bottom-0 inset-x-0 safe-bottom">
        <ul class="max-w-md mx-auto">
          ${TABS.map(([k, label, icon]) => html`
            <li key=${k}>
              <button type="button" onClick=${() => (k === 'new' ? setSheet({ mode: 'tx' }) : setTab(k))}
                aria-current=${tab === k ? 'page' : undefined} class=${tab === k ? 'is-on' : ''}>
                <span class=${'dock-ico' + (k === 'new' ? ' is-new' : '')}>${icon}</span>
                ${label}
              </button>
            </li>`)}
        </ul>
      </nav>

      ${calcOpen && html`<${Calculator} onClose=${() => setCalcOpen(false)} />`}
      ${sheet && html`
        <div class="fixed inset-0 z-20 bg-black/40 flex items-end" onClick=${() => setSheet(null)}>
          <div class="sheet w-full max-w-md mx-auto bg-azul-900 border-t border-azul-700 text-papel rounded-t-3xl p-5 safe-bottom" onClick=${(e) => e.stopPropagation()}>
            ${sheet.mode === 'tx'
              ? html`
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h2 class="text-xl font-bold">Nuevo movimiento</h2>
                    <button type="button" class="dash-icon-btn" onClick=${() => setSheet(null)} aria-label="Cerrar">✕</button>
                  </div>
                  <${NewTransaction} balances=${balances} rates=${rates} profile=${profile}
                    onDone=${() => { setSheet(null); load(); setTab('movs'); }} />
                </div>`
              : html`<${AccountForm} account=${sheet.mode === 'edit' ? sheet.account : null} region=${profile.region}
                  onCancel=${() => setSheet(null)} onDone=${() => { setSheet(null); load(); }} />`}
          </div>
        </div>`}
    </div>`;
}

function App() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    if (isDemo) return;
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session ?? null))
      .catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (isDemo) return html`<${MainApp} />`;
  if (session === undefined) {
    return html`
      <main class="min-h-screen grid place-items-center bg-azul-50 dark:bg-azul-900">
        <img src="./icons/icon-192.png" alt="La Fructosa" class="w-16 h-16 rounded-2xl" />
      </main>`;
  }
  return session ? html`<${MainApp} key=${session.user.id} />` : html`<${AuthScreen} />`;
}

// Evita la pantalla en blanco: cualquier fallo de render se muestra y se puede reintentar.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('La Fructosa:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return html`
      <main class="auth-page px-5 grid place-items-center">
        <div class="auth-card max-w-sm w-full space-y-3">
          <h1 class="text-lg font-bold">Algo salió mal</h1>
          <p class="text-sm">${String(this.state.error?.message || this.state.error)}</p>
          <button class="auth-submit" onClick=${() => location.reload()}>Reintentar</button>
        </div>
      </main>`;
  }
}

createRoot(document.getElementById('root')).render(html`<${ErrorBoundary}><${App} /><//>`);
