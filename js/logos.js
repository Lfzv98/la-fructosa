// Componentes que muestran los logos de brands.js (con vuelta al emoji si la imagen no carga).
import { useState } from 'react';
import { html } from './ui.js';
import { accountLogo, brandId, logoSrc } from './brands.js';

export { accountLogo, brandId };

// <img> del logo; si no carga (sin conexión y nunca visto), vuelve al emoji.
export function Logo({ id, fallback = null, alt = '' }) {
  const [bad, setBad] = useState(false);
  if (!id || bad) return fallback;
  return html`<img class="logo-img" src=${logoSrc(id)} alt=${alt} decoding="async" draggable="false" onError=${() => setBad(true)} />`;
}

// Cuadrito con la imagen de la cuenta (listas, selectores, detalle).
export function AccountIcon({ a, emoji, class: cls = 'acc-ico' }) {
  const id = accountLogo(a);
  const fb = emoji || a?.icon || '💼';
  return html`<span class=${cls + (id ? ' has-logo' : '')}><${Logo} key=${id} id=${id} fallback=${fb} /></span>`;
}

// Cuadrito para movimientos, pagos fijos e inversiones: logo si el texto nombra una marca; si no, el emoji.
export function BrandIcon({ text, emoji, color, banks = false, class: cls = 'tx-ico' }) {
  const id = brandId(text, { banks });
  return html`<span class=${cls + (id ? ' has-logo' : '')} style=${color ? { '--cat': color } : undefined}><${Logo} key=${id} id=${id} fallback=${emoji} /></span>`;
}
