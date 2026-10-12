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

// Cada región cambia qué monedas se ofrecen primero, si se muestran tasas y brecha, la zona horaria
// para "hoy" y los textos de ejemplo. Las cuatro monedas (USD, VES, USDT, EUR) están disponibles en
// todos los países: quien vive fuera y conserva una cuenta en bolívares la crea igual, y las tasas
// se activan solas (ver regionFor).
export const REGIONS = {
  VE:  { code: 'VE',  label: 'Venezuela',      short: 'VE',   flag: '🇻🇪', currencies: ['USD', 'VES', 'USDT', 'EUR'], base: 'USD', rates: true,
         tz: 'America/Caracas', examples: 'efectivo, Pago Móvil, Zelle, Binance…' },
  US:  { code: 'US',  label: 'Estados Unidos', short: 'US',   flag: '🇺🇸', currencies: ['USD', 'USDT', 'EUR', 'VES'], base: 'USD', rates: false,
         tz: 'America/New_York', examples: 'Chase, Bank of America, Zelle, Venmo, Apple Pay…' },
  ES:  { code: 'ES',  label: 'España',         short: 'ES',   flag: '🇪🇸', currencies: ['EUR', 'USD', 'USDT', 'VES'], base: 'EUR', rates: false,
         tz: 'Europe/Madrid', examples: 'efectivo en euros, tu banco, Bizum, tarjeta…' },
  INT: { code: 'INT', label: 'Otro país',      short: 'Otro', flag: '🌎', currencies: ['USD', 'EUR', 'USDT', 'VES'], base: 'USD', rates: false,
         tz: '', examples: 'efectivo, tu banco local, Wise, PayPal, Binance…' },
};

// Región efectiva de una persona: fuera de Venezuela, tener una cuenta activa en bolívares
// enciende las tasas BCV/Paralelo/USDT y la calculadora de brecha.
export function regionFor(code, accounts = []) {
  const base = REGIONS[code] || REGIONS.VE;
  if (base.rates) return base;
  const ves = accounts.some((a) => !a.archived && a.currency === 'VES');
  return ves ? { ...base, rates: true } : base;
}

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
    { name: 'Efectivo EUR', currency: 'EUR', kind: 'cash', icon: '💶' },
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
    { name: 'Cuenta de Ahorros (Savings)', currency: 'USD', kind: 'bank', icon: '🐷' },
    { name: 'PayPal', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'Cash', currency: 'USD', kind: 'cash', icon: '💵' },
    { name: 'Binance (USDT)', currency: 'USDT', kind: 'crypto', icon: '🪙' },
  ],
  ES: [
    { name: 'Bizum', currency: 'EUR', kind: 'digital', icon: '📱' },
    { name: 'Cuenta IBAN / Transferencia', currency: 'EUR', kind: 'bank', icon: '🏦' },
    { name: 'Tarjeta de Débito', currency: 'EUR', kind: 'bank', icon: '💳' },
    { name: 'Tarjeta de Crédito', currency: 'EUR', kind: 'bank', icon: '💳' },
    { name: 'Efectivo EUR', currency: 'EUR', kind: 'cash', icon: '💶' },
    { name: 'Revolut', currency: 'EUR', kind: 'digital', icon: '📱' },
    { name: 'PayPal', currency: 'EUR', kind: 'digital', icon: '📱' },
    { name: 'Binance (USDT)', currency: 'USDT', kind: 'crypto', icon: '🪙' },
  ],
  INT: [
    { name: 'Efectivo USD', currency: 'USD', kind: 'cash', icon: '💵' },
    { name: 'Zelle', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'PayPal', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'Wise', currency: 'USD', kind: 'digital', icon: '📱' },
    { name: 'Binance (USDT)', currency: 'USDT', kind: 'crypto', icon: '🪙' },
    { name: 'Efectivo EUR', currency: 'EUR', kind: 'cash', icon: '💶' },
  ],
};

// Filas de "elige tu banco" en la pantalla de bienvenida: en vez de un banco fijo, la persona
// toca el suyo en la lista desplegable (bank: true). Reemplazan a las plantillas con nombre de banco.
// Fuera de Venezuela se ofrece también la cuenta en bolívares, para quien la conserva allá.
const VES_PICK = { name: 'Banco venezolano (Bs.)', currency: 'VES', kind: 'bank', icon: '🏦', bank: true };
export const BANK_PICK_TEMPLATES = {
  VE: [VES_PICK, { name: 'Banco o app internacional (USD)', currency: 'USD', kind: 'bank', icon: '🏦', bank: true }],
  US: [{ name: 'Cuenta en un banco', currency: 'USD', kind: 'bank', icon: '🏦', bank: true }, VES_PICK],
  ES: [{ name: 'Cuenta en un banco', currency: 'EUR', kind: 'bank', icon: '🏦', bank: true }, VES_PICK],
  INT: [
    { name: 'Banco donde vives (USD)', currency: 'USD', kind: 'bank', icon: '🏦', bank: true },
    { name: 'Banco donde vives (EUR)', currency: 'EUR', kind: 'bank', icon: '🏦', bank: true },
    VES_PICK,
  ],
};

// Bancos e instituciones, agrupados en secciones desplegables (pantalla "¿Dónde tienes tu dinero?").
// Cada nombre es el que se guarda como nombre de la cuenta.
// Venezuela: banca universal, microfinanciera, digital y pública autorizada por SUDEBAN (2026).
const VE_GROUP = { title: 'Bancos de Venezuela', ves: true, banks: [
  'Banco de Venezuela (BDV)', 'Banesco', 'Mercantil', 'BBVA Provincial', 'Banco Nacional de Crédito (BNC)', 'Bancamiga',
  'Banco del Tesoro', 'Banco Digital de los Trabajadores (Bicentenario)', 'Bancaribe', 'Banco Exterior',
  'Banco Venezolano de Crédito', 'Banplus', 'Banco Fondo Común (BFC)', 'Banco Activo', 'Banco Plaza', 'Banco Caroní',
  'Banco Sofitasa', '100% Banco', 'DelSur', 'Bancrecer', 'R4 Banco Microfinanciero (Mi Banco)', 'Banfanb',
  'Banco Agrícola de Venezuela', 'Bangente', 'N58 Banco Digital', 'Banco Internacional de Desarrollo',
  'Bancoex', 'Banavih', 'Instituto Municipal de Crédito Popular',
] };
const INTL_BANKS = { title: 'Bancos internacionales', banks: [
  'Bank of America (BOFA)', 'Chase', 'Wells Fargo', 'Citibank', 'Capital One', 'Banesco USA', 'Amerant Bank', 'BBVA',
  'Banco Santander', 'HSBC', 'Scotiabank', 'Itaú', 'Banesco Panamá', 'Mercantil Banco (Panamá)', 'Banco General (Panamá)',
  'Bancolombia', 'Davivienda', 'Banco de Bogotá', 'Banco de Chile', 'BancoEstado', 'Banco Pichincha', 'BCP (Perú)',
  'Interbank', 'BBVA México', 'Banorte', 'Banco Galicia', 'Banco Popular', 'Caixa / Millennium',
] };
const PAY_APPS = { title: 'Apps de pago y billeteras', banks: [
  'Zelle', 'PayPal', 'Wise', 'Revolut', 'Zinli', 'Wally', 'Airtm', 'Reserve', 'Meru', 'Kontigo', 'Payoneer', 'Skrill',
  'Venmo', 'Cash App', 'Apple Pay', 'Google Pay', 'N26', 'Bizum', 'Nequi', 'Yape', 'Mercado Pago', 'Western Union', 'Remitly',
] };
const CRYPTO = { title: 'Cripto (USDT)', banks: [
  'Binance', 'Bybit', 'OKX', 'Coinbase', 'Kraken', 'KuCoin', 'Bitget', 'El Dorado', 'Trust Wallet', 'MetaMask',
] };
// Apps de pago propias de cada país (van antes que la lista general).
const US_APPS = { title: 'Apps de pago en Estados Unidos', banks: [
  'Zelle', 'Venmo', 'Cash App', 'Apple Pay', 'Google Pay', 'PayPal', 'Chime', 'Apple Card', 'Amex (American Express)', 'Discover',
] };
const ES_APPS = { title: 'Apps de pago en España', banks: [
  'Bizum', 'Apple Pay', 'Google Pay', 'PayPal', 'Revolut', 'N26', 'Wise', 'Openbank', 'Imagin', 'Bnext', 'MyInvestor',
] };
const others = (exclude) => ({ title: 'Otras apps y billeteras', banks: PAY_APPS.banks.filter((b) => !exclude.banks.includes(b)) });
export const BANK_GROUPS = {
  VE: [VE_GROUP, INTL_BANKS, PAY_APPS, CRYPTO],
  US: [
    { title: 'Bancos de Estados Unidos', banks: [
      'Chase', 'Bank of America (BOFA)', 'Wells Fargo', 'Citibank', 'Capital One', 'PNC Bank', 'TD Bank', 'US Bank',
      'Truist', 'Navy Federal', 'Ally Bank', 'Discover', 'Charles Schwab', 'Regions Bank', 'Fifth Third Bank', 'Citizens Bank',
      'BMO', 'Santander Bank', 'Banesco USA', 'Amerant Bank', 'Chime', 'SoFi',
    ] },
    US_APPS, CRYPTO, others(US_APPS), VE_GROUP,
  ],
  ES: [
    { title: 'Bancos de España', banks: [
      'BBVA', 'Banco Santander', 'CaixaBank', 'Banco Sabadell', 'ING', 'Openbank', 'Bankinter', 'Unicaja', 'Abanca', 'Ibercaja',
      'Kutxabank', 'Cajamar', 'EVO Banco', 'Caja Rural', 'Banca March', 'Deutsche Bank España', 'Banco Mediolanum',
      'Self Bank', 'Triodos Bank', 'Pibank', 'Banco Caminos',
    ] },
    ES_APPS, CRYPTO, others(ES_APPS), VE_GROUP,
  ],
  INT: [INTL_BANKS, PAY_APPS, CRYPTO, VE_GROUP],
};

// Lista plana (para los campos con sugerencias): todos los bancos de la región, sin repetir.
export const BANK_SUGGESTIONS = Object.fromEntries(
  Object.entries(BANK_GROUPS).map(([region, groups]) => [region, [...new Set(groups.flatMap((g) => g.banks))]]),
);

// Secciones que se muestran según la moneda de la cuenta, en cualquier país:
// cuentas en Bs. → solo bancos venezolanos; cuentas en divisas → bancos, apps y cripto internacionales
// (con USDT, la cripto va primero).
export function bankGroupsFor(region, currency) {
  const groups = BANK_GROUPS[region] || BANK_GROUPS.VE;
  if (!currency) return groups;
  if (currency === 'VES') return [VE_GROUP];
  const fx = groups.filter((g) => !g.ves);
  return currency === 'USDT' ? [CRYPTO, ...fx.filter((g) => g !== CRYPTO)] : fx;
}

// Compatibilidad
export const VE_BANKS = VE_GROUP.banks;

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

// Categorías propias de cada país, además de las comunes (se insertan antes de "Otros").
// Impuestos: solo como categoría para anotar lo que pagas; la app no calcula impuestos.
export const REGION_CATEGORIES = {
  VE: { expense: [{ name: 'Condominio', emoji: '🏢', color: '#D0F4DE' }], income: [] },
  US: {
    expense: [
      { name: 'Alquiler', emoji: '🔑', color: '#FFD6A5' },
      { name: 'Seguros', emoji: '🛡️', color: '#A0C4FF' },
      { name: 'Impuestos', emoji: '🧾', color: '#E4C1F9' },
    ],
    income: [
      { name: 'Propinas', emoji: '🪙', color: '#FDFFB6' },
      { name: 'Reembolso de impuestos', emoji: '🧾', color: '#E4C1F9' },
    ],
  },
  ES: {
    expense: [
      { name: 'Alquiler', emoji: '🔑', color: '#FFD6A5' },
      { name: 'Comunidad', emoji: '🏢', color: '#D0F4DE' },
      { name: 'Seguros', emoji: '🛡️', color: '#A0C4FF' },
      { name: 'Impuestos', emoji: '🧾', color: '#E4C1F9' },
    ],
    income: [
      { name: 'Devolución de Hacienda', emoji: '🧾', color: '#E4C1F9' },
      { name: 'Ayudas y prestaciones', emoji: '🤝', color: '#D0F4DE' },
    ],
  },
  INT: {
    expense: [
      { name: 'Alquiler', emoji: '🔑', color: '#FFD6A5' },
      { name: 'Seguros', emoji: '🛡️', color: '#A0C4FF' },
      { name: 'Impuestos', emoji: '🧾', color: '#E4C1F9' },
    ],
    income: [],
  },
};

// Categorías que ve una persona según su país: las comunes + las de su país (antes de "Otros").
// `region` puede ser el código ('ES') o el objeto de región (con .code).
export function categoriesFor(region, type = 'expense') {
  const base = CATEGORIES[type] || [];
  const code = typeof region === 'string' ? region : region?.code;
  const extra = (REGION_CATEGORIES[code] || {})[type] || [];
  if (!extra.length) return base;
  const names = new Set(base.map((c) => c.name));
  const add = extra.filter((c) => !names.has(c.name));
  const i = base.findIndex((c) => c.name === 'Otros');
  return i < 0 ? [...base, ...add] : [...base.slice(0, i), ...add, ...base.slice(i)];
}

export const ADJUST_CATEGORY = 'Ajuste de saldo';
const ALL_REGION_CATS = Object.values(REGION_CATEGORIES).flatMap((r) => [...r.expense, ...r.income]);

export function categoryMeta(name, type = 'expense') {
  const all = [...(CATEGORIES[type] || []), ...CATEGORIES.expense, ...CATEGORIES.income, ...CATEGORIES.transfer, ...ALL_REGION_CATS];
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
// Fechas: "hoy" se calcula en la hora del país (Caracas en Venezuela; fuera, la del teléfono,
// o la del país si el teléfono no la da) para que el día no cambie a destiempo.
// ---------------------------------------------------------------------
export let TZ = 'America/Caracas';
export function setTimeZoneFor(code) {
  const r = REGIONS[code] || REGIONS.VE;
  let device = '';
  try { device = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* nada */ }
  const next = code === 'VE' || !REGIONS[code] ? r.tz : device || r.tz || 'America/Caracas';
  try { new Date().toLocaleDateString('en-CA', { timeZone: next }); TZ = next; } catch { TZ = 'America/Caracas'; }
  return TZ;
}
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
