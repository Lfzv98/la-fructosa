// Comprobantes: la foto del recibo o la captura del pago, enlazada a un movimiento.
// Se reduce en el teléfono (máx. 1280 px, JPG) para que quepan miles en el 1 GB gratis de Supabase.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { html, Icon, toast } from './ui.js';
import { api } from './api.js';

const MAX_SIDE = 1280;
const MAX_BYTES = 600 * 1024;

export async function compressReceipt(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Ese archivo no es una imagen.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo abrir la imagen. Prueba con una foto en JPG o PNG.'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const toBlob = (q) => new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
    let q = 0.8; let blob = await toBlob(q);
    while (blob && blob.size > MAX_BYTES && q > 0.4) { q -= 0.1; blob = await toBlob(q); }
    if (!blob) throw new Error('No se pudo preparar la imagen.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

// Enlace para ver un comprobante guardado (los enlaces de Supabase duran 10 minutos).
export function useReceiptUrl(path) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    let alive = true;
    setError(null);
    api.receipts.url(path).then((u) => alive && setUrl(u), (e) => alive && setError(e));
    return () => { alive = false; };
  }, [path]);
  return { url, error };
}

// Foto a pantalla completa. Toca fuera o la X para cerrar.
export function ReceiptViewer({ src, onClose }) {
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);
  // Fuera de la hoja (portal): así ocupa toda la pantalla aunque la hoja esté animada.
  return createPortal(html`<div class="receipt-viewer" role="dialog" aria-modal="true" aria-label="Comprobante" onClick=${onClose}>
    <img src=${src} alt="Comprobante" onClick=${(e) => e.stopPropagation()} />
    <button class="icon-btn" onClick=${onClose} aria-label="Cerrar"><${Icon} name="x" /></button>
  </div>`, document.body);
}

// Campo del formulario de movimiento.
// value: { path } guardado · { blob, preview } nuevo · null sin comprobante.
export function ReceiptField({ value, onChange, disabled, disabledText }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(false);
  const saved = useReceiptUrl(value?.path);
  const src = value?.preview || saved.url;

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressReceipt(file);
      onChange({ blob, preview: URL.createObjectURL(blob) });
    } catch (err) { toast(err.message || String(err), { tone: 'bad' }); }
    setBusy(false);
  };

  return html`<div class="receipt-field">
    <input ref=${fileRef} type="file" accept="image/*" hidden onChange=${pick} />
    ${value
      ? html`<div class="receipt-thumb">
          <button type="button" class="receipt-img" onClick=${() => src && setView(true)} aria-label="Ver comprobante">
            ${src ? html`<img src=${src} alt="Comprobante" />` : html`<span class="muted">${saved.error ? 'No se pudo cargar' : 'Cargando…'}</span>`}
          </button>
          <div class="receipt-actions">
            <b>Comprobante adjunto</b>
            <small class="muted">${value.blob ? 'Se guarda al registrar' : 'Toca la foto para verla'}</small>
            <div class="row-btns">
              <button type="button" class="btn sm soft" disabled=${disabled || busy} onClick=${() => fileRef.current?.click()}>Cambiar</button>
              <button type="button" class="btn sm ghost danger-text" disabled=${disabled} onClick=${() => onChange(null)}>Quitar</button>
            </div>
          </div>
        </div>`
      : html`<button type="button" class="btn soft block receipt-add" disabled=${disabled || busy} onClick=${() => fileRef.current?.click()}>
          <${Icon} name="camera" size=${18} /> ${busy ? 'Preparando foto…' : 'Adjuntar foto del recibo o captura'}
        </button>`}
    ${disabled && disabledText && html`<small class="muted">${disabledText}</small>`}
    ${view && src && html`<${ReceiptViewer} src=${src} onClose=${() => setView(false)} />`}
  </div>`;
}
