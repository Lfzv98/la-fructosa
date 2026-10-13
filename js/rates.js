// Respaldo en vivo: si la BD aún no tiene la tasa de hoy (o el monitor no
// está activo), la app consulta directamente una API pública.
// Solo se usa para mostrar y calcular; la escritura en exchange_rates
// la hace la Edge Function con el rol de servicio (service role).
import { todayISO } from './money.js';

const CACHE_KEY = 'fructosa-live-rates';

export async function fetchLiveRates(force = false) {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < 30 * 60 * 1000 && cached.data?.rates?.USDT) {
        return cached.data;
      }
    } catch { /* sin almacenamiento */ }
  }

  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

  const [dolares, euros, usdtP2p, usdtP2pAlt] = await Promise.allSettled([
    get('https://ve.dolarapi.com/v1/dolares'),
    get('https://ve.dolarapi.com/v1/euros'),
    get('https://criptoya.com/api/binancep2p/usdt/ves'),
    get('https://criptoya.com/api/usdt/ves'),
  ]);

  const rates = {};
  const meta = {};
  const put = (k, v, when, src = 'dolarapi (en vivo)') => {
    const num = Number(v);
    if (!v || isNaN(num) || num <= 0) return;
    rates[k] = Number(num.toFixed(2));
    meta[k] = { rate_type: k, rate: Number(num.toFixed(2)), rate_date: (when || todayISO()).slice(0, 10), source: src };
  };

  if (dolares.status === 'fulfilled' && Array.isArray(dolares.value)) {
    for (const d of dolares.value) {
      const f = String(d.fuente || '').toLowerCase();
      const n = String(d.nombre || '').toLowerCase();
      if (f === 'oficial' || n === 'oficial') put('BCV_USD', d.promedio, d.fechaActualizacion, 'BCV oficial');
      if (f === 'paralelo' || n === 'paralelo') put('PARALELO', d.promedio, d.fechaActualizacion, 'Monitor Paralelo');
      if (f.includes('usdt') || f.includes('binance') || f.includes('bitcoin') || n.includes('usdt') || n.includes('binance')) {
        put('USDT', d.promedio, d.fechaActualizacion, 'USDT P2P');
      }
    }
  }

  if (euros.status === 'fulfilled') {
    const arr = Array.isArray(euros.value) ? euros.value : [euros.value];
    const e = arr.find((x) => x?.fuente === 'oficial') || arr[0];
    if (e?.promedio) put('BCV_EUR', e.promedio, e.fechaActualizacion, 'BCV oficial');
  }

  // Tasa USDT P2P (Binance P2P VES / CriptoYa / Mercado P2P)
  if (!rates.USDT) {
    if (usdtP2p.status === 'fulfilled' && usdtP2p.value) {
      const val = usdtP2p.value;
      const b = Number(val.bid), a = Number(val.ask), p = Number(val.price);
      const price = (b > 0 && a > 0) ? (b + a) / 2 : (b || a || p);
      const date = val.time ? new Date(val.time * 1000).toISOString() : todayISO();
      if (price > 0) put('USDT', price, date, 'Binance P2P (en vivo)');
    }
    if (!rates.USDT && usdtP2pAlt.status === 'fulfilled' && usdtP2pAlt.value) {
      const alt = usdtP2pAlt.value;
      const val = alt.binancep2p || alt.bybitp2p || alt.okexp2p || alt.bitgetp2p;
      if (val) {
        const b = Number(val.bid), a = Number(val.ask), p = Number(val.price);
        const price = (b > 0 && a > 0) ? (b + a) / 2 : (b || a || p);
        const date = val.time ? new Date(val.time * 1000).toISOString() : todayISO();
        if (price > 0) put('USDT', price, date, 'Binance P2P (en vivo)');
      }
    }
    if (!rates.USDT && rates.PARALELO) {
      // Si la API P2P directa no responde, se aproxima con el mercado paralelo.
      put('USDT', Number((rates.PARALELO * 0.995).toFixed(2)), todayISO(), 'Mercado P2P (aprox.)');
    }
  }

  if (!Object.keys(rates).length) return null;
  const data = { rates, meta };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* nada */ }
  return data;
}

// Historial público (DolarApi) para el gráfico mientras la base de datos acumula sus propios días.
// Solo se usa para mostrar; la base de datos manda cuando tiene el dato de ese día.
// Devuelve filas como las de exchange_rates: { rate_type, rate, rate_date, source }.
const HIST_KEY = 'fructosa-rate-history';
const HIST_SOURCES = [
  ['BCV_USD', ['https://ve.dolarapi.com/v1/historicos/dolares/oficial'], 'oficial'],
  ['PARALELO', ['https://ve.dolarapi.com/v1/historicos/dolares/paralelo'], 'paralelo'],
  ['BCV_EUR', ['https://ve.dolarapi.com/v1/historicos/euros/oficial'], 'oficial'],
];

export function parseHistory(list, type, fuente) {
  if (!Array.isArray(list)) return [];
  const byDay = new Map();
  for (const x of list) {
    if (!x || (x.fuente && fuente && String(x.fuente).toLowerCase() !== fuente)) continue;
    const v = Number(x.promedio ?? x.venta ?? x.compra);
    const day = String(x.fecha || x.fechaActualizacion || '').slice(0, 10);
    if (!(v > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    byDay.set(day, { rate_type: type, rate: Number(v.toFixed(4)), rate_date: day, source: 'DolarApi (historial)' });
  }
  return [...byDay.values()];
}

export async function fetchRateHistory() {
  try {
    const cached = JSON.parse(localStorage.getItem(HIST_KEY) || 'null');
    if (cached && Date.now() - cached.at < 12 * 3600e3 && Array.isArray(cached.rows)) return cached.rows;
  } catch { /* sin almacenamiento */ }
  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const parts = await Promise.all(HIST_SOURCES.map(async ([type, urls, fuente]) => {
    for (const u of urls) {
      try { const rows = parseHistory(await get(u), type, fuente); if (rows.length) return rows; } catch { /* siguiente */ }
    }
    return [];
  }));
  const rows = parts.flat();
  if (rows.length) try { localStorage.setItem(HIST_KEY, JSON.stringify({ at: Date.now(), rows })); } catch { /* nada */ }
  return rows;
}
