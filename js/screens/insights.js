// Análisis: a dónde se va el dinero, tendencia de 6 meses y hallazgos automáticos.
import { useMemo, useState } from 'react';
import { html, Icon, Money, Empty, SectionTitle } from '../ui.js';
import { useData } from '../store.js';
import { Learn } from '../learn.js';
import { Donut, Bars } from '../charts.js';
import { PageHeader, TxRow, go } from './common.js';
import { exportMovementsXlsx } from '../backup.js';
import { categoryMeta, fmt, fmtPct, todayISO, monthKey, monthLabel, addMonths, daysInMonth } from '../money.js';

export function Insights() {
  const d = useData();
  const { txs, monthStats, target, accById, region } = d;
  const current = monthKey(todayISO());
  const [ym, setYm] = useState(current);
  const stats = useMemo(() => monthStats(ym), [txs, ym]);
  const prev = useMemo(() => monthStats(addMonths(ym, -1)), [txs, ym]);
  const trend = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const k = addMonths(current, i - 5);
    const s = monthStats(k);
    return { key: k, label: monthLabel(k, { month: 'short' }).replace('.', ''), income: s.income, expense: s.expense };
  }), [txs]);

  const cats = Object.entries(stats.byCat).sort((a, b) => b[1] - a[1]);
  const donut = cats.map(([c, v]) => ({ label: c, value: v, color: categoryMeta(c).color }));
  const isCurrent = ym === current;
  const days = isCurrent ? Number(todayISO().slice(8)) : daysInMonth(ym);
  const daily = stats.expense / days;
  const monthTx = txs.filter((t) => monthKey(t.date) === ym);
  const biggest = monthTx.filter((t) => t.type === 'expense').sort((a, b) => b.value - a.value).slice(0, 5);
  const savings = stats.income > 0 ? (stats.net / stats.income) * 100 : null;

  // Hallazgos en lenguaje natural.
  const findings = [];
  if (prev.expense > 0 && stats.expense > 0) {
    const ch = ((stats.expense - prev.expense) / prev.expense) * 100;
    if (!isCurrent || Math.abs(ch) > 5) findings.push({ e: ch > 0 ? '📈' : '📉', t: `Gastaste ${fmtPct(Math.abs(ch), 0)} ${ch > 0 ? 'más' : 'menos'} que en ${monthLabel(addMonths(ym, -1), { month: 'long' })}${isCurrent ? ' (y el mes aún no termina)' : ''}.` });
  }
  for (const [c, v] of cats.slice(0, 3)) {
    const p = prev.byCat[c] || 0;
    if (p > 0 && v > p * 1.25 && v - p > 10) findings.push({ e: categoryMeta(c).emoji, t: `${c} subió ${fmtPct(((v - p) / p) * 100, 0)} frente al mes anterior.` });
  }
  if (cats[0] && stats.expense > 0) findings.push({ e: '🎯', t: `${cats[0][0]} es tu mayor gasto: ${fmtPct((cats[0][1] / stats.expense) * 100, 0)} del total.` });
  if (region.rates && Math.abs(stats.spread) > 0.01) findings.push({ e: '💱', t: `Al pagar en bolívares, la brecha te ${stats.spread >= 0 ? 'ahorró' : 'costó'} ${fmt(Math.abs(stats.spread), target)} este mes.`, term: 'costoReal' });
  if (savings != null) findings.push({ e: savings >= 20 ? '🏆' : savings >= 10 ? '🌱' : '⚠️', t: `Ahorraste ${fmtPct(savings, 0)} de tus ingresos.`, term: 'ahorro' });

  return html`<div class="page">
    <${PageHeader} title="Análisis" actions=${html`<button class="icon-btn" onClick=${() => exportMovementsXlsx(monthTx, d, ym)} disabled=${!monthTx.length} aria-label="Exportar mes a Excel"><${Icon} name="download" /></button>`} />
    <div class="month-nav">
      <button class="icon-btn" onClick=${() => setYm(addMonths(ym, -1))} aria-label="Mes anterior"><${Icon} name="left" /></button>
      <span class="month-label">${monthLabel(ym)}</span>
      <button class="icon-btn" disabled=${isCurrent} onClick=${() => setYm(addMonths(ym, 1))} aria-label="Mes siguiente"><${Icon} name="right" /></button>
    </div>

    <section class="kpi-grid">
      <div class="kpi"><small>Ingresos</small><b class="inc"><${Money} v=${stats.income} c=${target} /></b></div>
      <div class="kpi"><small>Gastos</small><b class="exp"><${Money} v=${stats.expense} c=${target} /></b></div>
      <div class="kpi"><small>Ahorro <${Learn} term="ahorro" /></small><b class=${stats.net >= 0 ? 'inc' : 'exp'}><${Money} v=${stats.net} c=${target} sign /></b><span class="muted">${savings == null ? '' : fmtPct(savings, 0)}</span></div>
      <div class="kpi"><small>Gasto diario</small><b><${Money} v=${daily} c=${target} /></b><span class="muted">promedio</span></div>
    </section>

    ${findings.length > 0 && html`<section class="card pad stack sm">
      <h2 class="card-title"><${Icon} name="sparkle" size=${18} /> Lo que dicen tus números</h2>
      ${findings.map((f, i) => html`<p key=${i} class="finding"><span>${f.e}</span><span>${f.t} ${f.term && html`<${Learn} term=${f.term} />`}</span></p>`)}
    </section>`}

    <section class="card pad">
      <h2 class="card-title"><${Icon} name="pie" size=${18} /> ¿En qué se fue el dinero?</h2>
      ${cats.length === 0
        ? html`<${Empty} art="growth" title="Sin gastos este mes" />`
        : html`<div class="donut-wrap">
            <${Donut} data=${donut} center=${html`<small>Gastos</small><b class="num"><${Money} v=${stats.expense} c=${target} /></b>`} />
            <ul class="legend-list">${cats.map(([c, v]) => html`<li key=${c}>
              <button onClick=${() => go(`#/movimientos?cat=${encodeURIComponent(c)}&tipo=expense`)}>
                <i style=${{ background: categoryMeta(c).color }}></i><span>${categoryMeta(c).emoji} ${c}</span>
                <b class="num"><${Money} v=${v} c=${target} /></b><small>${fmtPct((v / stats.expense) * 100, 0)}</small>
              </button></li>`)}</ul>
          </div>`}
    </section>

    <section class="card pad">
      <h2 class="card-title"><${Icon} name="chart" size=${18} /> Últimos 6 meses</h2>
      <${Bars} data=${trend} picked=${ym} onPick=${setYm} />
      <div class="legend"><span><i class="inc-bg"></i>Ingresos</span><span><i class="exp-bg"></i>Gastos</span></div>
    </section>

    ${biggest.length > 0 && html`<section>
      <${SectionTitle}>Mayores gastos<//>
      <div class="card list">${biggest.map((t) => html`<${TxRow} key=${t.id} t=${t} accById=${accById} showDate />`)}</div>
    </section>`}
  </div>`;
}
