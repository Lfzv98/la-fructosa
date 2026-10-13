// La Fructosa · Contenido del libro digital (manual.html).
// Solo datos, sin interfaz: arma la lista de bloques del libro para un país.
//   Parte I   · Manual de uso (el mismo contenido de Más › Manual de uso, sin cambios)
//   Parte II  · Preguntas frecuentes (js/faq.js)
//   Parte III · Los 30 mejores tips financieros (js/tips.js)
// El libro (js/flipbook.js) reparte los bloques en páginas según el tamaño de la pantalla.

import { manualFor, BY_REGION, INSTALL_IPHONE, INSTALL_ANDROID, APP_URL, MANUAL_VERSION } from './howToUseIt.js';
import { faqFor } from './faq.js';
import { tipsFor } from './tips.js';
import { glossaryFor } from './glossary.js';
import { REGIONS, regionFor } from './money.js';

export const BOOK_VERSION = 'v39';

// Región del lector: país elegido y, en "Otro país", si usa bolívares (enciende las tasas).
export function bookRegion(code, { rates = false } = {}) {
  const base = REGIONS[code] ? code : 'VE';
  return regionFor(base, rates ? [{ currency: 'VES' }] : []);
}

// Bloques del libro. Cada bloque: { t: tipo, ...datos }. Tipos:
//   part, chapter, h3, p, li, tip, quote, qa, tiphead, how, result, link
export function bookFor(region, { investmentsOn = false } = {}) {
  const B = [];
  const { CORE, MORE, FINANCE_GUIDE } = manualFor(region);
  const mine = BY_REGION[region.code] ? region.code : 'VE';

  // ---------------- Parte I · Manual de uso ----------------
  B.push({ t: 'part', n: 'I', title: 'Manual de uso', sub: `Todo lo que puedes hacer en La Fructosa · ${MANUAL_VERSION}`, emoji: '📖' });

  B.push({ t: 'chapter', title: 'Paso a paso', emoji: '🧭', kicker: 'Las cinco funciones principales' });
  for (const s of CORE) {
    B.push({ t: 'h3', text: `${s.emoji} ${s.title}` });
    B.push({ t: 'p', text: s.intro });
    s.steps.forEach((x, i) => B.push({ t: 'li', n: i + 1, text: x }));
    for (const x of s.tips) B.push({ t: 'tip', text: x });
  }

  B.push({ t: 'chapter', title: 'Guía de finanzas personales', emoji: '🌱', kicker: 'Cómo ver resultados' });
  B.push({ t: 'quote', text: FINANCE_GUIDE.motto });
  B.push({ t: 'p', text: FINANCE_GUIDE.intro });
  for (const x of FINANCE_GUIDE.tips) { B.push({ t: 'h3', text: `${x.emoji} ${x.title}` }); B.push({ t: 'p', text: x.body }); }
  B.push({ t: 'h3', text: 'Tu rutina con La Fructosa' });
  FINANCE_GUIDE.weekly.forEach((x, i) => B.push({ t: 'li', n: i + 1, text: x }));

  B.push({ t: 'chapter', title: 'Más funciones', emoji: '🧰', kicker: 'Explicadas en corto' });
  for (const m of MORE) { B.push({ t: 'h3', text: `${m.emoji} ${m.title}` }); for (const x of m.body) B.push({ t: 'p', text: x }); }

  B.push({ t: 'chapter', title: 'Instalar en tu teléfono', emoji: '📱', kicker: 'Como una app de verdad' });
  B.push({ t: 'h3', text: '📱 iPhone (Safari)' });
  INSTALL_IPHONE.forEach((x, i) => B.push({ t: 'li', n: i + 1, text: x }));
  B.push({ t: 'h3', text: '🤖 Android (Chrome)' });
  INSTALL_ANDROID.forEach((x, i) => B.push({ t: 'li', n: i + 1, text: x }));
  B.push({ t: 'link', label: 'Enlace de la app', href: APP_URL, text: APP_URL.replace('https://', '') });

  B.push({ t: 'chapter', title: 'Según tu país', emoji: REGIONS[mine].flag, kicker: 'Tu edición' });
  B.push({ t: 'h3', text: `${REGIONS[mine].flag} ${BY_REGION[mine].title} · tu país` });
  B.push({ t: 'p', text: BY_REGION[mine].text });
  B.push({ t: 'tip', text: '¿Cambiaste de país? Lo ajustas en Ajustes y las sugerencias se actualizan solas.' });

  B.push({ t: 'chapter', title: 'Palabras que te pueden sonar raras', emoji: '🔤', kicker: 'Glosario' });
  for (const g of Object.values(glossaryFor(region))) { B.push({ t: 'h3', text: g.title }); for (const x of g.body) B.push({ t: 'p', text: x }); }

  // ---------------- Parte II · Preguntas frecuentes ----------------
  const faq = faqFor({ region, investmentsOn });
  const nq = faq.reduce((n, g) => n + g.items.length, 0);
  B.push({ t: 'part', n: 'II', title: 'Preguntas frecuentes', sub: `${nq} respuestas rápidas sobre cómo funciona La Fructosa`, emoji: '💬' });
  for (const g of faq) {
    B.push({ t: 'chapter', title: g.title, emoji: g.emoji, kicker: 'Preguntas frecuentes' });
    for (const it of g.items) B.push({ t: 'qa', q: it.q, a: it.a });
  }

  // ---------------- Parte III · 30 tips ----------------
  const tips = tipsFor(region);
  B.push({ t: 'part', n: 'III', title: `Los ${tips.length} mejores tips financieros`, short: 'Tips financieros', sub: 'Para aplicarlos con la app y ver resultados', emoji: '🏆' });
  B.push({ t: 'chapter', title: 'Antes de empezar', emoji: '🚀', kicker: 'Cómo usar esta parte' });
  B.push({ t: 'p', text: 'Cada tip te dice tres cosas: por qué funciona, dónde hacerlo en La Fructosa y qué resultado vas a ver.' });
  B.push({ t: 'p', text: 'No tienes que aplicarlos todos a la vez. Elige uno por semana, márcalo en tu mente y pásate al siguiente cuando ya sea costumbre. En siete meses los tienes todos.' });
  B.push({ t: 'quote', text: FINANCE_GUIDE.motto });
  B.push({ t: 'chapter', title: `Los ${tips.length} tips`, emoji: '💡', kicker: 'Uno por semana' });
  tips.forEach((x, i) => {
    B.push({ t: 'tiphead', n: i + 1, emoji: x.emoji, title: x.title });
    B.push({ t: 'p', text: x.why });
    B.push({ t: 'how', text: x.how });
    B.push({ t: 'result', text: x.result });
  });
  return B;
}

// Todo el texto de un libro (para pruebas de privacidad por país).
export function bookText(blocks) {
  return blocks.flatMap((b) => [b.title, b.sub, b.kicker, b.text, b.q, ...(b.a || [])].filter(Boolean)).join('\n');
}
