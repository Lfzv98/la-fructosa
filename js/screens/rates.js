// Tasas del día, su evolución, y calculadora.
import { useMemo, useState } from 'react';
import { html, Icon, Segmented, Chips, toast } from '../ui.js';
import { useData } from '../store.js';
import { Learn } from '../learn.js';
import { Sparkline, LineChart } from '../charts.js';
import { PageHeader, RatesStale } from './common.js';
import { RATE_LABELS, RATE_HELP, fmt, fmtRate, fmtPct, parseAmount, todayISO } from '../money.js';

const KEYS = ['BCV_USD', 'PARALELO', 'USDT', 'BCV_EUR'];
const COLORS = { BCV_USD: '#A0C4FF', PARALELO: '#FFADAD', USDT: '#FDFFB6', BCV_EUR: '#CAFFBF' };

export function Rates() {
  const { rates, rateMeta, rateHistory, actions } = useData();
  const [range, setRange] = useState(30);
  const [open, setOpen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const gap = rates.BCV_USD && rates.PARALELO ? ((rates.PARALELO - rates.BCV_USD) / rates.BCV_USD) * 100 : null;

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

  const series = useMemo(() => {
    const from = new Date(todayISO() + 'T12:00:00Z'); from.setUTCDate(from.getUTCDate() - range);
    const f = from.toISOString().slice(0, 10);
    const s = {};
    for (const r of rateHistory) if (r.rate_date >= f) (s[r.rate_type] ??= []).push(Number(r.rate));
    return s;
  }, [rateHistory, range]);

  return html`<div class="page">
    <${PageHeader} title="Tasas" sub="Bolívares por cada unidad" back="#/mas"
      actions=${html`<button type="button" class=${'icon-btn' + (refreshing ? ' spin' : '')} onClick=${handleRefresh} disabled=${refreshing} aria-label="Actualizar tasas"><${Icon} name="refresh" /></button>`} />

    <${RatesStale} rateMeta=${rateMeta} onRetry=${handleRefresh} />

    ${gap != null && html`<section class="gap-card">
      <div><small>Brecha BCV vs. Paralelo <${Learn} term="brecha" /></small><b>${fmtPct(gap)}</b></div>
      <p>Por cada dólar, el mercado paga <b class="num">Bs. ${fmtRate(rates.PARALELO - rates.BCV_USD)}</b> más que el banco.</p>
    </section>`}

    <div class="rate-grid">
      ${KEYS.map((k) => {
        const s = series[k] || [];
        const chg = s.length > 1 ? ((s[s.length - 1] - s[0]) / s[0]) * 100 : null;
        const m = rateMeta[k];
        return html`<button key=${k} class="rate-card" onClick=${() => setOpen(open === k ? null : k)} style=${{ '--rc': COLORS[k] }}>
          <div class="row-between"><small>${RATE_LABELS[k]}</small>${chg != null && html`<span class=${'chg ' + (chg >= 0 ? 'up' : 'down')}>${chg >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(chg))}</span>`}</div>
          <b class="num">${fmtRate(rates[k])}</b>
          <${Sparkline} points=${s} height=${36} color=${COLORS[k]} />
          <small class="muted">${m ? `${m.rate_date === todayISO() ? 'Hoy' : m.rate_date.split('-').reverse().join('/')} · ${m.source || ''}` : 'Sin datos'}</small>
          ${open === k && html`<p class="rate-help">${RATE_HELP[k]}</p>`}
        </button>`;
      })}
    </div>
    <${Segmented} value=${range} onChange=${setRange} options=${[[7, '7 días'], [30, '30 días'], [90, '90 días']]} />

    <${RateHistory} rateHistory=${rateHistory} />

    <${Converter} rates=${rates} />
  </div>`;
}

function Converter({ rates }) {
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const n = parseAmount(amount) || 0;
  const rows = from === 'VES'
    ? KEYS.filter((k) => rates[k]).map((k) => [RATE_LABELS[k], fmt(n / rates[k], k === 'USDT' ? 'USDT' : k === 'BCV_EUR' ? 'EUR' : 'USD')])
    : KEYS.filter((k) => rates[k] && (from === 'EUR' ? k === 'BCV_EUR' : k !== 'BCV_EUR')).map((k) => [RATE_LABELS[k], fmt(n * rates[k], 'VES')]);
  return html`<section class="card pad stack sm">
    <h2 class="card-title"><${Icon} name="calc" size=${18} /> Calculadora</h2>
    <div class="grid2 wide-first">
      <input class="input num big" inputmode="decimal" value=${amount} onInput=${(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Monto" />
      <${Segmented} value=${from} onChange=${setFrom} options=${[['USD', '$'], ['VES', 'Bs.'], ['EUR', '€']]} />
    </div>
    <div class="list-plain">${rows.map(([l, v]) => html`<div key=${l} class="row-between"><span class="muted">${l}</span><b class="num">${v}</b></div>`)}</div>
  </section>`;
}

// Historial: una tasa a la vez, hasta un año, con mínimo, máximo y cuánto subió.
function RateHistory({ rateHistory }) {
  const [key, setKey] = useState('BCV_USD');
  const [days, setDays] = useState(90);
  const points = useMemo(() => {
    const from = new Date(todayISO() + 'T12:00:00Z'); from.setUTCDate(from.getUTCDate() - days);
    const f = from.toISOString().slice(0, 10);
    const byDay = new Map();
    for (const r of rateHistory) if (r.rate_type === key && r.rate_date >= f) byDay.set(r.rate_date, Number(r.rate));
    return [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
  }, [rateHistory, key, days]);
  const first = points[0]?.value, last = points[points.length - 1]?.value;
  const vals = points.map((p) => p.value);
  const chg = points.length > 1 ? ((last - first) / first) * 100 : null;
  const oldest = points[0]?.date;
  return html`<section class="card pad stack sm rate-history">
    <h2 class="card-title"><${Icon} name="chart" size=${18} /> Historial</h2>
    <${Chips} value=${key} onChange=${setKey} options=${KEYS.map((k) => ({ value: k, label: RATE_LABELS[k].replace(' P2P', '') }))} />
    <${LineChart} points=${points} color=${CHART_COLORS[key]} format=${fmtRate} />
    ${points.length > 1 && html`<div class="hist-stats">
      <div><small>Mínimo</small><b class="num">${fmtRate(Math.min(...vals))}</b></div>
      <div><small>Máximo</small><b class="num">${fmtRate(Math.max(...vals))}</b></div>
      <div><small>Cambio</small><b class=${'num ' + (chg >= 0 ? 'up' : 'down')}>${chg >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(chg))}</b></div>
    </div>`}
    <${Segmented} value=${days} onChange=${setDays} options=${[[30, '1 mes'], [90, '3 meses'], [180, '6 meses'], [365, '1 año']]} />
    ${oldest && days > 30 && oldest > (() => { const d = new Date(todayISO() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - days + 7); return d.toISOString().slice(0, 10); })()
      && html`<p class="hint">Hay datos desde el ${oldest.split('-').reverse().join('/')}: el historial crece cada día que la app guarda las tasas.</p>`}
  </section>`;
}
// Colores con buen contraste en tema claro y oscuro (los pastel de las tarjetas se pierden en una línea fina).
const CHART_COLORS = { BCV_USD: '#3B82F6', PARALELO: '#EF4444', USDT: '#D4A017', BCV_EUR: '#16A34A' };
