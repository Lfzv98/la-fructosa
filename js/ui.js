// Componentes base de la interfaz (sin build: React + htm).
import React, { useEffect, useRef, useState } from 'react';
import htm from 'htm';
import { fmt } from './money.js';
import { usePref } from './store.js';
import { ART } from './art.js';

// htm escribe atributos como en HTML (class, stroke-width…); aquí los pasamos a React.
const ATTR = { class: 'className', for: 'htmlFor', autofocus: 'autoFocus', maxlength: 'maxLength', minlength: 'minLength',
  inputmode: 'inputMode', autocomplete: 'autoComplete', autocapitalize: 'autoCapitalize', spellcheck: 'spellCheck', novalidate: 'noValidate', readonly: 'readOnly', tabindex: 'tabIndex' };
function h(type, props, ...children) {
  if (props && typeof type === 'string') {
    for (const k in props) {
      const to = ATTR[k] || (k.includes('-') && !k.startsWith('aria-') && !k.startsWith('data-')
        ? k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null);
      if (to) { props[to] = props[k]; delete props[k]; }
    }
  }
  return React.createElement(type, props, ...children);
}
const bound = htm.bind(h);
// Varias raíces en una plantilla → Fragment (evita avisos de "key").
export const html = (...a) => { const r = bound(...a); return Array.isArray(r) ? React.createElement(React.Fragment, null, ...r) : r; };

// ---------------------------------------------------------------------
// Íconos (trazos estilo Lucide, 24x24)
// ---------------------------------------------------------------------
const I = {
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  up: '<path d="M7 17 17 7M8 7h9v9"/>',
  dn: '<path d="M17 7 7 17M16 17H7V8"/>',
  swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.8 9.8 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.8 9.8 0 0 0 6.7-2.7L21 16"/><path d="M16 16h5v5"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M16 14v4M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  sparkle: '<path d="M12 3 13.9 8.8 20 10.7 14.1 12.6 12 18.4 10.1 12.6 4 10.7 9.9 8.8Z"/><path d="M19 3v4M21 5h-4"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  cloud: '<path d="M17.5 19H7a5 5 0 0 1-.6-10A7 7 0 0 1 20 10.5a4.3 4.3 0 0 1-2.5 8.5z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  scale: '<path d="M16 16l3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1ZM2 16l3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1ZM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>',
  micOff: '<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  volumeX: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>',
};

export function Icon({ name, size = 20, stroke = 2, class: cls = '' }) {
  return html`<svg class=${'ico ' + cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML=${{ __html: I[name] || '' }} />`;
}

export function Logo({ size = 40 }) {
  return html`<img src="icons/icon-192.png" width=${size} height=${size} alt="" class="logo" />`;
}

// ---------------------------------------------------------------------
// Montos (respetan el modo privado "ocultar saldos")
// ---------------------------------------------------------------------
export function Money({ v, c = 'USD', sign = false, class: cls = '', decimals }) {
  const [hide] = usePref('hide', false);
  return html`<span class=${'num ' + cls}>${hide ? '••••' : fmt(v, c, { sign, decimals })}</span>`;
}

// ---------------------------------------------------------------------
// Hoja inferior (bottom sheet) con soporte para el botón "atrás"
// ---------------------------------------------------------------------
const stack = [];
let ignorePop = 0;
window.addEventListener('popstate', () => {
  if (ignorePop > 0) { ignorePop--; return; }
  const top = stack[stack.length - 1];
  if (top) top.close();
});

export function Sheet({ title, onClose, children, footer, size = '' }) {
  const [leaving, setLeaving] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const animateOut = () => { setLeaving(true); setTimeout(() => onCloseRef.current(), 150); };
  useEffect(() => {
    // "Atrás" (Android / gesto iOS) cierra la hoja en vez de salir de la pantalla.
    const me = { close: () => { stack.splice(stack.indexOf(me), 1); animateOut(); } };
    stack.push(me);
    history.pushState({ sheet: stack.length }, '');
    document.body.classList.add('locked');
    return () => {
      const i = stack.indexOf(me);
      if (i >= 0) { stack.splice(i, 1); ignorePop++; history.back(); }
      if (!stack.length) document.body.classList.remove('locked');
    };
  }, []);
  const close = animateOut;

  return html`
    <div class=${'sheet-wrap' + (leaving ? ' out' : '')} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="sheet-backdrop" onClick=${close}></div>
      <div class=${'sheet ' + size}>
        <div class="sheet-grab"></div>
        <header class="sheet-head">
          <h2>${title}</h2>
          <button class="icon-btn" onClick=${close} aria-label="Cerrar"><${Icon} name="x" /></button>
        </header>
        <div class="sheet-body">${typeof children === 'function' ? children(close) : children}</div>
        ${footer && html`<footer class="sheet-foot">${typeof footer === 'function' ? footer(close) : footer}</footer>`}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Avisos (toast) y confirmaciones
// ---------------------------------------------------------------------
export function toast(message, opts = {}) {
  window.dispatchEvent(new CustomEvent('fructosa-toast', { detail: { message, ...opts, id: Math.random() } }));
}

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (e) => {
      const t = e.detail;
      setItems((x) => [...x.slice(-2), t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), t.action ? 5000 : 2600);
    };
    window.addEventListener('fructosa-toast', on);
    return () => window.removeEventListener('fructosa-toast', on);
  }, []);
  return html`<div class="toasts" aria-live="polite">
    ${items.map((t) => html`<div key=${t.id} class=${'toast ' + (t.tone || '')}>
      <span>${t.message}</span>
      ${t.action && html`<button onClick=${() => { t.action.fn(); setItems((x) => x.filter((i) => i.id !== t.id)); }}>${t.action.label}</button>`}
    </div>`)}
  </div>`;
}

export function confirmDialog(opts) {
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent('fructosa-confirm', { detail: { ...opts, resolve } })));
}

export function ConfirmHost() {
  const [c, setC] = useState(null);
  useEffect(() => {
    const on = (e) => setC(e.detail);
    window.addEventListener('fructosa-confirm', on);
    return () => window.removeEventListener('fructosa-confirm', on);
  }, []);
  if (!c) return null;
  const done = (v) => { c.resolve(v); setC(null); };
  return html`<div class="dialog-wrap" role="alertdialog" aria-modal="true">
    <div class="sheet-backdrop" onClick=${() => done(false)}></div>
    <div class="dialog">
      <h3>${c.title}</h3>
      ${c.body && html`<p>${c.body}</p>`}
      <div class="dialog-actions">
        <button class="btn ghost" onClick=${() => done(false)}>${c.cancel || 'Cancelar'}</button>
        <button class=${'btn ' + (c.tone === 'danger' ? 'danger' : 'primary')} onClick=${() => done(true)}>${c.confirm || 'Aceptar'}</button>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------
export function Field({ label, hint, error, children, action }) {
  return html`<label class="field">
    <span class="field-label">${label}${action}</span>
    ${children}
    ${error ? html`<span class="field-error">${error}</span>` : hint && html`<span class="field-hint">${hint}</span>`}
  </label>`;
}

export function Segmented({ value, onChange, options, tone = '' }) {
  return html`<div class=${'seg ' + tone} role="tablist" style=${{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
    ${options.map(([v, label, cls]) => html`<button key=${v} type="button" role="tab" aria-selected=${value === v}
      class=${(value === v ? 'on ' : '') + (cls || '')} onClick=${() => onChange(v)}>${label}</button>`)}
  </div>`;
}

export function Chips({ value, onChange, options }) {
  return html`<div class="chips">
    ${options.map((o) => html`<button key=${o.value} type="button" class=${'chip' + (value === o.value ? ' on' : '')}
      onClick=${() => onChange(o.value)}>${o.emoji && html`<span>${o.emoji}</span>`}${o.label}</button>`)}
  </div>`;
}

export function Switch({ checked, onChange, label, sub }) {
  return html`<button type="button" class="switch-row" role="switch" aria-checked=${checked} onClick=${() => onChange(!checked)}>
    <span><b>${label}</b>${sub && html`<small>${sub}</small>`}</span>
    <span class=${'switch' + (checked ? ' on' : '')}><i></i></span>
  </button>`;
}

// Ilustración financiera de línea fina (ver art.js).
export function Art({ name, size = 88, class: cls = '' }) {
  return html`<svg class=${'art ' + cls} width=${size} height=${size} viewBox="0 0 96 96" fill="none" stroke="currentColor"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML=${{ __html: ART[name] || '' }} />`;
}

export function Empty({ art = 'coins', title, text, action }) {
  return html`<div class="empty">
    <${Art} name=${art} class="empty-art" />
    <h3>${title}</h3>
    ${text && html`<p>${text}</p>`}
    ${action}
  </div>`;
}

export function Progress({ value, tone }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const t = tone || (value >= 1 ? 'bad' : value >= 0.8 ? 'warn' : 'ok');
  return html`<div class=${'progress ' + t}><i style=${{ width: pct + '%' }}></i></div>`;
}

export function Spinner() { return html`<span class="spinner" aria-label="Cargando"></span>`; }

export function SectionTitle({ children, action }) {
  return html`<div class="section-title"><h2>${children}</h2>${action}</div>`;
}

// ---------------------------------------------------------------------
// Banner flotante de consejos (Smart Insight Banner).
// Se descarta deslizándolo hacia arriba o hacia los lados (o con la ✕).
// ---------------------------------------------------------------------
export function SwipeBanner({ emoji, title, text, tone = 'info', action, onAction, onDismiss, tourId }) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [gone, setGone] = useState(null); // { x, y } hacia dónde sale
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const dismiss = (x, y) => {
    if (gone) return;
    vibrate(8);
    setGone({ x, y });
    timer.current = setTimeout(() => onDismiss?.(), 280);
  };

  const onDown = (e) => {
    if (gone || e.target.closest('button, a')) return;
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* nada */ }
  };
  const onMove = (e) => {
    if (!start.current) return;
    // Solo hacia arriba o hacia los lados: hacia abajo no se mueve.
    setDrag({ x: e.clientX - start.current.x, y: Math.min(0, e.clientY - start.current.y) });
  };
  const onUp = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    const { x, y } = drag;
    if (y < -45) dismiss(0, -160);
    else if (Math.abs(x) > 80) dismiss(x > 0 ? 480 : -480, 0);
    else setDrag({ x: 0, y: 0 });
  };

  const live = gone || drag;
  const fade = gone ? 0 : Math.max(0.35, 1 - Math.max(Math.abs(drag.x) / 320, Math.abs(drag.y) / 160));
  const style = {
    transform: `translate(${live.x}px, ${live.y}px) rotate(${(live.x / 40).toFixed(2)}deg)`,
    opacity: fade,
    transition: dragging ? 'none' : 'transform .28s ease, opacity .28s ease',
  };

  return html`<div class=${'insight ' + tone} style=${style} role="status" data-tour=${tourId}
    onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}>
    <span class="insight-emoji" aria-hidden="true">${emoji}</span>
    <div class="insight-body">
      <b>${title}</b>
      <p>${text}</p>
      ${action && html`<button type="button" class="insight-action" onClick=${onAction}>${action.label} <${Icon} name="right" size=${14} /></button>`}
    </div>
    <button type="button" class="insight-x" onClick=${() => dismiss(0, -160)} aria-label="Ocultar consejo"><${Icon} name="x" size=${16} /></button>
    <span class="insight-grip" aria-hidden="true"></span>
  </div>`;
}

// Mensaje legible a partir de errores de Supabase o del navegador.
export function errorText(e) {
  const m = e?.message || String(e || '');
  if (/Invalid login/i.test(m)) return 'Usuario o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Confirma tu correo antes de entrar (revisa tu bandeja).';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene una cuenta. Entra o recupera la contraseña.';
  if (/Password should be/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  if (/row-level security/i.test(m)) return 'Permiso denegado por seguridad (RLS).';
  return m || 'Algo salió mal.';
}

export const vibrate = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* nada */ } };
