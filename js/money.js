// Motor financiero de La Fructosa: monedas, regiones, conversión y brecha.
// Todas las tasas se expresan en VES por 1 unidad de divisa (como en exchange_rates).

export const CURRENCIES = {
  USD:  { label: 'Dólar',   symbol: '$',   decimals: 2, flag: '🇺🇸' },
  VES:  { label: 'Bolívar', symbol: 'Bs.', decimals: 2, flag: '🇻🇪' },
  USDT: { label: 'Tether',  symbol: '₮',   decimals: 2, flag: '🪙' },
  EUR:  { label: 'Euro',    symbol: '€',   decimals: 2, flag: '🇪🇺' },
};

export const RATE_LABELS = {
  BCV_USD:  'Dólar BCV',
  BCV_EUR:  'Euro BCV',
  PARALELO: 'Dólar Paralelo',
  USDT:     'USDT P2P',
};

export const RATE_HELP = {
  BCV_USD:  'Tasa oficial del Banco Central de Venezuela. Es la que usan los comercios para cobrarte en bolívares.',
  BCV_EUR:  'Tasa oficial del BCV para el euro.',
  PARALELO: 'Promedio del mercado no oficial (Monitor). Es lo que realmente cuesta conseguir un dólar en el mercado.',
  USDT:     'Precio del USDT en el mercado P2P (Binance). Útil si tu respaldo está en cripto.',
};

// Cada región cambia qué monedas se ofrecen y si se muestran tasas y brecha.
export const REGIONS = {
  VE: { label: 'Venezuela',      flag: '🇻🇪', currencies: ['USD', 'VES', 'USDT', 'EUR'], base: 'USD', rates: true },
  US: { label: 'Estados Unidos', flag: '🇺🇸', currencies: ['USD', 'USDT', 'EUR'],        base: 'USD', rates: false },
  ES: { label: 'España',         flag: '🇪🇸', currencies: ['EUR', 'USD', 'USDT'],        base: 'EUR', rates: false },
};

export const KINDS = {
  cash:    { label: 'Efectivo', emoji: '💵' },
  bank:    { label: 'Banco',    emoji: '🏦' },
  digital: { label: 'Digital',  emoji: '📱' },
  crypto:  { label: 'Cripto',   emoji: '🪙' },
};

// Plantillas de cuentas típicas por región: crear una cuenta toma un solo toque.
export const ACCOUNT_TEMPLATES = {
  VE: [
    { name: 'Pago Móvil', currency: 'VES', kind: 'bank', icon: '📲' },
    { name: 'Efectivo USD', currency: 'USD', kind: 'cash', icon: '💵' },
    { name: 'Efectivo VES', currency: 'VES', kind: 'cash', icon: '💵' },
    { name: 'Zelle', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'Binance (USDT)', currency: 'USDT', kind: 'crypto', icon: '🪙' },
    { name: 'Banesco', currency: 'VES', kind: 'bank', icon: '🏦' },
    { name: 'Mercantil', currency: 'VES', kind: 'bank', icon: '🏦' },
  ],
  US: [
    { name: 'Zelle', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'Venmo', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'Cash App', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'Apple Pay', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'Tarjeta de Crédito', currency: 'USD', kind: 'bank', icon: '💳' },
    { name: 'Cuenta de Cheques (Checking Account)', currency: 'USD', kind: 'bank', icon: '🏦' },
    { name: 'Cash', currency: 'USD', kind: 'cash', icon: '💵' },
  ],
  ES: [
    { name: 'Bizum', currency: 'EUR', kind: 'digital', icon: '📱' },
    { name: 'Cuenta IBAN / Transferencia', currency: 'EUR', kind: 'bank', icon: '🏦' },
    { name: 'Tarjeta de Débito', currency: 'EUR', kind: 'bank', icon: '💳' },
    { name: 'Efectivo EUR', currency: 'EUR', kind: 'cash', icon: '💶' },
    { name: 'Binance', currency: 'USDT', kind: 'crypto', icon: '🪙' },
  ],
};

// Filas de "elige tu banco" en la pantalla de bienvenida: en vez de un banco fijo, la persona
// toca el suyo en la lista desplegable (bank: true). Reemplazan a las plantillas con nombre de banco.
export const BANK_PICK_TEMPLATES = {
  VE: [
    { name: 'Cuenta en un banco', currency: 'VES', kind: 'bank', icon: '🏦', bank: true },
    { name: 'Banco o app en dólares', currency: 'USD', kind: 'bank', icon: '🏦', bank: true },
  ],
  US: [{ name: 'Cuenta en un banco', currency: 'USD', kind: 'bank', icon: '🏦', bank: true }],
  ES: [{ name: 'Cuenta en un banco', currency: 'EUR', kind: 'bank', icon: '🏦', bank: true }],
};

// Bancos e instituciones por región, agrupados en secciones desplegables (pantalla "¿Dónde tienes tu dinero?").
// Cada nombre es el que se guarda como nombre de la cuenta.
const INTERNATIONAL = [
  'Bank of America (BOFA)', 'Chase', 'Wells Fargo', 'Citibank', 'Capital One', 'Zelle', 'PayPal', 'Wise', 'Revolut',
  'Binance', 'Zinli', 'Airtm', 'Reserve', 'Meru',
];
export const BANK_GROUPS = {
  VE: [
    { title: 'Bancos de Venezuela', banks: [
      'Banesco', 'Banco de Venezuela (BDV)', 'Mercantil', 'BBVA Provincial', 'Banco Nacional de Crédito (BNC)', 'Bancamiga',
      'Bancaribe', 'Banco Occidental de Descuento (BOD)', 'Banco Fondo Común (BFC)', 'Banplus', 'Banco del Tesoro', 'Banco Bicentenario',
      'Banco Exterior', 'Banco Venezolano de Crédito', 'Banco Activo', 'Bancrecer', '100% Banco', 'Banco Caroní', 'Banco Plaza',
      'Banco Sofitasa', 'DelSur', 'Banco Agrícola de Venezuela', 'Banfanb', 'Bangente',
    ] },
    { title: 'Bancos e internacionales', banks: INTERNATIONAL },
  ],
  US: [
    { title: 'Bancos de Estados Unidos', banks: [
      'Chase', 'Bank of America (BOFA)', 'Wells Fargo', 'Citibank', 'Capital One', 'PNC Bank', 'TD Bank', 'US Bank',
      'Truist', 'Navy Federal', 'Ally Bank', 'Discover',
    ] },
    { title: 'Internacionales y apps de pago', banks: ['Zelle', 'PayPal', 'Wise', 'Revolut', 'Binance', 'Zinli', 'Airtm'] },
  ],
  ES: [
    { title: 'Bancos de España', banks: [
      'BBVA', 'Banco Santander', 'CaixaBank', 'Banco Sabadell', 'ING', 'Openbank', 'Bankinter', 'Unicaja', 'Abanca', 'Ibercaja',
    ] },
    { title: 'Internacionales y apps de pago', banks: ['Revolut', 'N26', 'Wise', 'PayPal', 'Binance', 'Zinli'] },
  ],
};

// Lista plana (para los campos con sugerencias): todos los bancos de la región, sin repetir.
export const BANK_SUGGESTIONS = Object.fromEntries(
  Object.entries(BANK_GROUPS).map(([region, groups]) => [region, [...new Set(groups.flatMap((g) => g.banks))]]),
);

// Compatibilidad
export const VE_BANKS = BANK_GROUPS.VE[0].banks;

export const ACCOUNT_COLORS = ['#A0C4FF', '#FFADAD', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#BDB2FF', '#FFC6FF', '#FFD6A5'];

// Categorías: el texto es lo que se guarda en la base de datos; el emoji y el color son solo de la interfaz.
export const CATEGORIES = {
  expense: [
    { name: 'Comida', emoji: '🍔', color: '#FFADAD' },
    { name: 'Mercado', emoji: '🛒', color: '#FFD6A5' },
    { name: 'Servicios', emoji: '💡', color: '#FDFFB6' },
    { name: 'Transporte', emoji: '🚗', color: '#CAFFBF' },
    { name: 'Salidas', emoji: '🎉', color: '#9BF6FF' },
    { name: 'Salud', emoji: '💊', color: '#A0C4FF' },
    { name: 'Hogar', emoji: '🏠', color: '#BDB2FF' },
    { name: 'Educación', emoji: '📚', color: '#FFC6FF' },
    { name: 'Suscripciones', emoji: '📺', color: '#E4C1F9' },
    { name: 'Ropa', emoji: '👕', color: '#F1C0E8' },
    { name: 'Remesas', emoji: '💸', color: '#B9FBC0' },
    { name: 'Otros', emoji: '📦', color: '#CFD8E8' },
  ],
  income: [
    { name: 'Sueldo', emoji: '💼', color: '#CAFFBF' },
    { name: 'Freelance', emoji: '💻', color: '#9BF6FF' },
    { name: 'Remesas', emoji: '💸', color: '#B9FBC0' },
    { name: 'Venta', emoji: '🏷️', color: '#FDFFB6' },
    { name: 'Regalo', emoji: '🎁', color: '#FFC6FF' },
    { name: 'Intereses', emoji: '📈', color: '#A0C4FF' },
    { name: 'Otros', emoji: '✨', color: '#CFD8E8' },
  ],
  transfer: [
    { name: 'Transferencia interna', emoji: '🔁', color: '#A0C4FF' },
    { name: 'Cambio de divisa', emoji: '💱', color: '#FDFFB6' },
  ],
};

export const ADJUST_CATEGORY = 'Ajuste de saldo';

export function categoryMeta(name, type = 'expense') {
  const all = [...(CATEGORIES[type] || []), ...CATEGORIES.expense, ...CATEGORIES.income, ...CATEGORIES.transfer];
  if (name === ADJUST_CATEGORY) return { name, emoji: '⚖️', color: '#CFD8E8' };
  return all.find((c) => c.name === name) || { name: name || 'Sin categoría', emoji: '🏷️', color: '#CFD8E8' };
}

// ---------------------------------------------------------------------
// Conversión
// ---------------------------------------------------------------------
// rates: { BCV_USD: 180, PARALELO: 250, USDT: 249, BCV_EUR: 205 }
// valuation: 'BCV_USD' | 'PARALELO' — tasa con la que se valora el dólar.
export function vesPerUnit(currency, rates, valuation = 'BCV_USD') {
  switch (currency) {
    case 'VES':  return 1;
    case 'USD':  return rates[valuation] ?? rates.BCV_USD;
    case 'USDT': return rates.USDT ?? rates.PARALELO ?? rates.BCV_USD;
    case 'EUR': {
      // El euro se mueve con el dólar elegido para que la valoración sea coherente.
      if (!rates.BCV_EUR || !rates.BCV_USD) return undefined;
      return rates.BCV_EUR * ((rates[valuation] ?? rates.BCV_USD) / rates.BCV_USD);
    }
    default: return undefined;
  }
}

export function convert(amount, from, to, rates, valuation) {
  const n = Number(amount) || 0;
  if (from === to) return n;
  // USD y USDT se tratan 1:1 fuera de Venezuela si no hay tasas.
  if (!rates.BCV_USD && ['USD', 'USDT'].includes(from) && ['USD', 'USDT'].includes(to)) return n;
  const a = vesPerUnit(from, rates, valuation);
  const b = vesPerUnit(to, rates, valuation);
  if (!a || !b) return null;
  return (n * a) / b;
}

export function consolidate(accounts, target, rates, valuation) {
  let total = 0;
  let missing = false;
  for (const acc of accounts) {
    const v = convert(acc.balance, acc.currency, target, rates, valuation);
    if (v == null) missing = true; else total += v;
  }
  return { total, missing };
}

// Tasa a la que realmente consigues bolívares desde una cuenta en divisas.
export function marketRateFor(accountCurrency, rates) {
  if (accountCurrency === 'USDT') return rates.USDT ?? rates.PARALELO;
  if (accountCurrency === 'EUR') return rates.BCV_EUR;
  return rates.PARALELO ?? rates.BCV_USD;
}

/**
 * Brecha al pagar en bolívares con respaldo en divisas.
 * vesAmount: bolívares pagados. rateApplied: Bs. que obtuviste por cada unidad de tu cuenta.
 * Compara lo que realmente salió de tu cuenta con el "precio en dólares" a tasa BCV.
 */
export function spreadCalc(vesAmount, rates, rateApplied) {
  const bcv = rates.BCV_USD;
  const used = Number(rateApplied) || rates.PARALELO;
  if (!vesAmount || !bcv || !used) return null;
  const usdAtBcv = vesAmount / bcv;       // lo que "vale" la compra según el BCV
  const realCost = vesAmount / used;      // lo que de verdad salió de tu cuenta
  const diff = usdAtBcv - realCost;       // > 0: te favoreció · < 0: perdiste dinero
  return {
    bcv, used, usdAtBcv, realCost, diff,
    diffPct: (diff / usdAtBcv) * 100,
    gapPct: rates.PARALELO ? ((rates.PARALELO - bcv) / bcv) * 100 : null,
  };
}

// Comparador: el comercio fija un precio en $ y acepta Bs. a tasa BCV.
// ¿Conviene pagar en divisas o cambiar el dinero y pagar en bolívares?
export function payCompare(priceUsd, rates, sourceCurrency = 'USD') {
  const bcv = rates.BCV_USD;
  const market = marketRateFor(sourceCurrency, rates);
  if (!priceUsd || !bcv || !market) return null;
  const ves = priceUsd * bcv;
  const costIfVes = ves / market;
  return { ves, costIfUsd: priceUsd, costIfVes, saving: priceUsd - costIfVes, market };
}

// ---------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------
const nf = {};
function numberFormat(decimals) {
  return (nf[decimals] ??= new Intl.NumberFormat('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
}

export function fmt(amount, currency = 'USD', opts = {}) {
  const c = CURRENCIES[currency] ?? { symbol: '', decimals: 2 };
  const n = Number(amount ?? 0);
  const s = numberFormat(opts.decimals ?? c.decimals).format(Math.abs(n));
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : '';
  return `${sign}${c.symbol} ${s}`;
}

export function fmtCompact(amount, currency = 'USD') {
  const c = CURRENCIES[currency] ?? { symbol: '' };
  const n = Math.abs(Number(amount) || 0);
  const s = n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(0) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : n.toFixed(0);
  return `${c.symbol}${s.replace('.', ',')}`;
}

export function fmtRate(rate) {
  const n = Number(rate);
  if (!rate || isNaN(n) || n <= 0) return '—';
  return numberFormat(2).format(n);
}

export const fmtPct = (p, d = 1) => (p == null || !isFinite(p) ? '—' : `${numberFormat(d).format(p)}%`);

// Acepta "1.234,56", "1234.56" o "1,5" y devuelve un número.
export function parseAmount(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  return Number(s);
}

// ---------------------------------------------------------------------
// Fechas (hora de Caracas para que "hoy" no cambie a las 8 p. m.)
// ---------------------------------------------------------------------
export const TZ = 'America/Caracas';
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
export const monthKey = (iso) => iso.slice(0, 7);
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function monthLabel(ym, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-VE', { ...opts, timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function dayLabel(iso) {
  const today = todayISO();
  const d = new Date(iso + 'T12:00:00Z');
  const y = new Date(today + 'T12:00:00Z'); y.setUTCDate(y.getUTCDate() - 1);
  if (iso === today) return 'Hoy';
  if (iso === y.toISOString().slice(0, 10)) return 'Ayer';
  const s = d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function shortDate(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
