// Contenido didáctico: glosario corto, ayudas contextuales y consejos.
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { html, Icon, Sheet } from './ui.js';
import { fmt, fmtPct } from './money.js';
import { useData } from './store.js';
import { GLOSSARY, glossaryFor } from './glossary.js';

export { GLOSSARY, glossaryFor };

export function Learn({ term, label }) {
  const [open, setOpen] = useState(false);
  const { region } = useData() || {};
  const g = glossaryFor(region)[term];
  if (!g) return null;
  return html`
    <button type="button" class="learn" onClick=${(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
      aria-label=${'¿Qué es ' + g.title + '?'}>
      <${Icon} name="info" size=${15} />${label && html`<span>${label}</span>`}
    </button>
    ${open && createPortal(
      // La ventana se dibuja en <body>, fuera de la tarjeta donde está el ⓘ: así ninguna tarjeta, recorrido
      // ni pantalla de bienvenida la tapa. El div frena los toques para que no lleguen a la tarjeta de abajo.
      html`<div class="learn-layer" onClick=${(e) => e.stopPropagation()}>
        <${Sheet} title=${g.title} onClose=${() => setOpen(false)}>
          <div class="prose">${g.body.map((p, i) => html`<p key=${i}>${p}</p>`)}</div>
        <//>
      </div>`,
      document.body,
    )}`;
}

// Consejo contextual para el inicio, según cómo va el mes.
export function pickTip({ stats, budgetsOver, upcoming, savingsRate, spread, hasAccounts, hasTx, regionHasRates, examples }) {
  if (!hasAccounts) return { emoji: '👋', text: `Empieza creando tus cuentas: ${examples || 'efectivo, banco, apps de pago…'} Con el saldo inicial de cada una, la app calcula todo lo demás.`, term: 'consolidado' };
  if (!hasTx) return { emoji: '✍️', text: 'Registra tu primer gasto con el botón +. Hacerlo al momento (no al final del día) es el hábito que más ayuda a controlar el dinero.' };
  if (budgetsOver > 0) return { emoji: '🚨', text: `Te pasaste en ${budgetsOver} presupuesto${budgetsOver > 1 ? 's' : ''} este mes. Revisa en Presupuestos dónde se fue el dinero.`, term: 'presupuesto' };
  if (upcoming > 0) return { emoji: '📅', text: `Tienes ${upcoming} pago${upcoming > 1 ? 's' : ''} fijo${upcoming > 1 ? 's' : ''} en los próximos 7 días. Asegúrate de tener saldo en la cuenta correcta.`, term: 'fijos' };
  if (regionHasRates && spread > 0.5) return { emoji: '💱', text: 'Este mes la brecha cambiaria te ha ahorrado dinero al pagar en bolívares. Mira el detalle en Análisis.', term: 'costoReal' };
  if (savingsRate != null && savingsRate < 0.1 && stats.income > 0) return { emoji: '🌱', text: 'Tu tasa de ahorro este mes está por debajo del 10%. Prueba a fijar un presupuesto para tu categoría más grande.', term: 'ahorro' };
  if (savingsRate != null && savingsRate >= 0.2) return { emoji: '🏆', text: '¡Vas ahorrando más del 20% de tus ingresos este mes! Considera mover ese excedente a una cuenta separada.', term: 'ahorro' };
  return { emoji: '💡', text: 'Ponle presupuesto a 3 o 4 categorías en las que más gastas. Es la forma más simple de ver si el mes va bien.', term: 'presupuesto' };
}

// ---------------------------------------------------------------------
// Consejos del banner flotante (Fructosa). Devuelve una lista ordenada por
// importancia; el inicio muestra el primero que el usuario no haya descartado.
// Cada consejo lleva un id estable (con el mes o el día) para no repetirlo.
// ---------------------------------------------------------------------
const WATCH_CATS = [
  ['Mercado', '🛒', 'el mercado'],
  ['Comida', '🍔', 'la comida'],
  ['Salidas', '🎉', 'las salidas'],
];

export function pickInsights({ stats, prevStats, budgetRows = [], upcoming = 0, savingsRate, gap, region, target, ym, today, hasAccounts, hasTx }) {
  const out = [];
  const money = (v) => fmt(v, target);

  if (!hasAccounts) {
    out.push({ id: 'start-accounts', emoji: '👋', tone: 'info', title: 'Empecemos por tus cuentas',
      text: 'Crea las cuentas donde guardas tu dinero (efectivo, banco, apps de pago) y yo hago los cálculos por ti.', action: { label: 'Crear cuentas', href: '#/cuentas?nueva=1' } });
    return out;
  }
  if (!hasTx) {
    out.push({ id: 'start-first-tx', emoji: '✍️', tone: 'info', title: 'Anota tu primer gasto',
      text: 'Toca el botón + y cuéntame en qué gastaste. Hacerlo al momento es lo que más ayuda.' });
  }

  // 1) Presupuestos: pasados o a punto de pasarse.
  const over = budgetRows.find((x) => x.ratio >= 1);
  if (over) {
    out.push({ id: `bud-over-${over.b.category}-${ym}`, emoji: '🚨', tone: 'bad', title: `Te pasaste en ${over.b.category}`,
      text: `Ya superaste el tope que pusiste para ${over.b.category.toLowerCase()} este mes. Échale un vistazo para frenar a tiempo.`, action: { label: 'Ver presupuestos', href: '#/presupuestos' } });
  }
  const near = budgetRows.find((x) => x.ratio >= 0.8 && x.ratio < 1);
  if (near) {
    out.push({ id: `bud-near-${near.b.category}-${ym}`, emoji: '⚠️', tone: 'warn', title: `Cuidado con ${near.b.category}`,
      text: `Ya llevas el ${Math.round(near.ratio * 100)}% de tu tope en ${near.b.category.toLowerCase()}. Todavía hay tiempo de ajustar.`, action: { label: 'Ver presupuestos', href: '#/presupuestos' } });
  }

  // 2) Mercado, comida y salidas: más que el mes pasado.
  for (const [cat, emoji, label] of WATCH_CATS) {
    const cur = stats.byCat[cat] || 0;
    const prev = prevStats?.byCat?.[cat] || 0;
    if (prev > 0 && cur > prev * 1.25) {
      const pct = Math.round((cur / prev - 1) * 100);
      out.push({ id: `cat-up-${cat}-${ym}`, emoji, tone: 'warn', title: `Estás gastando más en ${label}`,
        text: `Este mes llevas ${money(cur)} en ${cat.toLowerCase()}, un ${pct}% más que todo el mes pasado. ¿Le damos un vistazo?`, action: { label: 'Ver movimientos', href: '#/movimientos' } });
      break;
    }
  }
  const eatOut = (stats.byCat.Comida || 0) + (stats.byCat.Salidas || 0);
  if (stats.expense > 0 && eatOut / stats.expense > 0.35) {
    out.push({ id: `eatout-share-${ym}`, emoji: '🍽️', tone: 'warn', title: 'Mucho en comida y salidas',
      text: `Entre comida y salidas se te va el ${Math.round((eatOut / stats.expense) * 100)}% de lo que gastas. Cocinar un par de días más en casa puede darte un respiro.` });
  }

  // 3) Pagos fijos cerca.
  if (upcoming > 0) {
    out.push({ id: `due-${today}`, emoji: '📅', tone: 'warn', title: upcoming === 1 ? 'Tienes un pago por vencer' : `Tienes ${upcoming} pagos por vencer`,
      text: 'Revisa que tengas saldo en la cuenta con la que vas a pagar para que no te tome por sorpresa.', action: { label: 'Ver pagos', href: '#/fijos' } });
  }

  // 4) Dólar BCV vs mercado (solo Venezuela).
  if (region?.rates && gap != null && gap >= 10) {
    out.push({ id: `gap-${today}`, emoji: '💱', tone: 'info', title: 'El dólar del mercado está más caro',
      text: `Hoy el dólar del mercado cuesta un ${fmtPct(gap, 0)} más que el del BCV. Antes de cambiar o pagar en bolívares, compara en Tasas.`, action: { label: 'Ver tasas', href: '#/tasas' } });
  }

  // 5) Ahorro.
  if (savingsRate != null && stats.income > 0) {
    if (savingsRate >= 0.2) {
      out.push({ id: `save-great-${ym}`, emoji: '🏆', tone: 'good', title: '¡Vas muy bien!',
        text: `Este mes te está quedando el ${Math.round(savingsRate * 100)}% de lo que ganas. Si puedes, aparta ese ahorro en una cuenta aparte.` });
    } else if (savingsRate < 0.1) {
      out.push({ id: `save-low-${ym}`, emoji: '🌱', tone: 'info', title: 'Te queda poco este mes',
        text: 'Ahorraste menos del 10% de lo que ganaste. Mira tu categoría más grande: ahí suele estar la mejor oportunidad.', action: { label: 'Ver análisis', href: '#/analisis' } });
    }
  }

  // 6) Ideas generales cuando no hay alertas.
  if (!budgetRows.length) {
    out.push({ id: 'tip-budget', emoji: '🎯', tone: 'info', title: 'Ponle tope a lo que más gastas',
      text: 'Elige 3 o 4 categorías (mercado, salidas…) y fija cuánto quieres gastar al mes. Yo te aviso antes de que te pases.', action: { label: 'Crear presupuesto', href: '#/presupuestos' } });
  }
  out.push({ id: 'tip-voice', emoji: '🎙️', tone: 'info', title: 'Háblale a Fructosa',
    text: 'Toca el micrófono en el chat y dile, por ejemplo: "gasté 20 dólares en comida". Yo lo anoto contigo.', action: { label: 'Abrir chat', href: '#/copiloto' } });
  return out;
}
