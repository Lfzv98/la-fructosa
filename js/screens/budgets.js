// Presupuestos mensuales por categoría, con ritmo de gasto y sugerencias.
import { useMemo, useState } from 'react';
import { html, Icon, Money, Sheet, Field, Segmented, Empty, Progress, SectionTitle, toast, confirmDialog, errorText } from '../ui.js';
import { useData } from '../store.js';
import { Learn } from '../learn.js';
import { PageHeader, go } from './common.js';
import { categoriesFor, CURRENCIES, categoryMeta, convert, fmt, parseAmount, todayISO, monthKey, addMonths, daysInMonth, monthLabel } from '../money.js';

export function Budgets() {
  const { budgets, monthStats, target, rates, val, missing, txs } = useData();
  const [form, setForm] = useState(null);
  const ym = monthKey(todayISO());
  const stats = useMemo(() => monthStats(ym), [txs]);
  const day = Number(todayISO().slice(8));
  const dim = daysInMonth(ym);
  const monthPct = day / dim;
  const daysLeft = dim - day + 1;

  // Promedio de los 3 meses anteriores por categoría: base para sugerir topes.
  const avg = useMemo(() => {
    const m = {};
    for (let i = 1; i <= 3; i++) for (const [c, v] of Object.entries(monthStats(addMonths(ym, -i)).byCat)) m[c] = (m[c] || 0) + v / 3;
    return m;
  }, [txs]);

  const rows = budgets.map((b) => {
    const spent = convert(stats.byCat[b.category] || 0, target, b.currency, rates, val) ?? 0;
    const ratio = spent / b.monthly_limit;
    const left = b.monthly_limit - spent;
    return { b, spent, ratio, left, perDay: left > 0 ? left / daysLeft : 0, projected: spent / monthPct };
  }).sort((a, b) => b.ratio - a.ratio);

  const totLimit = rows.reduce((s, r) => s + (convert(r.b.monthly_limit, r.b.currency, target, rates, val) ?? 0), 0);
  const totSpent = rows.reduce((s, r) => s + (convert(r.spent, r.b.currency, target, rates, val) ?? 0), 0);
  const unbudgeted = Object.entries(stats.byCat).filter(([c]) => !budgets.some((b) => b.category === c)).sort((a, b) => b[1] - a[1]);

  if (missing.includes('budgets')) {
    return html`<div class="page"><${PageHeader} title="Presupuestos" back="#/mas" />
      <${Empty} art="database" title="Falta activar los presupuestos" text="Ejecuta el archivo supabase/migrations/002_mejoras.sql en el SQL Editor de Supabase y vuelve a cargar la página." /></div>`;
  }

  return html`<div class="page">
    <${PageHeader} title="Presupuestos" sub=${monthLabel(ym)} back="#/mas" actions=${html`
      <button class="btn sm primary" onClick=${() => setForm({})}><${Icon} name="plus" size=${16} /> Nuevo</button>`} />

    ${rows.length > 0 && html`<section class="card pad stack sm">
      <div class="row-between"><span class="muted">Gastado del total presupuestado <${Learn} term="presupuesto" /></span>
        <span class="num"><b><${Money} v=${totSpent} c=${target} /></b> / <${Money} v=${totLimit} c=${target} /></span></div>
      <${Progress} value=${totSpent / (totLimit || 1)} />
      <div class="month-marker"><i style=${{ left: monthPct * 100 + '%' }}></i><span style=${{ left: monthPct * 100 + '%' }}>Hoy · día ${day}</span></div>
    </section>`}

    ${rows.length === 0
      ? html`<${Empty} art="target" title="Sin presupuestos" text="Define un tope mensual para las categorías en las que más gastas. La app te avisa antes de que te excedas."
          action=${html`<button class="btn primary" onClick=${() => setForm({})}>Crear presupuesto</button>`} />`
      : html`<div class="stack sm">${rows.map(({ b, spent, ratio, left, perDay, projected }) => {
          const meta = categoryMeta(b.category);
          const ahead = ratio < 1 && ratio > monthPct + 0.1;
          return html`<button key=${b.id} class="card pad budget-card" onClick=${() => setForm(b)}>
            <div class="row-between">
              <span class="budget-name"><span class="tx-ico" style=${{ '--cat': meta.color }}>${meta.emoji}</span><b>${b.category}</b></span>
              <span class="num"><b><${Money} v=${spent} c=${b.currency} /></b> <span class="muted">/ <${Money} v=${b.monthly_limit} c=${b.currency} /></span></span>
            </div>
            <${Progress} value=${ratio} tone=${ahead ? 'warn' : undefined} />
            <p class=${'budget-note ' + (ratio >= 1 ? 'bad' : ahead ? 'warn' : 'ok')}>
              ${ratio >= 1 ? html`Te excediste por <b class="num"><${Money} v=${-left} c=${b.currency} /></b>.`
                : ahead ? html`Estás gastando más rápido de lo previsto: a este ritmo cerrarías el mes en <b class="num"><${Money} v=${projected} c=${b.currency} /></b>.`
                : html`Te quedan <b class="num"><${Money} v=${left} c=${b.currency} /></b> · unos <b class="num"><${Money} v=${perDay} c=${b.currency} /></b> por día.`}
            </p>
          </button>`;
        })}</div>`}

    ${unbudgeted.length > 0 && html`<section>
      <${SectionTitle}>Gastos sin presupuesto este mes<//>
      <div class="card list">${unbudgeted.map(([c, v]) => {
        const meta = categoryMeta(c);
        return html`<button key=${c} class="tx-row" onClick=${() => setForm({ category: c, suggest: Math.ceil((avg[c] || v) / 5) * 5 })}>
          <span class="tx-ico" style=${{ '--cat': meta.color }}>${meta.emoji}</span>
          <span class="tx-main"><b>${c}</b><small>Toca para fijar un tope</small></span>
          <span class="tx-amt"><${Money} v=${v} c=${target} /></span>
        </button>`;
      })}</div>
    </section>`}

    ${form && html`<${BudgetForm} budget=${form.id ? form : null} preset=${form} avg=${avg} onClose=${() => setForm(null)} />`}
  </div>`;
}

function BudgetForm({ budget, preset, avg, onClose }) {
  const { budgets, actions, target, region } = useData();
  const editing = Boolean(budget);
  const taken = new Set(budgets.filter((b) => b.id !== budget?.id).map((b) => b.category));
  const cats = categoriesFor(region, 'expense');
  const options = cats.filter((c) => !taken.has(c.name));
  const [category, setCategory] = useState(budget?.category || preset.category || options[0]?.name || '');
  const [currency, setCurrency] = useState(budget?.currency || target);
  const [limit, setLimit] = useState(budget ? String(budget.monthly_limit).replace('.', ',') : preset.suggest ? String(preset.suggest) : '');
  const [err, setErr] = useState('');
  const suggestion = avg[category];

  async function submit(close) {
    const n = parseAmount(limit);
    if (!category) return setErr('Elige una categoría.');
    if (!(n > 0)) return setErr('Escribe un tope mayor que cero.');
    try {
      await actions.save('budgets', { category, currency, monthly_limit: n }, budget?.id);
      close(); toast(editing ? 'Presupuesto actualizado' : `Presupuesto de ${category} creado`);
    } catch (e) { setErr(/duplicate|unique/i.test(e.message) ? 'Ya existe un presupuesto para esa categoría.' : errorText(e)); }
  }
  async function remove(close) {
    if (!(await confirmDialog({ title: `¿Eliminar el presupuesto de ${budget.category}?`, confirm: 'Eliminar', tone: 'danger' }))) return;
    await actions.remove('budgets', budget.id); close(); toast('Presupuesto eliminado');
  }

  return html`<${Sheet} title=${editing ? 'Editar presupuesto' : 'Nuevo presupuesto'} onClose=${onClose}
    footer=${(close) => html`<div class="foot-row">
      ${editing && html`<button class="btn ghost danger-text" onClick=${() => remove(close)}><${Icon} name="trash" size=${18} /></button>`}
      <button class="btn primary grow" onClick=${() => submit(close)}>${editing ? 'Guardar' : 'Crear presupuesto'}</button></div>`}>
    <div class="stack">
      <${Field} label="Categoría">
        <div class="cat-grid">${(editing ? [categoryMeta(category)] : options).map((c) => html`<button key=${c.name} type="button"
          class=${'cat' + (category === c.name ? ' on' : '')} style=${{ '--cat': c.color }} onClick=${() => { setCategory(c.name); setErr(''); }}>
          <span class="cat-emoji">${c.emoji}</span><span class="cat-name">${c.name}</span></button>`)}</div>
      <//>
      <${Field} label="Moneda del tope">
        <${Segmented} value=${currency} onChange=${setCurrency} options=${region.currencies.map((c) => [c, c])} />
      <//>
      <${Field} label="Tope mensual" hint=${suggestion ? `Tu promedio de los últimos 3 meses en ${category} es ${fmt(suggestion, target)}.` : 'Empieza con una cantidad realista; podrás ajustarla después.'}>
        <div class="input-affix"><span>${CURRENCIES[currency].symbol}</span>
          <input class="input num" inputmode="decimal" placeholder="0" value=${limit} onInput=${(e) => { setLimit(e.target.value.replace(/[^\d.,]/g, '')); setErr(''); }} /></div>
      <//>
      ${suggestion > 0 && html`<div class="chips">${[0.9, 1, 1.1].map((k) => {
        const v = Math.ceil((suggestion * k) / 5) * 5;
        return html`<button key=${k} type="button" class="chip" onClick=${() => setLimit(String(v))}>${k < 1 ? 'Ahorrar 10%' : k === 1 ? 'Igual al promedio' : 'Con margen'} · ${fmt(v, target, { decimals: 0 })}</button>`;
      })}</div>`}
      ${err && html`<p class="form-error">${err}</p>`}
    </div>
  <//>`;
}
