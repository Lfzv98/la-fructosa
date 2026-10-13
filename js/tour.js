// Tour guiado de bienvenida: resalta partes reales de la pantalla de inicio y explica
// cada una en pocas palabras. Se muestra una sola vez (y se puede repetir desde "Aprende").
import { useEffect, useState } from 'react';
import { html, Icon } from './ui.js';
import { usePref } from './store.js';

// Cada paso apunta a un elemento con data-tour="..." (o a un selector). Si el elemento
// no está en pantalla, el paso se muestra igual, en el centro.
function stepsFor(region) {
  const hasRates = Boolean(region?.rates);
  const steps = [
    {
      target: '[data-tour="hero"]',
      emoji: '💰',
      title: 'Todo tu dinero, junto',
      text: hasRates
        ? 'Aquí sumamos todas tus cuentas y te mostramos cuánto tienes en total. Puedes verlo en dólares o en bolívares con un toque.'
        : 'Aquí sumamos todas tus cuentas y te mostramos cuánto tienes en total, en tu moneda de siempre.',
    },
  ];
  if (hasRates) {
    steps.push({
      target: '[data-tour="rates"]',
      emoji: '💱',
      title: 'El dólar de hoy, sin rodeos',
      text: 'Mira el dólar del BCV, el Paralelo y el USDT al mismo tiempo. La "brecha" es solo cuánto más cuesta el dólar en el mercado que en el banco. Si la tocas, ves el detalle.',
    });
  }
  steps.push(
    {
      target: '[data-tour="insight"]',
      emoji: '💡',
      title: 'Consejos de Fructosa',
      text: 'Arriba te aparece un aviso corto cuando hay algo que te conviene saber: si gastas mucho en el mercado, si te acercas a tu tope o si el dólar se movió. ¿Ya lo leíste? Deslízalo hacia arriba o hacia un lado y desaparece.',
    },
    {
      target: '[data-tour="fab"]',
      emoji: '➕',
      title: 'Anota en segundos',
      text: 'Cada vez que pagues o te paguen, toca este botón, escribe el monto y listo. Cuanto antes lo anotes, menos se te olvida.',
    },
    {
      target: '[data-tour="copilot"]',
      emoji: '🎙️',
      title: 'Háblale a Fructosa',
      text: 'Toca el botón de Copiloto, luego el micrófono y háblale como a un amigo: "gasté 15 dólares en el mercado". Ella escribe lo que dices y te ayuda a anotarlo o a entender tus números.',
    },
  );
  return steps;
}

// El mismo paso puede existir dos veces (barra de abajo en el teléfono, barra lateral en la laptop):
// se usa el que está visible.
function visible(selector) {
  if (!selector) return null;
  const all = [...document.querySelectorAll(selector)];
  return all.find((e) => { const r = e.getBoundingClientRect(); return r.width && r.height; }) || all[0] || null;
}

function rectOf(selector) {
  const el = visible(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Tour({ region, onClose }) {
  const steps = stepsFor(region);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  // Medir el elemento de cada paso (y volver a medir si se desplaza la pantalla).
  useEffect(() => {
    let alive = true;
    const el = visible(step.target);
    if (el && !/fab|copilot|insight/.test(step.target)) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const measure = () => { if (alive) setRect(rectOf(step.target)); };
    measure();
    const t = setTimeout(measure, 350);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { alive = false; clearTimeout(t); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [i]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.learn-layer')) onClose(); }; // con una ayuda ⓘ abierta, Esc cierra solo la ayuda
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pad = 8;
  const hole = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  // La tarjeta va arriba si lo resaltado está abajo, y al revés.
  const cardAtTop = hole ? hole.top + hole.height / 2 > window.innerHeight / 2 : false;

  return html`<div class="tour" role="dialog" aria-modal="true" aria-label="Recorrido de bienvenida">
    ${hole
      ? html`<div class="tour-hole" style=${{ top: hole.top + 'px', left: hole.left + 'px', width: hole.width + 'px', height: hole.height + 'px' }}></div>
        <!-- Cuatro paneles tapan todo menos lo resaltado: así los iconos ⓘ de esa zona se pueden tocar -->
        <div class="tour-block" style=${{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) + 'px' }}></div>
        <div class="tour-block" style=${{ top: Math.max(0, hole.top) + hole.height + 'px', left: 0, right: 0, bottom: 0 }}></div>
        <div class="tour-block" style=${{ top: Math.max(0, hole.top) + 'px', left: 0, width: Math.max(0, hole.left) + 'px', height: hole.height + 'px' }}></div>
        <div class="tour-block" style=${{ top: Math.max(0, hole.top) + 'px', left: Math.max(0, hole.left) + hole.width + 'px', right: 0, height: hole.height + 'px' }}></div>`
      : html`<div class="tour-dim"></div>`}
    <div class=${'tour-card ' + (!hole ? 'center' : cardAtTop ? 'top' : 'bottom')} key=${i}>
      <div class="tour-head">
        <span class="tour-emoji" aria-hidden="true">${step.emoji}</span>
        <h2>${step.title}</h2>
        <button type="button" class="icon-btn sm" onClick=${onClose} aria-label="Cerrar recorrido"><${Icon} name="x" size=${18} /></button>
      </div>
      <p>${step.text}</p>
      <div class="tour-foot">
        <div class="dots">${steps.map((_, k) => html`<i key=${k} class=${k === i ? 'on' : ''}></i>`)}</div>
        <div class="row-btns">
          ${i > 0
            ? html`<button type="button" class="btn ghost sm" onClick=${() => setI(i - 1)}>Atrás</button>`
            : html`<button type="button" class="btn ghost sm" onClick=${onClose}>Saltar</button>`}
          <button type="button" class="btn primary sm" onClick=${() => (last ? onClose() : setI(i + 1))}>${last ? '¡Listo!' : 'Siguiente'}</button>
        </div>
      </div>
    </div>
  </div>`;
}

// Decide cuándo mostrar el tour: después del onboarding, una sola vez, en el inicio.
export function useTour() {
  const [done, setDone] = usePref('tour-done', false);
  return [done, setDone];
}
