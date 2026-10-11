// Respaldo en vivo: si la BD aún no tiene la tasa de hoy (o el monitor no
// está activo), la app consulta directamente una API pública.
// Solo se usa para mostrar y calcular; la escritura en exchange_rates
// la hace la Edge Function con service role.
import { todayISO } from './money.js';

const CACHE_KEY = 'fructosa-live-rates';

export async function fetchLiveRates() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.data;
  } catch { /* sin almacenamiento */ }

  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const [dolares, euros] = await Promise.allSettled([
    get('https://ve.dolarapi.com/v1/dolares'),
    get('https://ve.dolarapi.com/v1/euros'),
  ]);
  const rates = {};
  const meta = {};
  const put = (k, v, when) => {
    if (!v) return;
    rates[k] = Number(v);
    meta[k] = { rate_type: k, rate: Number(v), rate_date: (when || todayISO()).slice(0, 10), source: 'dolarapi (en vivo)' };
  };
  if (dolares.status === 'fulfilled') {
    for (const d of dolares.value) {
      if (d.fuente === 'oficial') put('BCV_USD', d.promedio, d.fechaActualizacion);
      if (d.fuente === 'paralelo') put('PARALELO', d.promedio, d.fechaActualizacion);
      if (d.fuente === 'bitcoin' || d.fuente === 'usdt') put('USDT', d.promedio, d.fechaActualizacion);
    }
  }
  if (euros.status === 'fulfilled') {
    const e = euros.value.find((x) => x.fuente === 'oficial') || euros.value[0];
    if (e) put('BCV_EUR', e.promedio, e.fechaActualizacion);
  }
  if (!Object.keys(rates).length) return null;
  const data = { rates, meta };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* nada */ }
  return data;
}
