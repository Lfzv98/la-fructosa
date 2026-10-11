// Inicio: patrimonio, tasas, cómo va el mes, pagos próximos y últimos movimientos.
import { useMemo } from 'react';
import { html, Icon, Money, SectionTitle, Empty, Progress, SwipeBanner, toast } from '../ui.js';
import { useData, usePref } from '../store.js';
import { Learn, pickTip, pickInsights } from '../learn.js';
import { AccountRow, TxRow, go, recurringStatus, dueLabel } from './common.js';
import { payRecurring } from './recurring.js';
import { REGIONS, RATE_LABELS, convert, fmtRate, fmtPct, todayISO, monthKey, monthLabel, daysInMonth, consolidate } from '../money.js';

// Una vez descartado un consejo, no sale otro hasta la próxima vez que abras la app.
let INSIGHT_CLOSED_THIS_SESSION = false;

export function Home() {
  const d = useData();
  const { profile, region, rates, rateMeta, active, accById, txs, total, target, val, monthStats, budgets, recurring, actions } = d;
  const [hide, setHide] = usePref('hide', false);
  const ym = monthKey(todayISO());
  const stats = useMemo(() => monthStats(ym), [txs, ym]);
  const savingsRate = stats.income > 0 ? stats.net / stats.income : null;

  const upcoming = recurring.filter((r) => r.is_active !== false).map((r) => ({ r, s: recurringStatus(r, txs) }))
    .filter(({ s }) => s.overdue || s.soon).sort((a, b) => a.s.diff - b.s.diff);

  const budgetRows = budgets.map((b) => {
    const spent = convert(stats.byCat[b.category] || 0, target, b.currency, rates, val) ?? 0;
    return { b, spent, ratio: spent / b.monthly_limit };
  }).sort((a, b) => b.ratio - a.ratio);
  const over = budgetRows.filter((x) => x.ratio >= 1).length;

  const tip = pickTip({ stats, budgetsOver: over, upcoming: upcoming.length, savingsRate, spread: stats.spread,
    hasAccounts: active.length > 0, hasTx: txs.length > 0, regionHasRates: region.rates });

  const altVal = val === 'PARALELO' ? 'BCV_USD' : 'PARALELO';
  const alt = region.rates && rates[altVal] ? consolidate(active, target, rates, altVal).total : null;
  const gap = rates.BCV_USD && rates.PARALELO ? ((rates.PARALELO - rates.BCV_USD) / rates.BCV_USD) * 100 : null;
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Caracas' }));
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const name = (profile.display_name || '').split(' ')[0];

  const setCurrency = (c) => actions.updateProfile({ preferred_currency: c }).catch(() => toast('No se pudo guardar la moneda', { tone: 'bad' }));
  const toggleVal = () => actions.updateProfile({ valuation_rate: altVal }).then(() => toast(`Valorando con ${RATE_LABELS[altVal]}`));
  const dayOfMonth = Number(todayISO().slice(8));
  const monthPct = dayOfMonth / daysInMonth(ym);

  // Banner de consejos: el primero que no hayas descartado. Lo descartado se guarda en el
  // dispositivo; los ids llevan el mes o el día, así que un consejo vuelve solo cuando cambia la situación.
  const [dismissed, setDismissed] = usePref('dismissed-insights', {});
  const insight = useMemo(() => {
    if (INSIGHT_CLOSED_THIS_SESSION) return null;
    const pd = new Date(todayISO() + 'T12:00:00Z'); pd.setUTCDate(1); pd.setUTCMonth(pd.getUTCMonth() - 1);
    const prevStats = monthStats(monthKey(pd.toISOString().slice(0, 10)));
    const seen = dismissed && typeof dismissed === 'object' ? dismissed : {};
    return pickInsights({ stats, prevStats, budgetRows, upcoming: upcoming.length, savingsRate, gap, region, target, ym, today: todayISO(),
      hasAccounts: active.length > 0, hasTx: txs.length > 0 }).find((i) => !seen[i.id]) || null;
  }, [stats, budgets, txs, active.length, upcoming.length, gap, dismissed, target]);
  const closeInsight = (id) => {
    INSIGHT_CLOSED_THIS_SESSION = true;
    setDismissed((old) => {
      const next = { ...(old && typeof old === 'object' ? old : {}), [id]: todayISO() };
      // Limpieza: solo guardamos los últimos 60 consejos descartados.
      const keys = Object.keys(next);
      if (keys.length > 60) keys.sort((a, b) => next[a].localeCompare(next[b])).slice(0, keys.length - 60).forEach((k) => delete next[k]);
      return next;
    });
  };

  return html`<div class="page">
    ${insight && html`<div class="insight-wrap">
      <${SwipeBanner} key=${insight.id} tourId="insight" emoji=${insight.emoji} title=${insight.title} text=${insight.text} tone=${insight.tone}
        action=${insight.action} onAction=${() => go(insight.action.href)} onDismiss=${() => closeInsight(insight.id)} />
    </div>`}
    <header class="home-head">
      <div>
        <p class="eyebrow">${greet}${name ? ',' : ''}</p>
        <h1>${name || 'La Fructosa'}</h1>
      </div>
      <div class="page-actions">
        <button class="icon-btn" onClick=${() => setHide(!hide)} aria-label=${hide ? 'Mostrar saldos' : 'Ocultar saldos'}>
          <${Icon} name=${hide ? 'eyeOff' : 'eye'} />
        </button>
        <button class="avatar" onClick=${() => go('#/ajustes')} aria-label="Ajustes">${(name || 'L')[0].toUpperCase()}</button>
      </div>
    </header>

    <section class="hero" data-tour="hero">
      <div class="hero-top">
        <span class="hero-label">Patrimonio total <${Learn} term="consolidado" /></span>
        <div class="cur-switch">
          ${[...new Set([region.base, ...region.currencies.filter((c) => c !== 'USDT')])].slice(0, 3).map((c) => html`<button key=${c}
            class=${c === target ? 'on' : ''} onClick=${() => setCurrency(c)}>${c}</button>`)}
        </div>
      </div>
      <p class="hero-amount"><${Money} v=${total.total} c=${target} /></p>
      ${region.rates && html`<button class="hero-val" onClick=${toggleVal}>
        Valorado a ${RATE_LABELS[val]} ${alt != null && html`· a ${RATE_LABELS[altVal].replace('Dólar ', '')}: <${Money} v=${alt} c=${target} />`}
        <${Icon} name="swap" size=${14} />
      </button>`}
      ${total.missing && html`<p class="hero-warn">Faltan tasas para convertir algunas cuentas.</p>`}
      <div class="hero-month">
        <div><small>Ingresos ${monthLabel(ym, { month: 'short' })}</small><b class="inc"><${Money} v=${stats.income} c=${target} /></b></div>
        <div><small>Gastos</small><b class="exp"><${Money} v=${stats.expense} c=${target} /></b></div>
        <div><small>Ahorro <${Learn} term="ahorro" /></small><b>${savingsRate == null ? '—' : fmtPct(savingsRate * 100, 0)}</b></div>
      </div>
    </section>

    ${region.rates && html`<button class="rates-strip" data-tour="rates" onClick=${() => go('#/tasas')}>
      ${['BCV_USD', 'PARALELO', 'USDT', 'BCV_EUR'].map((k) => html`<div key=${k} class="rate-mini">
        <small>${RATE_LABELS[k].replace('Dólar ', '').replace(' P2P', '')}</small>
        <b class="num">${fmtRate(rates[k])}</b>
      </div>`)}
      ${gap != null && html`<div class="rate-gap"><small>Brecha</small><b>${fmtPct(gap)}</b></div>`}
      ${rateMeta.BCV_USD && rateMeta.BCV_USD.rate_date < todayISO() && html`<span class="rate-stale">Tasas del ${rateMeta.BCV_USD.rate_date.slice(8)}/${rateMeta.BCV_USD.rate_date.slice(5, 7)}</span>`}
    </button>`}

    <div class="tip">
      <span class="tip-emoji">${tip.emoji}</span>
      <p>${tip.text} ${tip.term && html`<${Learn} term=${tip.term} label="Aprender" />`}</p>
    </div>

    ${upcoming.length > 0 && html`<section>
      <${SectionTitle} action=${html`<a href="#/fijos">Ver todos</a>`}>Pagos próximos<//>
      <div class="card list">
        ${upcoming.slice(0, 3).map(({ r, s }) => html`<div key=${r.id} class="due-row">
          <span class=${'due-dot ' + (s.overdue ? 'bad' : s.diff <= 2 ? 'warn' : 'ok')}></span>
          <span class="tx-main"><b>${r.name}</b><small>${dueLabel(s)} · ${accById[r.account_id]?.name || ''}</small></span>
          <${Money} v=${r.amount} c=${r.currency} />
          <button class="btn sm primary" onClick=${() => payRecurring(r, accById, rates)}>Pagar</button>
        </div>`)}
      </div>
    </section>`}

    ${budgetRows.length > 0 && html`<section>
      <${SectionTitle} action=${html`<a href="#/presupuestos">Ver todos</a>`}>Presupuestos del mes<//>
      <div class="card list pad">
        ${budgetRows.slice(0, 3).map(({ b, spent, ratio }) => html`<div key=${b.id} class="budget-mini">
          <div class="row-between"><span>${b.category}</span><span class="num muted"><${Money} v=${spent} c=${b.currency} /> / <${Money} v=${b.monthly_limit} c=${b.currency} /></span></div>
          <${Progress} value=${ratio} tone=${ratio < 1 && ratio > monthPct + 0.15 ? 'warn' : undefined} />
        </div>`)}
      </div>
    </section>`}

    <section>
      <${SectionTitle} action=${html`<a href="#/cuentas">Gestionar</a>`}>Cuentas<//>
      ${active.length === 0
        ? html`<${Empty} art="bank" title="Crea tu primera cuenta" text="Efectivo, Zelle, Pago Móvil, Binance… cada una con su moneda."
            action=${html`<button class="btn primary" onClick=${() => go('#/cuentas?nueva=1')}>Crear cuenta</button>`} />`
        : html`<div class="card list">${active.map((a) => html`<${AccountRow} key=${a.id} a=${a} target=${target}
            converted=${convert(a.balance, a.currency, target, rates, val)} onClick=${() => go('#/cuenta/' + a.id)} />`)}</div>`}
    </section>

    <section>
      <${SectionTitle} action=${txs.length > 0 && html`<a href="#/movimientos">Ver todos</a>`}>Últimos movimientos<//>
      ${txs.length === 0
        ? html`<${Empty} art="receipt" title="Aún no hay movimientos" text="Toca el botón + para registrar tu primer gasto o ingreso." />`
        : html`<div class="card list">${txs.slice(0, 6).map((t) => html`<${TxRow} key=${t.id} t=${t} accById=${accById} showDate />`)}</div>`}
    </section>
  </div>`;
}
