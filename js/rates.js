// Respaldo en vivo: si la BD aún no tiene la tasa de hoy (o el monitor no
// está activo), la app consulta directamente una API pública.
// Solo se usa para mostrar y calcular; la escritura en exchange_rates
// la hace la Edge Function con service role.
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
      // Si la API P2P directa no responde, aproximamos con el mercado paralelo
      put('USDT', Number((rates.PARALELO * 0.995).toFixed(2)), todayISO(), 'Mercado P2P (aprox.)');
    }
  }

  if (!Object.keys(rates).length) return null;
  const data = { rates, meta };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* nada */ }
  return data;
}
