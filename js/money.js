// Conversión de monedas y calculadora de brecha cambiaria.
// Todas las tasas vienen en VES por 1 unidad de divisa (como en exchange_rates).

export const CURRENCIES = {
  USD:  { label: 'Dólar',    symbol: '$',   decimals: 2 },
  VES:  { label: 'Bolívar',  symbol: 'Bs.', decimals: 2 },
  USDT: { label: 'USDT',     symbol: '₮',   decimals: 2 },
  EUR:  { label: 'Euro',     symbol: '€',   decimals: 2 },
};

export const RATE_LABELS = {
  BCV_USD:  'Dólar BCV',
  BCV_EUR:  'Euro BCV',
  PARALELO: 'Dólar Paralelo',
  USDT:     'USDT',
};

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
