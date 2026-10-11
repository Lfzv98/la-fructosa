// Tasas del día, su evolución, calculadora y comparador "¿pago en $ o en Bs.?".
import { useMemo, useState } from 'react';
import { html, Icon, Segmented, Field, toast } from '../ui.js';
import { useData } from '../store.js';
import { Learn } from '../learn.js';
import { Sparkline } from '../charts.js';
import { PageHeader, RatesStale } from './common.js';
import { RATE_LABELS, RATE_HELP, fmt, fmtRate, fmtPct, parseAmount, payCompare, todayISO } from '../money.js';

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

    <${Converter} rates=${rates} />
    <${Compare} rates=${rates} />
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

function Compare({ rates }) {
  const [price, setPrice] = useState('20');
  const [src, setSrc] = useState('USD');
  const c = payCompare(parseAmount(price), rates, src);
  return html`<section class="card pad stack sm">
    <h2 class="card-title"><${Icon} name="scale" size=${18} /> ¿Pago en divisas o en bolívares?</h2>
    <p class="hint">El comercio marca el precio en $ y acepta Bs. a tasa BCV. Compara cuánto te cuesta realmente cada opción.</p>
    <div class="grid2">
      <${Field} label="Precio en $"><input class="input num" inputmode="decimal" value=${price} onInput=${(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} /><//>
      <${Field} label="Tu respaldo"><${Segmented} value=${src} onChange=${setSrc} options=${[['USD', 'USD'], ['USDT', 'USDT']]} /><//>
    </div>
    ${c && html`<div class="spread">
      <div class="spread-row"><span>Pagando en ${src}</span><b class="num">${fmt(c.costIfUsd, src)}</b></div>
      <div class="spread-row"><span>Pagando Bs. ${fmtRate(c.ves)} (cambiados a ${fmtRate(c.market)})</span><b class="num">${fmt(c.costIfVes, src)}</b></div>
      <div class=${'spread-row verdict ' + (c.saving >= 0 ? 'good' : 'bad')}>
        <span>${c.saving >= 0 ? 'Conviene pagar en bolívares' : 'Conviene pagar en divisas'}</span>
        <b class="num">ahorras ${fmt(Math.abs(c.saving), src)}</b>
      </div>
      <p class="spread-note">Supone que consigues los bolívares a la tasa ${src === 'USDT' ? 'USDT' : 'paralela'}. Si tu banco te los vende a BCV, el costo es el mismo.</p>
    </div>`}
  </section>`;
}
