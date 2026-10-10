// Conversión de monedas y calculadora de brecha cambiaria.
// Todas las tasas vienen en VES por 1 unidad de divisa (como en exchange_rates).

export const CURRENCIES = {
  USD:  { label: 'Dólar',    symbol: '$',   decimals: 2 },
  VES:  { label: 'Bolívar',  symbol: 'Bs.', decimals: 2 },
  USDT: { label: 'USDT',     symbol: '₮',   decimals: 2 },
  EUR:  { label: 'Euro',     symbol: '€',   decimals: 2 },
};

export const KIND_ICONS = { cash: '💵', bank: '🏦', digital: '📱', crypto: '🟡' };

export const ACCOUNT_PRESETS = [
  { id: 'zelle', icon: '📱', label: 'Zelle', hint: 'USD', kind: 'digital', currencies: ['USD'], names: ['Zelle'] },
  { id: 'crypto', icon: '🟡', label: 'Binance / Crypto', hint: 'USDT / BTC', kind: 'crypto', currencies: ['USDT'], names: ['Binance', 'BTC', 'Bybit', 'Wallet'] },
  { id: 'paypal', icon: '🅿️', label: 'PayPal', hint: 'USD / EUR', kind: 'digital', currencies: ['USD', 'EUR'], names: ['PayPal'] },
  { id: 'wise', icon: '🌐', label: 'Wise / Revolut', hint: 'USD / EUR', kind: 'digital', currencies: ['USD', 'EUR'], names: ['Wise', 'Revolut'] },
  { id: 'cash', icon: '💵', label: 'Efectivo', hint: 'USD / EUR / VES', kind: 'cash', currencies: ['USD', 'EUR', 'VES'], names: ['Efectivo'] },
  { id: 'wire', icon: '🏦', label: 'Wire / Banco int.', hint: 'USD / EUR', kind: 'bank', currencies: ['USD', 'EUR'], names: ['Wire Transfer', 'Facebank', 'Bank of America', 'BBVA', 'Santander'] },
  { id: 'pago_movil', icon: '🇻🇪', label: 'Pago Móvil / Banco nacional', hint: 'VES', kind: 'bank', currencies: ['VES'], names: ['Pago Móvil', 'Banesco', 'Mercantil', 'BNC', 'Provincial'] },
  { id: 'custom', icon: '✏️', label: 'Personalizada / Libre', hint: 'Nombre, moneda y saldo', kind: 'digital', currencies: ['USD', 'EUR', 'VES', 'USDT'], names: [] },
];

export function accountIcon(acc) {
  return acc?.icon || KIND_ICONS[acc?.kind] || '💼';
}

export function presetForAccount(acc) {
  if (!acc) return ACCOUNT_PRESETS[0];
  const byIcon = ACCOUNT_PRESETS.find((p) => p.id !== 'custom' && p.icon === acc.icon);
  if (byIcon) return byIcon;
  const byName = ACCOUNT_PRESETS.find((p) => p.names.some((n) => n.toLowerCase() === String(acc.name || '').toLowerCase()));
  if (byName) return byName;
  return ACCOUNT_PRESETS.find((p) => p.id !== 'custom' && p.kind === acc.kind && p.currencies.includes(acc.currency))
    ?? ACCOUNT_PRESETS.find((p) => p.id === 'custom');
}

export const REGIONS = {
  ES: {
    id: 'ES',
    flag: '🇪🇸',
    label: 'España / Europa',
    cover: 'Europa (EUR - €)',
    hint: 'Euros · sin tasas BCV ni USDT',
    currency: 'EUR',
    showRates: false,
    presets: ['crypto', 'paypal', 'wise', 'cash', 'wire', 'custom'],
    currencies: ['EUR', 'USD'],
  },
  US: {
    id: 'US',
    flag: '🇺🇸',
    label: 'Estados Unidos',
    cover: 'Estados Unidos (USD - $)',
    hint: 'Dólares · Zelle y Wire',
    currency: 'USD',
    showRates: false,
    presets: ['zelle', 'crypto', 'paypal', 'wise', 'cash', 'wire', 'custom'],
    currencies: ['USD'],
  },
  VE: {
    id: 'VE',
    flag: '🇻🇪',
    label: 'Venezuela / Multimoneda',
    cover: 'Venezuela (Multimoneda / VES)',
    hint: 'VES, USD y USDT · BCV y Pago Móvil',
    currency: 'USD',
    showRates: true,
    presets: ['zelle', 'crypto', 'paypal', 'wise', 'cash', 'wire', 'pago_movil', 'custom'],
    currencies: ['USD', 'VES', 'USDT', 'EUR'],
  },
};

export function regionOf(profile) {
  return REGIONS[profile?.region] ?? REGIONS.VE;
}

export function normalizeProfile(p = {}) {
  const region = REGIONS[p.region] ? p.region : 'VE';
  const preferred = ['USD', 'VES', 'EUR'].includes(p.preferred_currency)
    ? p.preferred_currency
    : REGIONS[region].currency;
  return {
    ...p,
    region,
    preferred_currency: preferred,
    valuation_rate: p.valuation_rate || 'BCV_USD',
  };
}

export function presetsForRegion(_regionId, account) {
  const list = ACCOUNT_PRESETS;
  if (!account) return list;
  const current = presetForAccount(account);
  if (!list.some((p) => p.id === current.id)) return [current, ...list];
  return list;
}

export function currenciesForRegion(regionId, presetCurrencies, presetId) {
  if (presetId === 'custom') return ['USD', 'EUR', 'VES', 'USDT'];
  const source = presetCurrencies ?? ['USD', 'EUR', 'VES', 'USDT'];
  if (!(REGIONS[regionId] ?? REGIONS.VE).showRates) {
    const allowed = new Set((REGIONS[regionId] ?? REGIONS.VE).currencies);
    const next = source.filter((c) => allowed.has(c));
    if (next.length) return next;
  }
  return source;
}

export function patchForRegion(regionId, profile = {}) {
  const r = REGIONS[regionId] ?? REGIONS.VE;
  return {
    region: r.id,
    preferred_currency: r.currency,
    valuation_rate: profile.valuation_rate || 'BCV_USD',
  };
}

export const RATE_LABELS = {
  BCV_USD:  'Dólar BCV',
  BCV_EUR:  'Euro BCV',
  USDT:     'USDT Binance',
  PARALELO: 'USDT Binance',
};

// Las 3 tasas de Al Cambio: BCV USD, BCV EUR y USDT P2P (mercado).
export const LIVE_RATE_KEYS = ['BCV_USD', 'BCV_EUR', 'USDT'];

export const LIVE_RATES_NOTE = 'Actualizado según BCV y USDT Binance';

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function caracasDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
}

async function fetchJson(url, opts = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBcvAndParallel() {
  const [usdList, eurList] = await Promise.all([
    fetchJson('https://ve.dolarapi.com/v1/dolares'),
    fetchJson('https://ve.dolarapi.com/v1/euros'),
  ]);
  const usdOficial = usdList.find((x) => x.fuente === 'oficial');
  const usdParalelo = usdList.find((x) => x.fuente === 'paralelo');
  const eurOficial = eurList.find((x) => x.fuente === 'oficial');
  return {
    bcvUsd: {
      rate: positiveNumber(usdOficial?.promedio),
      date: caracasDate(usdOficial?.fechaActualizacion),
      source: 'BCV oficial',
    },
    bcvEur: {
      rate: positiveNumber(eurOficial?.promedio),
      date: caracasDate(eurOficial?.fechaActualizacion),
      source: 'BCV oficial',
    },
    market: {
      rate: positiveNumber(usdParalelo?.promedio),
      date: caracasDate(usdParalelo?.fechaActualizacion),
      source: 'Mercado paralelo',
    },
  };
}

async function fetchBinanceUsdt() {
  const payload = {
    page: 1,
    rows: 10,
    payTypes: [],
    asset: 'USDT',
    fiat: 'VES',
    tradeType: 'BUY',
    publisherType: null,
    merchantCheck: true,
  };
  const json = await fetchJson(
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    8000,
  );
  const prices = (json.data ?? [])
    .map((row) => positiveNumber(row.adv?.price))
    .filter(Boolean);
  if (!prices.length) throw new Error('Binance P2P sin anuncios USDT/VES');
  const sample = prices.slice(0, 8);
  const rate = sample.reduce((sum, n) => sum + n, 0) / sample.length;
  return { rate, date: caracasDate(), source: 'USDT Binance P2P' };
}

function toRow(type, info) {
  return {
    rate_type: type,
    rate: info.rate,
    rate_date: info.date,
    source: info.source,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Lee en vivo Dólar BCV, Euro BCV y USDT Binance P2P (como Al Cambio).
 * Si Binance bloquea CORS, usa el paralelo de DolarAPI como tasa de mercado.
 */
export async function fetchLiveMarketRates() {
  const bcv = await fetchBcvAndParallel();
  let usdt = null;
  try {
    usdt = await fetchBinanceUsdt();
  } catch {
    usdt = bcv.market.rate ? { ...bcv.market, source: 'USDT Binance / mercado' } : null;
  }
  if (!bcv.bcvUsd.rate || !bcv.bcvEur.rate || !usdt?.rate) {
    throw new Error('No se pudieron obtener las 3 tasas en tiempo real.');
  }
  const rows = [
    toRow('BCV_USD', bcv.bcvUsd),
    toRow('BCV_EUR', bcv.bcvEur),
    toRow('USDT', usdt),
    toRow('PARALELO', usdt),
  ];
  return {
    rates: Object.fromEntries(rows.map((r) => [r.rate_type, r.rate])),
    rows,
    updatedAt: new Date().toISOString(),
    sourceNote: LIVE_RATES_NOTE,
  };
}

export const CATEGORIES = {
  expense:  ['Comida', 'Mercado', 'Servicios', 'Transporte', 'Salidas', 'Salud', 'Hogar', 'Remesas', 'Otros'],
  income:   ['Sueldo', 'Freelance', 'Remesas', 'Venta', 'Regalo', 'Otros'],
  transfer: ['Transferencia', 'Cambio de divisa'],
};

// rates: { BCV_USD: 180, PARALELO: 250, ... }
// valuation: 'BCV_USD' | 'PARALELO' — tasa con la que se valora el dólar.
export function vesPerUnit(currency, rates, valuation = 'BCV_USD') {
  switch (currency) {
    case 'VES':  return 1;
    case 'USD':  return rates[valuation] ?? rates.BCV_USD;
    case 'USDT': return rates.USDT ?? rates.PARALELO;
    case 'EUR':  return rates.BCV_EUR;
    default:     return undefined;
  }
}

export function convert(amount, from, to, rates, valuation) {
  if (from === to) return amount;
  const a = vesPerUnit(from, rates, valuation);
  const b = vesPerUnit(to, rates, valuation);
  if (!a || !b) return null;
  return (amount * a) / b;
}

// Saldo total consolidado en la moneda preferida del usuario.
export function consolidate(balances, target, rates, valuation) {
  let total = 0;
  let missing = false;
  for (const acc of balances) {
    const v = convert(Number(acc.balance), acc.currency, target, rates, valuation);
    if (v == null) missing = true; else total += v;
  }
  return { total, missing };
}

// Suma nativa por moneda y su equivalente en la moneda preferida.
export function balanceBreakdown(balances, target, rates, valuation) {
  const map = new Map();
  for (const acc of balances) {
    const native = Number(acc.balance) || 0;
    const converted = convert(native, acc.currency, target, rates, valuation);
    const prev = map.get(acc.currency) ?? { currency: acc.currency, native: 0, converted: 0, missing: false };
    prev.native += native;
    if (converted == null) prev.missing = true;
    else prev.converted += converted;
    map.set(acc.currency, prev);
  }
  return [...map.values()];
}

// Tasa de mercado con la que realmente se consiguen bolívares desde una cuenta.
export function marketRateFor(accountCurrency, rates) {
  return accountCurrency === 'USDT' ? (rates.USDT ?? rates.PARALELO) : rates.PARALELO;
}

/**
 * Brecha al pagar en VES teniendo el respaldo en USD/USDT.
 * Un precio de $X a tasa BCV equivale a vesAmount bolívares; esa misma
 * cantidad de bolívares, conseguida a tasa de mercado, vale otra cifra en USD.
 * La diferencia es la brecha cambiaria que pagas o ganas.
 */
export function spreadCalc(vesAmount, rates, accountCurrency = 'USD') {
  const bcv = rates.BCV_USD;
  const market = marketRateFor(accountCurrency, rates);
  if (!vesAmount || !bcv || !market) return null;
  const usdAtBcv = vesAmount / bcv;
  const usdAtMarket = vesAmount / market;
  const spread = usdAtBcv - usdAtMarket;
  return {
    bcv, market, usdAtBcv, usdAtMarket, spread,
    spreadPct: (spread / usdAtBcv) * 100,
    gapPct: ((market - bcv) / bcv) * 100, // brecha entre tasas
  };
}

export function fmt(amount, currency = 'USD', opts = {}) {
  const c = CURRENCIES[currency] ?? { symbol: '', decimals: 2 };
  const n = Number(amount ?? 0);
  const s = n.toLocaleString('es-VE', {
    minimumFractionDigits: opts.decimals ?? c.decimals,
    maximumFractionDigits: opts.decimals ?? c.decimals,
  });
  return `${c.symbol} ${s}`;
}

export function fmtRate(rate) {
  return Number(rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function caracasToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
}

export function monthBounds(offset = 0) {
  const [y, m] = caracasToday().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const yy = d.getUTCFullYear();
  const mm = d.getUTCMonth() + 1;
  const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    from: `${yy}-${pad(mm)}-01`,
    to: `${yy}-${pad(mm)}-${pad(last)}`,
    label: d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    year: yy,
    month: mm,
  };
}

export function yearBounds() {
  const y = caracasToday().slice(0, 4);
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: y };
}

export function spentInCategory(txs, category, from, to, target, rates, valuation) {
  let total = 0;
  let missing = false;
  for (const t of txs) {
    if (t.type !== 'expense' || t.category !== category) continue;
    if (t.occurred_on < from || t.occurred_on > to) continue;
    const cur = t.account?.currency || 'USD';
    const v = convert(Number(t.amount), cur, target, rates, valuation);
    if (v == null) missing = true;
    else total += v;
  }
  return { total, missing };
}

export function budgetTone(pct) {
  if (pct >= 100) return { bar: 'bg-salmon', text: 'text-salmon-700 dark:text-salmon-200', label: 'Excedido' };
  if (pct >= 75) return { bar: 'bg-sol', text: 'text-sol-700 dark:text-sol-100', label: 'Al 75%+' };
  return { bar: 'bg-azul-400', text: 'text-azul-700 dark:text-azul-200', label: 'Dentro del límite' };
}

export function recurringStatus(rec, txs, from, to) {
  const today = caracasToday();
  const day = Number(today.slice(8, 10));
  const last = Number(to.slice(8, 10));
  const due = Math.min(Number(rec.due_day), last);
  const paid = txs.some((t) => (
    t.type === 'expense'
    && t.occurred_on >= from && t.occurred_on <= to
    && (t.description === rec.name
      || (t.category === rec.category && t.account_id === rec.account_id && Number(t.amount) === Number(rec.amount)))
  ));
  if (paid) return { kind: 'paid', label: 'Pagado este mes', soon: false };
  if (due === day) return { kind: 'soon', label: 'Vence hoy', soon: true };
  if (due > day && due - day <= 5) return { kind: 'soon', label: `Vence en ${due - day} días`, soon: true };
  if (due < day) return { kind: 'late', label: `Venció el día ${due}`, soon: false };
  return { kind: 'ok', label: `Día ${due}`, soon: false };
}

const TX_TIPO = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };

export function transactionsToCsv(txs) {
  const headers = ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto Original', 'Moneda', 'Cuenta', 'Tasa de Cambio'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = txs.map((t) => [
    t.occurred_on,
    t.description ?? '',
    t.category ?? '',
    TX_TIPO[t.type] ?? t.type,
    t.original_amount ?? t.amount ?? '',
    t.original_currency ?? t.account?.currency ?? '',
    t.account?.name ?? '',
    t.rate_applied ?? '',
  ].map(esc).join(','));
  return `\uFEFF${[headers.map(esc).join(','), ...lines].join('\r\n')}`;
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
