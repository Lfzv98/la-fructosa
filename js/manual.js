// La Fructosa · El libro (manual.html): portada, índice y páginas que se pasan como un libro.
// Página pública: se abre sin iniciar sesión. Desde la app llega con ?desde=app&pais=VE (y tasas/inv).
// El contenido sale de js/book.js; el movimiento de las hojas, de js/flipbook.js.

import { FlipBook } from './flipbook.js';
import { bookFor, bookRegion } from './book.js';
import { REGIONS } from './money.js';
import { APP_URL } from './howToUseIt.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('fructosa-libro-' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fructosa-libro-' + k, JSON.stringify(v)); } catch { /* modo privado */ } },
};

// ---------------- Lector ----------------
const qs = new URLSearchParams(location.search);
const fromApp = qs.get('desde') === 'app';
const inv = fromApp && qs.get('inv') === '1';
let rates = qs.get('tasas') === '1';
let country = REGIONS[qs.get('pais')] ? qs.get('pais') : store.get('pais', null);
if (REGIONS[qs.get('pais')]) store.set('pais', country);
if (!REGIONS[country]) country = null;
let scale = store.get('escala', 1);
let sound = store.get('sonido', true);

// Abierto como archivo (descargado) en vez de desde la web: los enlaces van al sitio oficial.
const SITE = 'https://la-fructosa.vercel.app/';
const ONLINE = /^https?:$/.test(location.protocol);
const APP_LINK = ONLINE ? APP_URL : SITE;
const pdfHref = (c) => `${ONLINE ? './' : SITE}libro/El-libro-de-La-Fructosa-${c}.pdf`;

const ORDER = ['VE', 'ES', 'US', 'INT'];
const ROMAN = { I: 'Parte I', II: 'Parte II', III: 'Parte III' };

// ---------------- Medidas ----------------
function computeLayout() {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const top = $('lb-stage').getBoundingClientRect().top || 56;
  const bottom = 62;
  const phone = vw < 600;
  const availW = vw - (phone ? 16 : 56);
  const availH = vh - top - bottom - (phone ? 10 : 30);
  if (vw >= 900 && vw / vh > 1.1) {
    let H = Math.min(availH, 940);
    let W = Math.min(H * 0.71, availW / 2);
    H = Math.min(H, W / 0.62);
    return { mode: 'spread', W: Math.floor(W), H: Math.floor(H) };
  }
  let W, H;
  if (phone) { W = availW; H = Math.min(availH, W * 1.9); }
  else { H = Math.min(availH, 980); W = Math.min(availW, H * 0.72); }
  return { mode: 'single', W: Math.floor(W), H: Math.floor(H) };
}

// ---------------- Páginas ----------------
const tilesBand = '<div class="pg-tiles" aria-hidden="true"></div>';

function coverPage(mode) {
  const r = country && REGIONS[country];
  const hint = mode === 'spread' ? 'Haz clic en la esquina de la hoja o usa las flechas ← →' : 'Desliza la hoja con el dedo, como un libro';
  const chooser = r
    ? `<p class="cv-ed">Edición ${r.flag} ${esc(r.label)}</p><button class="cv-change" data-act="pais">Cambiar país</button>`
    : `<p class="cv-ask">¿Dónde vives? Así el libro te habla de tus bancos y tu moneda.</p>
       <div class="cv-chips">${ORDER.map((c) => `<button class="cv-chip" data-pais="${c}"><span>${REGIONS[c].flag}</span>${esc(REGIONS[c].label)}</button>`).join('')}</div>`;
  return `<div class="pg pg-cover">
    <div class="cv-cloth" aria-hidden="true"></div>
    <div class="cv-frame" aria-hidden="true"></div>
    <div class="cv-inner">
      <img class="cv-logo" src="./icons/icon-192.png" alt="" width="96" height="96" />
      <p class="cv-kicker">El libro de</p>
      <h1 class="cv-title">La Fructosa</h1>
      <p class="cv-rule" aria-hidden="true"><span></span>✦<span></span></p>
      <p class="cv-sub">Manual de uso<br />Preguntas frecuentes<br />Los 30 mejores tips financieros</p>
      <div class="cv-country">${chooser}</div>
      ${r ? `<p class="cv-hint"><span class="cv-hand" aria-hidden="true">👉</span> ${hint}</p>` : ''}
    </div>
  </div>`;
}

function dedicationPage() {
  return `<div class="pg pg-dedic">
    ${tilesBand}
    <div class="dd-inner">
      <p class="dd-kicker">Introducción</p>
      <p class="dd-text">La llamé <b>La Fructosa</b>.</p>
      <p class="dd-text">Como la casa de los abuelos: donde siempre hubo un lugar para todos.</p>
      <p class="dd-sign">Ahora es una app, para que tus finanzas se sientan como en casa.</p>
    </div>
  </div>`;
}

function partPage(b) {
  return `<div class="pg pg-part">
    ${tilesBand}
    <div class="pt-inner">
      <p class="pt-num">${ROMAN[b.n] || esc(b.n)}</p>
      <div class="pt-medal" aria-hidden="true">${b.emoji}</div>
      <h2 class="pt-title">${esc(b.title)}</h2>
      <p class="pt-sub">${esc(b.sub)}</p>
    </div>
    ${tilesBand.replace('pg-tiles', 'pg-tiles bottom')}
  </div>`;
}

function backCover() {
  return `<div class="pg pg-cover pg-backcover">
    <div class="cv-cloth" aria-hidden="true"></div>
    <div class="cv-frame" aria-hidden="true"></div>
    <div class="cv-inner">
      <p class="cv-kicker">Fin</p>
      <h2 class="cv-title sm">Ahora te toca a ti</h2>
      <p class="cv-rule" aria-hidden="true"><span></span>✦<span></span></p>
      <p class="cv-sub">Elige un tip esta semana, anótalo todo durante 30 días y mira cómo cambian tus números.</p>
      <a class="cv-open" href="${esc(APP_LINK)}" data-noflip>Abrir La Fructosa</a>
      <button class="cv-change" data-act="inicio">Volver a la portada</button>
      <p class="cv-small">Gratis y 100% privada. Cada quien tiene su cuenta.</p>
    </div>
  </div>`;
}

function contentPage(head) {
  const d = document.createElement('div');
  d.className = 'pg pg-content';
  d.innerHTML = `<div class="pg-head"><span>${esc(head.part)}</span><span>${esc(head.chapter)}</span></div><div class="pg-body"></div><div class="pg-foot"><span class="pg-num"></span></div>`;
  return d;
}

const toNode = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// Bloque → nodo. keep = no se queda solo al final de una página; split = se puede partir.
function blockNodes(b) {
  const P = (cls, text) => { const n = toNode(`<p class="${cls}">${esc(text)}</p>`); n._text = text; n._split = true; return n; };
  const keep = (n) => { n.dataset.keep = '1'; return n; };
  switch (b.t) {
    case 'chapter': return [keep(toNode(`<header class="ch"><span class="ch-emoji" aria-hidden="true">${b.emoji}</span><p class="ch-kicker">${esc(b.kicker)}</p><h2 class="ch-title">${esc(b.title)}</h2><span class="ch-orn" aria-hidden="true">❦</span></header>`))];
    case 'h3': return [keep(toNode(`<h3>${esc(b.text)}</h3>`))];
    case 'p': return [P('', b.text)];
    case 'li': { const n = toNode(`<div class="li"><span class="li-n">${b.n}</span><p>${esc(b.text)}</p></div>`); n._text = b.text; n._split = true; n._el = n.querySelector('p'); return [n]; }
    case 'tip': return [toNode(`<p class="tip"><span aria-hidden="true">💡</span> ${esc(b.text)}</p>`)];
    case 'quote': return [toNode(`<blockquote>“${esc(b.text)}”</blockquote>`)];
    case 'link': return [toNode(`<p class="lnk">${esc(b.label)}: <a href="${esc(b.href)}" data-noflip>${esc(b.text)}</a></p>`)];
    case 'qa': return [keep(toNode(`<h4 class="q"><span aria-hidden="true">?</span>${esc(b.q)}</h4>`)), ...b.a.map((x) => P('ans', x))];
    case 'tiphead': return [keep(toNode(`<div class="th"><span class="th-n">${String(b.n).padStart(2, '0')}</span><span class="th-e" aria-hidden="true">${b.emoji}</span><h3>${esc(b.title)}</h3></div>`))];
    case 'how': return [toNode(`<p class="how"><b>En la app</b>${esc(b.text)}</p>`)];
    case 'result': return [toNode(`<p class="res"><b>Lo que verás</b>${esc(b.text)}</p>`)];
    default: return [];
  }
}

// Reparte los bloques en páginas del tamaño actual.
function paginate(blocks, { W, H, mode }) {
  const meas = $('lb-measure');
  meas.style.setProperty('--W', `${W}px`); meas.style.setProperty('--H', `${H}px`);
  meas.style.setProperty('--fs', `${fontSize(W)}px`);
  const content = []; // { node, first, head }
  const toc = [];
  let cur = null, body = null, head = { part: '', chapter: '' };
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  const open = (bi) => {
    cur = contentPage(head); cur.dataset.first = bi;
    meas.replaceChildren(cur); body = cur.querySelector('.pg-body');
    content.push({ node: cur, kind: 'content' });
  };
  const splitInto = (node) => {
    // Cuántas palabras caben al final de la página (búsqueda binaria). Devuelve el resto o null.
    const words = node._text.split(' ');
    if (words.length < 12) return null;
    const el = node._el || node;
    body.append(node);
    let lo = 0, hi = words.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      el.textContent = words.slice(0, mid).join(' ');
      if (fits()) lo = mid; else hi = mid - 1;
    }
    if (lo < 6 || words.length - lo < 4) { node.remove(); el.textContent = node._text; return null; }
    el.textContent = words.slice(0, lo).join(' ');
    el.classList.add('cut');
    const rest = node.cloneNode(true);
    const rel = node._el ? rest.querySelector('p') : rest;
    rel.classList.remove('cut'); rest.classList.add('cont');
    rest._text = words.slice(lo).join(' '); rel.textContent = rest._text; rest._split = true; rest._el = node._el ? rel : null;
    return rest;
  };
  const place = (node, bi) => {
    if (!cur) open(bi);
    body.append(node);
    if (fits()) return;
    node.remove();
    if (node._split) {
      const rest = splitInto(node);
      if (rest) { open(bi); return place(rest, bi); }
    }
    // Los títulos no se quedan solos al pie: se van con el bloque siguiente.
    const carry = [];
    while (body.lastElementChild?.dataset.keep && body.children.length > carry.length + 1) carry.unshift(body.lastElementChild), body.lastElementChild.remove();
    if (!body.children.length) { body.append(...carry, node); return; } // no cabe ni solo
    open(bi);
    body.append(...carry, node);
    if (!fits() && node._split && body.children.length > 1) { node.remove(); const rest = splitInto(node); if (rest) { open(bi); place(rest, bi); } else body.append(node); }
  };

  blocks.forEach((b, bi) => {
    if (b.t === 'part') {
      head = { part: ROMAN[b.n] ? `${ROMAN[b.n]} · ${b.short || b.title}` : b.title, chapter: '' };
      const n = toNode(partPage(b)); n.dataset.first = bi;
      toc.push({ level: 0, label: ROMAN[b.n], title: b.title, emoji: b.emoji, at: content.length });
      content.push({ node: n, kind: 'part' });
      cur = null; return;
    }
    if (b.t === 'chapter') {
      head = { ...head, chapter: b.title };
      toc.push({ level: 1, title: b.title, emoji: b.emoji, at: content.length });
      open(bi);
    }
    for (const n of blockNodes(b)) place(n, bi);
  });
  meas.replaceChildren();
  return { content, toc };
}

const fontSize = (W) => Math.round(Math.max(13.5, Math.min(17, W / 27)) * scale * 10) / 10;

// Índice: se reparte en una o más páginas.
function tocPages(toc, offset, layout) {
  const meas = $('lb-measure');
  const pages = [];
  let cur, list;
  const open = (first) => {
    cur = toNode(`<div class="pg pg-content pg-toc"><div class="pg-head"><span>La Fructosa</span><span>Índice</span></div><div class="pg-body">${first ? '<header class="ch"><span class="ch-emoji" aria-hidden="true">📚</span><p class="ch-kicker">Contenido</p><h2 class="ch-title">Índice</h2><span class="ch-orn" aria-hidden="true">❦</span></header>' : ''}<nav class="toc"></nav></div><div class="pg-foot"><span class="pg-num"></span></div></div>`);
    meas.replaceChildren(cur); list = cur.querySelector('.toc'); pages.push(cur);
  };
  open(true);
  const body = () => cur.querySelector('.pg-body');
  for (const e of toc) {
    const n = e.at + offset;
    const a = toNode(e.level === 0
      ? `<a class="toc-part" href="#p${n}" data-goto="${n}"><span>${esc(e.label)}</span><b>${esc(e.title)}</b><i>${n}</i></a>`
      : `<a class="toc-ch" href="#p${n}" data-goto="${n}"><span aria-hidden="true">${e.emoji}</span><b>${esc(e.title)}</b><em></em><i>${n}</i></a>`);
    list.append(a);
    if (body().scrollHeight > body().clientHeight + 1 && list.children.length > 1) { a.remove(); open(false); list.append(a); }
  }
  meas.replaceChildren();
  return pages;
}

// ---------------- Armar el libro ----------------
const book = new FlipBook($('lb-book'), { onChange: onView, sound: () => sound });
window.libro = book; // para probar desde la consola
let layout = null, pages = [], tocEntries = [], tocOffset = 0, lastFirst = 0;

let forced = null; // tamaño fijo para imprimir el PDF
function build(keepPage = true) {
  layout = forced || computeLayout();
  const region = bookRegion(country || 'VE', { rates });
  const blocks = country ? bookFor(region, { investmentsOn: inv }) : [];
  book.layout(layout);
  $('lb-book').style.setProperty('--fs', `${fontSize(layout.W)}px`);
  $('lb-measure').className = 'lb-measure' + (layout.mode === 'spread' ? ' spread' : '');
  const { content, toc } = paginate(blocks, layout);
  const front = [toNode(coverPage(layout.mode))];
  if (country) front.push(toNode(dedicationPage()));
  // El índice necesita saber cuántas páginas ocupa él mismo: se mide dos veces.
  let tp = country ? tocPages(toc, front.length + 1, layout) : [];
  if (tp.length > 1) tp = tocPages(toc, front.length + tp.length, layout);
  tocOffset = front.length + tp.length;
  tocEntries = toc.map((e) => ({ ...e, page: e.at + tocOffset }));
  const all = [...front, ...tp, ...content.map((c) => c.node)];
  if (country) {
    if (layout.mode === 'spread' && all.length % 2 === 0) all.push(toNode('<div class="pg pg-blank"></div>'));
    all.push(toNode(backCover()));
  }
  all.forEach((p, i) => {
    p.classList.add(i % 2 ? 'odd' : 'even');
    p.dataset.index = i;
    p.id = `p${i}`;
    const num = p.querySelector('.pg-num'); if (num) num.textContent = i;
  });
  pages = all;
  // Mantener la página donde estabas (por el primer bloque que muestra).
  let at = 0;
  if (keepPage && lastFirst > 0) {
    for (let i = 0; i < pages.length; i++) if (pages[i].dataset.first != null && +pages[i].dataset.first <= lastFirst) at = i;
  }
  $('lb-range').max = String(Math.max(0, pages.length - 1));
  book.setPages(pages, at);
  document.body.classList.toggle('no-country', !country);
  const dl = $('lb-dl');
  dl.hidden = !country;
  if (country) { dl.href = pdfHref(country); dl.setAttribute('download', `El libro de La Fructosa (${REGIONS[country].label}).pdf`); }
}

// PDF: todas las páginas, una debajo de otra, del tamaño indicado (lo usa tools/libro-pdf.mjs).
window.libroImprimir = (W, H, code) => {
  forced = { mode: 'single', W, H };
  if (code) { country = code; rates = false; }
  build(false);
  const out = document.createElement('div');
  out.id = 'lb-print';
  out.style.setProperty('--W', `${W}px`); out.style.setProperty('--H', `${H}px`);
  out.style.setProperty('--fs', `${fontSize(W)}px`);
  out.append(...pages);
  document.body.append(out);
  document.body.classList.add('printing');
  return pages.length;
};

function onView() {
  const vis = book.visiblePages();
  const i = vis.length ? vis[vis.length - 1] : 0;
  const first = vis.length ? vis[0] : 0;
  if (pages[first]?.dataset.first != null) lastFirst = +pages[first].dataset.first;
  else if (first < tocOffset) lastFirst = 0;
  const n = pages.length - 1;
  $('lb-count').textContent = first === 0 ? 'Portada' : i >= n && country ? 'Contraportada' : `${vis.filter((x) => pages[x]?.querySelector('.pg-num')).join('–') || first} de ${n}`;
  $('lb-range').value = String(first);
  $('lb-prev').disabled = !book.canGo(-1);
  $('lb-next').disabled = !book.canGo(1);
  // Dónde estás: parte y capítulo.
  const head = pages[first]?.querySelector('.pg-head span:last-child')?.textContent
    || pages[first]?.querySelector('.pt-title')?.textContent || '';
  $('lb-where').textContent = first === 0 ? '' : head;
  if (country) store.set('pagina-' + country, first);
}

// ---------------- Controles ----------------
function toast(msg, ms = 2200) {
  const t = $('lb-toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms);
}

function openSheet() {
  const body = $('lb-sheet-body');
  body.innerHTML = tocEntries.map((e) => e.level === 0
    ? `<button class="sh-part" data-goto="${e.page}"><span>${esc(e.label)}</span><b>${esc(e.title)}</b><i>${e.page}</i></button>`
    : `<button class="sh-ch" data-goto="${e.page}"><span aria-hidden="true">${e.emoji}</span><b>${esc(e.title)}</b><i>${e.page}</i></button>`).join('')
    + `<button class="sh-part" data-goto="0"><span>✦</span><b>Portada</b><i></i></button>`;
  $('lb-sheet').hidden = false;
  body.querySelector('button')?.focus();
}
const closeSheet = () => { $('lb-sheet').hidden = true; };

function setCountry(c) {
  country = c; store.set('pais', c);
  if (c !== 'INT') rates = false;
  lastFirst = 0;
  build(false);
  setTimeout(() => book.next(), 450);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-goto], [data-pais], [data-act], [data-size]');
  if (!t) return;
  e.preventDefault();
  if (t.dataset.goto != null) { closeSheet(); book.goToPage(+t.dataset.goto); return; }
  if (t.dataset.pais) { setCountry(t.dataset.pais); return; }
  if (t.dataset.size) {
    scale = Math.max(0.85, Math.min(1.35, Math.round((scale + 0.1 * +t.dataset.size) * 100) / 100));
    store.set('escala', scale); $('lb-size').textContent = `${Math.round(scale * 100)}%`;
    build(true); return;
  }
  if (t.dataset.act === 'pais') { country = null; store.set('pais', null); build(false); return; }
  if (t.dataset.act === 'inicio') { book.goToPage(0); }
});

$('lb-prev').addEventListener('click', () => book.prev());
$('lb-next').addEventListener('click', () => book.next());
$('lb-range').addEventListener('change', (e) => book.goToPage(+e.target.value));
$('lb-toc').addEventListener('click', () => (country ? openSheet() : toast('Primero elige tu país en la portada')));
$('lb-sheet-x').addEventListener('click', closeSheet);
$('lb-sheet').addEventListener('click', (e) => { if (e.target === $('lb-sheet')) closeSheet(); });
$('lb-text').addEventListener('click', () => { const p = $('lb-pop'); p.hidden = !p.hidden; $('lb-size').textContent = `${Math.round(scale * 100)}%`; });
const paintSound = () => { $('lb-sound').classList.toggle('muted', !sound); $('lb-sound').setAttribute('aria-pressed', String(sound)); };
$('lb-sound').addEventListener('click', () => { sound = !sound; store.set('sonido', sound); paintSound(); toast(sound ? 'Sonido de páginas activado' : 'Sonido de páginas apagado', 1400); });
paintSound();

$('lb-share').addEventListener('click', async () => {
  const base = ONLINE ? location.origin + location.pathname.replace(/manual\.html$/, 'manual') : SITE + 'manual';
  const url = country ? `${base}?pais=${country}` : base;
  const data = { title: 'El libro de La Fructosa', text: 'Manual de uso, preguntas frecuentes y 30 tips financieros de La Fructosa.', url };
  try {
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(url); toast('Enlace copiado');
  } catch { /* cancelado */ }
});

// Volver: a la app si viniste de ahí.
if (!ONLINE) $('lb-home').href = SITE;
$('lb-home').addEventListener('click', (e) => {
  if (fromApp && history.length > 1) { e.preventDefault(); history.back(); }
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') { closeSheet(); $('lb-pop').hidden = true; return; }
  if (!$('lb-sheet').hidden) return;
  if (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); book.next(); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); book.prev(); }
  else if (e.key === 'Home') book.goToPage(0);
  else if (e.key === 'End') book.goToPage(pages.length - 1);
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#lb-pop, #lb-text')) $('lb-pop').hidden = true; });

let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    const next = computeLayout();
    if (layout && next.mode === layout.mode && Math.abs(next.W - layout.W) < 2 && Math.abs(next.H - layout.H) < 2) return;
    build(true);
  }, 180);
});

// ---------------- Arranque ----------------
(document.fonts?.ready || Promise.resolve()).then(() => {
  build(false);
  $('lb-loading').remove();
  const saved = country ? store.get('pagina-' + country, 0) : 0;
  if (saved > 2 && saved < pages.length - 1) {
    const t = $('lb-toast');
    t.innerHTML = `Ibas en la página ${saved}. <button data-goto="${saved}">Seguir leyendo</button>`;
    t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 6000);
  } else if (country) {
    setTimeout(() => book.teaser(), 1100);
  }
});

// Sin internet también se lee (mismo service worker de la app).
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
