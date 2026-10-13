// Tasas del día, su evolución, y calculadora.
import { useEffect, useMemo, useState } from 'react';
import { html, Icon, Segmented, Chips, toast } from '../ui.js';
import { useData, usePref } from '../store.js';
import { isDemo } from '../api.js';
import { Learn } from '../learn.js';
import { Sparkline, LineChart } from '../charts.js';
import { fetchRateHistory } from '../rates.js';
import { PageHeader, RatesStale } from './common.js';
import { RATE_LABELS, RATE_HELP, fmt, fmtRate, fmtPct, parseAmount, todayISO } from '../money.js';

const KEYS = ['BCV_USD', 'PARALELO', 'USDT', 'BCV_EUR'];
const COLORS = { BCV_USD: '#A0C4FF', PARALELO: '#FFADAD', USDT: '#FDFFB6', BCV_EUR: '#CAFFBF' };
// Colores con buen contraste en tema claro y oscuro (los pastel de las tarjetas se pierden en una línea fina).
const CHART_COLORS = { BCV_USD: '#3B82F6', PARALELO: '#EF4444', USDT: '#D4A017', BCV_EUR: '#16A34A' };
const RANGES = [[7, '7 días'], [30, '1 mes'], [90, '3 meses'], [180, '6 meses'], [365, '1 año']];

// Nombres de fuente legibles (la base de datos guarda nombres técnicos).
const SOURCE_NAMES = {
  'dolarapi/bcv': 'BCV oficial', 'dolarapi/paralelo': 'Monitor Paralelo', 'binance-p2p': 'Binance P2P',
  'aprox. paralelo': 'Aprox. paralelo', 'DolarApi (historial)': 'DolarApi', 'dolarapi/historial': 'DolarApi',
};

const isoDaysAgo = (n) => { const d = new Date(todayISO() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// "Hoy", "Ayer" o la fecha. El BCV no publica fines de semana ni feriados: su última tasa sigue vigente.
function whenLabel(k, iso) {
  if (iso === todayISO()) return 'Hoy';
  if (iso === isoDaysAgo(1)) return 'Ayer';
  if (k.startsWith('BCV') && iso >= isoDaysAgo(4)) return `Vigente · publicada el ${ddmm(iso)}`;
  return ddmm(iso);
}

export function Rates() {
  const { rates, rateMeta, rateHistory, region, actions } = useData();
  const [open, setOpen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [extra, setExtra] = useState([]);
  const gap = rates.BCV_USD && rates.PARALELO ? ((rates.PARALELO - rates.BCV_USD) / rates.BCV_USD) * 100 : null;

  // Mientras la base de datos tiene pocos días guardados, el gráfico se completa con el historial público.
  const dbDays = useMemo(() => {
    const f = isoDaysAgo(90);
    return rateHistory.filter((r) => r.rate_type === 'BCV_USD' && r.rate_date >= f).length;
  }, [rateHistory]);
  useEffect(() => {
    if (isDemo || !region?.rates || dbDays >= 20 || !navigator.onLine) return;
    let alive = true;
    fetchRateHistory().then((rows) => { if (alive) setExtra(rows); }).catch(() => {});
    return () => { alive = false; };
  }, [dbDays, region?.rates]);

  // Historial combinado por tasa y día: manda la base de datos; luego el historial público;
  // y la tasa que se ve en la tarjeta entra como último punto si ese día aún no está guardado.
  const history = useMemo(() => {
    const by = {};
    const put = (r, from) => {
      const m = (by[r.rate_type] ??= new Map());
      if (!m.has(r.rate_date) && Number(r.rate) > 0) m.set(r.rate_date, { date: r.rate_date, value: Number(r.rate), from });
    };
    for (const r of rateHistory) put(r, 'db');
    for (const r of extra) put(r, 'public');
    for (const k of KEYS) if (rates[k] && rateMeta[k]?.rate_date) put({ rate_type: k, rate: rates[k], rate_date: rateMeta[k].rate_date }, 'live');
    const out = {};
    for (const [k, m] of Object.entries(by)) out[k] = [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [rateHistory, extra, rates, rateMeta]);

  const handleRefresh = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (refreshing) return;
    setRefreshing(true);
    try {
      await actions.refreshRates();
    } catch (e) {
      console.warn('Error en segundo plano al actualizar tasas:', e);
    } finally {
      setRefreshing(false);
    }
  };

  return html`<div class="page rates">
    <${PageHeader} title="Tasas" sub="Bolívares por cada unidad" back="#/mas"
      actions=${html`<button type="button" class=${'icon-btn' + (refreshing ? ' spin' : '')} onClick=${handleRefresh} disabled=${refreshing} aria-label="Actualizar tasas"><${Icon} name="refresh" /></button>`} />

    <${RatesStale} rateMeta=${rateMeta} onRetry=${handleRefresh} />

    ${gap != null && html`<section class="gap-card">
      <div><small>Brecha BCV vs. Paralelo <${Learn} term="brecha" /></small><b>${fmtPct(gap)}</b></div>
      <p>Por cada dólar, el mercado paga <b class="num">Bs. ${fmtRate(rates.PARALELO - rates.BCV_USD)}</b> más que el banco.</p>
    </section>`}

    <div class="rate-grid">
      ${KEYS.map((k) => {
        const pts = (history[k] || []).filter((p) => p.date >= isoDaysAgo(30));
        const week = pts.filter((p) => p.date >= isoDaysAgo(7));
        const chg = week.length > 1 && week[0].value ? ((week[week.length - 1].value - week[0].value) / week[0].value) * 100 : null;
        const m = rateMeta[k];
        return html`<button key=${k} class="rate-card" onClick=${() => setOpen(open === k ? null : k)} style=${{ '--rc': COLORS[k] }}>
          <div class="row-between"><small>${RATE_LABELS[k]}</small>${chg != null && Math.abs(chg) >= 0.05
            && html`<span class=${'chg ' + (chg >= 0 ? 'up' : 'down')} title="Cambio en 7 días">${chg >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(chg))}</span>`}</div>
          <b class="num">${fmtRate(rates[k])}</b>
          <${Sparkline} points=${pts.map((p) => p.value)} height=${36} color=${COLORS[k]} empty="" />
          <small class="muted">${m ? `${whenLabel(k, m.rate_date)} · ${SOURCE_NAMES[m.source] || m.source || ''}` : 'Sin datos'}</small>
          ${open === k && html`<p class="rate-help">${RATE_HELP[k]}</p>`}
        </button>`;
      })}
    </div>

    <div class="rates-split">
      <${RateHistory} history=${history} />
      <${Converter} rates=${rates} />
    </div>
  </div>`;
}

// Historial: una tasa a la vez, de 7 días a un año, con mínimo, máximo y cuánto subió.
function RateHistory({ history }) {
  const [key, setKey] = useState('BCV_USD');
  const [days, setDays] = usePref('rates-range', 30);
  const range = RANGES.some(([d]) => d === days) ? days : 30;
  const points = useMemo(() => (history[key] || []).filter((p) => p.date >= isoDaysAgo(range)), [history, key, range]);
  const first = points[0]?.value, last = points[points.length - 1]?.value;
  const vals = points.map((p) => p.value);
  const chg = points.length > 1 ? ((last - first) / first) * 100 : null;
  const oldest = points[0]?.date;
  const usesPublic = points.some((p) => p.from === 'public');
  const empty = key === 'USDT'
    ? 'El USDT todavía no tiene días guardados. La app lo guarda cada día y la línea aparece desde el segundo.'
    : 'Todavía no hay días guardados para esta tasa. La app los guarda cada día y la línea aparece desde el segundo.';
  return html`<section class="card pad stack sm rate-history">
    <h2 class="card-title"><${Icon} name="chart" size=${18} /> Historial</h2>
    <${Chips} value=${key} onChange=${setKey} options=${KEYS.map((k) => ({ value: k, label: RATE_LABELS[k].replace(' P2P', '') }))} />
    <${Segmented} value=${range} onChange=${setDays} options=${RANGES} />
    <${LineChart} points=${points} color=${CHART_COLORS[key]} format=${fmtRate} empty=${empty} />
    ${points.length > 1 && html`<div class="hist-stats">
      <div><small>Mínimo</small><b class="num">${fmtRate(Math.min(...vals))}</b></div>
      <div><small>Máximo</small><b class="num">${fmtRate(Math.max(...vals))}</b></div>
      <div><small>Cambio</small><b class=${'num ' + (chg >= 0 ? 'up' : 'down')}>${chg >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(chg))}</b></div>
    </div>`}
    ${points.length > 1 && range > 30 && oldest > isoDaysAgo(range - 7)
      && html`<p class="hint">Hay datos desde el ${oldest.split('-').reverse().join('/')}: el historial crece cada día que se guardan las tasas.</p>`}
    ${usesPublic && html`<p class="hint">Los días anteriores vienen del historial público de DolarApi mientras tu base de datos guarda los suyos.</p>`}
  </section>`;
}

// Calculadora: el mismo monto visto con cada tasa. Toca un resultado para copiarlo.
function Converter({ rates }) {
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const n = parseAmount(amount) || 0;
  const r = rates;
  const eurUsd = r.BCV_EUR && r.BCV_USD ? r.BCV_EUR / r.BCV_USD : null; // dólares por euro, cruce BCV
  const rows = [];
  const add = (label, value, cur, note) => { if (value != null && isFinite(value)) rows.push({ label, value, cur, note }); };
  if (from === 'USD') {
    if (r.BCV_USD) add('Dólar BCV', n * r.BCV_USD, 'VES');
    if (r.PARALELO) add('Dólar Paralelo', n * r.PARALELO, 'VES');
    if (r.USDT) add('USDT P2P', n * r.USDT, 'VES', `si son ${fmt(n, 'USDT')}`);
    if (r.BCV_USD && r.PARALELO) add('Diferencia BCV vs. Paralelo', n * (r.PARALELO - r.BCV_USD), 'VES', 'lo que dejas de recibir si te pagan a BCV');
    if (eurUsd) add('En euros', n / eurUsd, 'EUR', 'cruce BCV');
  } else if (from === 'VES') {
    for (const k of KEYS) if (r[k]) add(RATE_LABELS[k], n / r[k], k === 'USDT' ? 'USDT' : k === 'BCV_EUR' ? 'EUR' : 'USD');
  } else {
    if (r.BCV_EUR) add('Euro BCV', n * r.BCV_EUR, 'VES');
    if (eurUsd && r.PARALELO) add('Euro al paralelo', n * eurUsd * r.PARALELO, 'VES', 'aprox., cruce BCV');
    if (eurUsd && r.USDT) add('Euro en USDT', n * eurUsd * r.USDT, 'VES', 'aprox., cruce BCV');
    if (eurUsd) add('En dólares', n * eurUsd, 'USD', 'cruce BCV');
  }
  const copy = async (row) => {
    const text = row.value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    try { await navigator.clipboard.writeText(text); toast('Copiado: ' + text); } catch { /* sin portapapeles */ }
  };
  return html`<section class="card pad stack sm calc">
    <h2 class="card-title"><${Icon} name="calc" size=${18} /> Calculadora</h2>
    <div class="grid2 wide-first">
      <input class="input num big" inputmode="decimal" value=${amount} onInput=${(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Monto" />
      <${Segmented} value=${from} onChange=${setFrom} options=${[['USD', '$'], ['VES', 'Bs.'], ['EUR', '€']]} />
    </div>
    <div class="list-plain calc-rows">${rows.length
      ? rows.map((row) => html`<button type="button" key=${row.label} class="row-between calc-row" onClick=${() => copy(row)} title="Copiar">
          <span class="muted">${row.label}${row.note && html`<small>${row.note}</small>`}</span><b class="num">${fmt(row.value, row.cur)}</b>
        </button>`)
      : html`<p class="hint">Aún no hay tasas para calcular. Toca actualizar arriba.</p>`}</div>
  </section>`;
}
