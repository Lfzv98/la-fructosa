// Contenido didáctico: glosario corto, ayudas contextuales y consejos.
import React, { useState } from 'react';
import { html, Icon, Sheet } from './ui.js';

export const GLOSSARY = {
  consolidado: {
    title: 'Saldo consolidado',
    body: [
      'Es la suma de todas tus cuentas convertida a una sola moneda (la que elijas en Ajustes).',
      'Si tienes $100 en Zelle y Bs. 18.000 en Bancamiga, la app convierte los bolívares con la tasa que elegiste (BCV o Paralelo) y te muestra un solo número: tu patrimonio líquido.',
      'Consejo: valora con Paralelo si quieres saber cuántos dólares "reales" tendrías si cambiaras todo hoy.',
    ],
  },
  brecha: {
    title: 'Brecha cambiaria',
    body: [
      'Es la diferencia entre la tasa oficial (BCV) y la del mercado (Paralelo o USDT).',
      'Si el BCV está en 180 y el paralelo en 250, la brecha es de 38,9%. Eso significa que un dólar en la calle compra 38,9% más bolívares que en el banco.',
      'Por eso pagar en bolívares un precio fijado en $ a tasa BCV puede salirte más barato si consigues esos bolívares a tasa paralela, o más caro si te los venden caros.',
    ],
  },
  costoReal: {
    title: 'Costo real de un pago en bolívares',
    body: [
      'Cuando pagas Bs. 3.600 desde una cuenta en dólares, lo que importa es cuántos dólares salieron de verdad de tu bolsillo.',
      'Costo real = bolívares pagados ÷ tasa a la que cambiaste. Precio BCV = bolívares ÷ tasa BCV.',
      'Si el costo real es menor que el precio BCV, la brecha te favoreció (ahorraste). Si es mayor, perdiste en el cambio. La app guarda ambos para que veas cuánto te cuesta o te ahorra la brecha cada mes.',
    ],
  },
  presupuesto: {
    title: 'Presupuesto mensual',
    body: [
      'Un tope de gasto por categoría para cada mes. No bloquea nada: te avisa.',
      'La regla práctica 50/30/20: 50% necesidades (mercado, servicios, alquiler), 30% gustos (salidas, suscripciones) y 20% ahorro.',
      'La barra se pone amarilla al 80% y roja al pasarte. El "ritmo" compara lo gastado con los días que van del mes.',
    ],
  },
  fijos: {
    title: 'Pagos fijos',
    body: [
      'Son gastos que se repiten cada mes el mismo día: alquiler, internet, Netflix, colegio.',
      'La app te avisa cuáles vienen en los próximos días y los registra con un toque cuando los pagas, para que nunca se te olviden ni tengas que escribirlos otra vez.',
    ],
  },
  ahorro: {
    title: 'Tasa de ahorro',
    body: [
      'Es el porcentaje de tus ingresos del mes que no gastaste: (ingresos − gastos) ÷ ingresos.',
      'Por encima de 20% vas muy bien; entre 10% y 20% es sano; por debajo de 10% conviene revisar los gastos más grandes del mes.',
    ],
  },
  transferencia: {
    title: 'Transferencias entre cuentas',
    body: [
      'Mover dinero entre tus propias cuentas no es gasto ni ingreso: tu patrimonio no cambia.',
      'Si las cuentas tienen monedas distintas (Zelle → Pago Móvil), registra cuánto salió y cuánto llegó. La app sugiere el monto con la tasa del día y calcula la tasa a la que cambiaste.',
    ],
  },
  ajuste: {
    title: 'Ajustar saldo',
    body: [
      'Si el saldo de la app no coincide con el de tu banco, escribe el saldo real y la app crea un movimiento de "Ajuste de saldo" por la diferencia.',
      'Así nunca tocas el historial y siempre sabes cuándo y cuánto ajustaste.',
    ],
  },
};

export function Learn({ term, label }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[term];
  if (!g) return null;
  return html`
    <button type="button" class="learn" onClick=${(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
      aria-label=${'¿Qué es ' + g.title + '?'}>
      <${Icon} name="info" size=${15} />${label && html`<span>${label}</span>`}
    </button>
    ${open && html`<${Sheet} title=${g.title} onClose=${() => setOpen(false)}>
      <div class="prose">${g.body.map((p, i) => html`<p key=${i}>${p}</p>`)}</div>
    <//>`}`;
}

// Consejo contextual para el inicio, según cómo va el mes.
export function pickTip({ stats, budgetsOver, upcoming, savingsRate, spread, hasAccounts, hasTx, regionHasRates }) {
  if (!hasAccounts) return { emoji: '👋', text: 'Empieza creando tus cuentas: efectivo, banco, Zelle, Binance… Con el saldo inicial de cada una, la app calcula todo lo demás.', term: 'consolidado' };
  if (!hasTx) return { emoji: '✍️', text: 'Registra tu primer gasto con el botón +. Hacerlo al momento (no al final del día) es el hábito que más ayuda a controlar el dinero.' };
  if (budgetsOver > 0) return { emoji: '🚨', text: `Te pasaste en ${budgetsOver} presupuesto${budgetsOver > 1 ? 's' : ''} este mes. Revisa en Presupuestos dónde se fue el dinero.`, term: 'presupuesto' };
  if (upcoming > 0) return { emoji: '📅', text: `Tienes ${upcoming} pago${upcoming > 1 ? 's' : ''} fijo${upcoming > 1 ? 's' : ''} en los próximos 7 días. Asegúrate de tener saldo en la cuenta correcta.`, term: 'fijos' };
  if (regionHasRates && spread > 0.5) return { emoji: '💱', text: 'Este mes la brecha cambiaria te ha ahorrado dinero al pagar en bolívares. Mira el detalle en Análisis.', term: 'costoReal' };
  if (savingsRate != null && savingsRate < 0.1 && stats.income > 0) return { emoji: '🌱', text: 'Tu tasa de ahorro este mes está por debajo de 10%. Prueba fijar un presupuesto para tu categoría más grande.', term: 'ahorro' };
  if (savingsRate != null && savingsRate >= 0.2) return { emoji: '🏆', text: '¡Vas ahorrando más del 20% de tus ingresos este mes! Considera mover ese excedente a una cuenta separada.', term: 'ahorro' };
  return { emoji: '💡', text: 'Ponle presupuesto a 3 o 4 categorías donde más gastas. Es la forma más simple de ver si el mes va bien.', term: 'presupuesto' };
}
