// La Fructosa · Edge Function "update-rates"
// Consulta las tasas del día y las guarda en exchange_rates (VES por unidad).
// Corre con la service role (variable automática en Supabase), que es la única
// con permiso de escritura en esa tabla según las políticas RLS.
//
// Desplegar:  supabase functions deploy update-rates
// Programar:  supabase/migrations/003_tasas_automaticas.sql
import { createClient } from 'jsr:@supabase/supabase-js@2';

type Rate = { rate_type: 'BCV_USD' | 'BCV_EUR' | 'PARALELO' | 'USDT'; rate: number; source: string };

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

async function json(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

// BCV y paralelo (promedio Monitor) desde DolarApi Venezuela.
async function dolarApi(): Promise<Rate[]> {
  const out: Rate[] = [];
  const dolares = await json('https://ve.dolarapi.com/v1/dolares');
  for (const d of dolares) {
    if (d.fuente === 'oficial' && d.promedio) out.push({ rate_type: 'BCV_USD', rate: d.promedio, source: 'dolarapi/bcv' });
    if (d.fuente === 'paralelo' && d.promedio) out.push({ rate_type: 'PARALELO', rate: d.promedio, source: 'dolarapi/paralelo' });
  }
  try {
    const euros = await json('https://ve.dolarapi.com/v1/euros');
    const e = euros.find((x: { fuente: string }) => x.fuente === 'oficial');
    if (e?.promedio) out.push({ rate_type: 'BCV_EUR', rate: e.promedio, source: 'dolarapi/bcv' });
  } catch (_) { /* el euro es opcional */ }
  return out;
}

// USDT: mediana de los 10 primeros anuncios de venta en Binance P2P (VES).
async function binanceUsdt(): Promise<Rate | null> {
  const body = { asset: 'USDT', fiat: 'VES', tradeType: 'SELL', page: 1, rows: 10, payTypes: [], publisherType: null };
  const res = await json('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const prices = (res?.data ?? []).map((a: { adv: { price: string } }) => Number(a.adv.price)).filter((n: number) => n > 0).sort((a: number, b: number) => a - b);
  if (!prices.length) return null;
  return { rate_type: 'USDT', rate: prices[Math.floor(prices.length / 2)], source: 'binance-p2p' };
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const rates: Rate[] = [];
  const errors: string[] = [];

  try { rates.push(...await dolarApi()); } catch (e) { errors.push(String(e)); }
  try {
    const u = await binanceUsdt();
    if (u) rates.push(u);
  } catch (e) { errors.push(String(e)); }
  // Sin USDT: usamos el paralelo como aproximación para no dejar el hueco.
  if (!rates.some((r) => r.rate_type === 'USDT')) {
    const p = rates.find((r) => r.rate_type === 'PARALELO');
    if (p) rates.push({ rate_type: 'USDT', rate: p.rate, source: 'aprox. paralelo' });
  }

  if (!rates.length) return Response.json({ ok: false, errors }, { status: 502 });

  const rows = rates.map((r) => ({ ...r, rate: Number(r.rate.toFixed(4)), rate_date: today(), fetched_at: new Date().toISOString() }));
  const { error } = await supabase.from('exchange_rates').upsert(rows, { onConflict: 'rate_type,rate_date' });
  if (error) return Response.json({ ok: false, error: error.message, errors }, { status: 500 });
  return Response.json({ ok: true, date: today(), rates: rows, errors });
});
