// Bloqueo de la app con PIN y, si el teléfono lo permite, Face ID / huella (WebAuthn).
// Es un candado de este dispositivo: se pide al abrir la app y al volver después de un rato.
// El PIN nunca se guarda tal cual: solo su hash PBKDF2 con sal. Se configura en Ajustes.
import { useEffect, useRef, useState } from 'react';
import { html, Icon, Sheet, Field, toast, confirmDialog, vibrate } from './ui.js';

const KEY = (uid) => 'fructosa-lock-' + uid;
const RELOCK_MS = 60 * 1000; // vuelve a pedir el PIN si la app estuvo en segundo plano más de 1 minuto
const MAX_TRIES = 5;

export function readLock(uid) { try { return JSON.parse(localStorage.getItem(KEY(uid))) || null; } catch { return null; } }
function writeLock(uid, cfg) {
  try { cfg ? localStorage.setItem(KEY(uid), JSON.stringify(cfg)) : localStorage.removeItem(KEY(uid)); } catch { /* nada */ }
  window.dispatchEvent(new Event('fructosa-lock'));
}
export const clearLock = (uid) => writeLock(uid, null);

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64u(salt), iterations: 150000 }, key, 256);
  return b64u(bits);
}

export async function biometricAvailable() {
  try { return Boolean(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}

async function createCredential(label) {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: rand(32),
    rp: { name: 'La Fructosa', id: location.hostname },
    user: { id: rand(16), name: label || 'La Fructosa', displayName: label || 'La Fructosa' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000,
    attestation: 'none',
  } });
  return b64u(cred.rawId);
}

async function verifyBiometric(credId) {
  await navigator.credentials.get({ publicKey: {
    challenge: rand(32),
    allowCredentials: [{ type: 'public-key', id: unb64u(credId), transports: ['internal'] }],
    userVerification: 'required',
    timeout: 60000,
    rpId: location.hostname,
  } });
  return true;
}

// ---------------------------------------------------------------------
// Envoltorio: muestra el candado en lugar de la app cuando toca.
// ---------------------------------------------------------------------
export function AppLock({ uid, onSignOut, children }) {
  const [cfg, setCfg] = useState(() => readLock(uid));
  const [locked, setLocked] = useState(() => Boolean(readLock(uid)));
  const hiddenAt = useRef(0);

  useEffect(() => {
    const on = () => { const c = readLock(uid); setCfg(c); if (!c) setLocked(false); };
    window.addEventListener('fructosa-lock', on);
    return () => window.removeEventListener('fructosa-lock', on);
  }, [uid]);

  useEffect(() => {
    const vis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (cfg && hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [cfg]);

  // La app sigue montada debajo (no se pierde lo que estabas haciendo); el candado la tapa por completo.
  return html`<div class="lock-host" aria-hidden=${cfg && locked ? 'true' : undefined} inert=${cfg && locked ? '' : undefined}>${children}</div>
    ${cfg && locked && html`<${LockScreen} cfg=${cfg} onUnlock=${() => setLocked(false)} onSignOut=${onSignOut} />`}`;
}

function PinDots({ value, length = 6 }) {
  return html`<div class="pin-dots" aria-hidden="true">${Array.from({ length }, (_, i) => html`<i key=${i} class=${i < value.length ? 'on' : ''}></i>`)}</div>`;
}

function Keypad({ onKey }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return html`<div class="keypad">${keys.map((k, i) => (k
    ? html`<button key=${i} type="button" class="key" onClick=${() => onKey(k)} aria-label=${k === '⌫' ? 'Borrar' : k}>${k}</button>`
    : html`<span key=${i}></span>`))}</div>`;
}

function LockScreen({ cfg, onUnlock, onSignOut }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [tries, setTries] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [, tick] = useState(0);
  const len = cfg.pinLength || 4;

  useEffect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => { tick((x) => x + 1); if (Date.now() >= waitUntil) { setWaitUntil(0); clearInterval(t); } }, 500);
    return () => clearInterval(t);
  }, [waitUntil]);

  const bio = async () => {
    try { await verifyBiometric(cfg.credId); vibrate(); onUnlock(); } catch { setErr('No se pudo verificar. Usa tu PIN.'); }
  };
  // Algunos teléfonos permiten lanzar Face ID al abrir; si no, queda el botón.
  useEffect(() => { if (cfg.credId) bio(); }, []);

  const press = async (k) => {
    if (waitUntil) return;
    setErr('');
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, len);
    setPin(next);
    if (next.length < len) return;
    if (await hashPin(next, cfg.salt) === cfg.pinHash) { vibrate(); onUnlock(); return; }
    vibrate(60);
    const n = tries + 1;
    setTries(n); setPin('');
    if (n >= MAX_TRIES) { setWaitUntil(Date.now() + 30000); setTries(0); setErr('Demasiados intentos. Espera 30 segundos.'); }
    else setErr(`PIN incorrecto. ${MAX_TRIES - n === 1 ? 'Te queda 1 intento' : `Te quedan ${MAX_TRIES - n} intentos`}.`);
  };

  const forgot = async () => {
    const ok = await confirmDialog({ title: '¿Olvidaste tu PIN?', body: 'Cierra sesión y vuelve a entrar con tu usuario y contraseña. El bloqueo se desactiva en este teléfono y puedes crearlo de nuevo en Ajustes.', confirm: 'Cerrar sesión', tone: 'danger' });
    if (ok) onSignOut();
  };
  const wait = waitUntil ? Math.ceil((waitUntil - Date.now()) / 1000) : 0;

  return html`<main class="lock-screen" role="dialog" aria-modal="true" aria-label="La Fructosa está bloqueada">
    <img src="./icons/icon-192.png" alt="" class="lock-logo" />
    <h1>La Fructosa</h1>
    <p class="muted">${wait ? `Espera ${wait} s` : `Escribe tu PIN de ${len} dígitos`}</p>
    <${PinDots} value=${pin} length=${len} />
    <p class="form-error lock-err" role="alert">${err}</p>
    <${Keypad} onKey=${press} />
    <div class="lock-actions">
      ${cfg.credId && html`<button class="btn soft" onClick=${bio}><${Icon} name="fingerprint" size=${18} /> Face ID / huella</button>`}
      <button class="btn ghost sm" onClick=${forgot}>Olvidé mi PIN</button>
    </div>
  </main>`;
}

// ---------------------------------------------------------------------
// Ajustes: activar, cambiar o quitar el bloqueo
// ---------------------------------------------------------------------
export function LockSettings({ uid, label }) {
  const [cfg, setCfg] = useState(() => readLock(uid));
  const [setup, setSetup] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { biometricAvailable().then(setBioOk); }, []);
  useEffect(() => {
    const on = () => setCfg(readLock(uid));
    window.addEventListener('fructosa-lock', on);
    return () => window.removeEventListener('fructosa-lock', on);
  }, [uid]);

  const off = async () => {
    if (!(await confirmDialog({ title: '¿Quitar el bloqueo?', body: 'La app abrirá sin pedir PIN ni Face ID en este teléfono.', confirm: 'Quitar' }))) return;
    clearLock(uid); toast('Bloqueo desactivado');
  };
  const addBio = async () => {
    try { const credId = await createCredential(label); writeLock(uid, { ...cfg, credId }); toast('Face ID / huella activado'); }
    catch { toast('No se pudo activar Face ID / huella en este teléfono.', { tone: 'bad' }); }
  };

  return html`
    <button class="menu-row" onClick=${() => (cfg ? off() : setSetup(true))}>
      <${Icon} name="shield" /><span>${cfg ? 'Bloqueo activado' : 'Bloquear la app con PIN'}<small>${cfg
        ? `PIN${cfg.credId ? ' y Face ID / huella' : ''} · se pide al abrir y al volver después de 1 minuto · toca para quitarlo`
        : bioOk ? 'Con PIN y Face ID / huella al abrir la app' : 'Pide un PIN al abrir la app'}</small></span>
      <${Icon} name="right" class="muted" />
    </button>
    ${cfg && !cfg.credId && bioOk && html`<button class="menu-row" onClick=${addBio}><${Icon} name="fingerprint" /><span>Usar también Face ID / huella</span><${Icon} name="right" class="muted" /></button>`}
    ${setup && html`<${LockSetup} uid=${uid} label=${label} bioOk=${bioOk} onClose=${() => setSetup(false)} />`}`;
}

function LockSetup({ uid, label, bioOk, onClose }) {
  const [step, setStep] = useState(1);
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [len, setLen] = useState(4);
  const [err, setErr] = useState('');
  const [useBio, setUseBio] = useState(bioOk);
  const [busy, setBusy] = useState(false);

  const finish = async (close, p) => {
    setBusy(true);
    const salt = b64u(rand(16));
    const cfg = { pinHash: await hashPin(p, salt), salt, pinLength: len, credId: null, at: new Date().toISOString() };
    if (useBio) {
      try { cfg.credId = await createCredential(label); } catch { toast('Face ID / huella no se activó; queda solo el PIN.', { tone: 'bad' }); }
    }
    writeLock(uid, cfg);
    toast('Bloqueo activado');
    setBusy(false);
    close();
  };

  return html`<${Sheet} title="Bloquear la app" onClose=${onClose}>
    ${(close) => html`<div class="stack lock-setup">
      <p class="hint">${step === 1 ? 'Elige un PIN que solo tú sepas.' : 'Escríbelo otra vez para confirmar.'} Se pedirá al abrir La Fructosa en este teléfono.</p>
      ${step === 1 && html`<div class="row-btns center">
        ${[4, 6].map((n) => html`<button key=${n} class=${'chip' + (len === n ? ' on' : '')} onClick=${() => { setLen(n); setPin(''); }}>${n} dígitos</button>`)}
      </div>`}
      <${PinDots} value=${pin} length=${len} />
      <p class="form-error lock-err" role="alert">${err}</p>
      <${Keypad} onKey=${async (k) => {
        if (busy) return;
        setErr('');
        if (k === '⌫') return setPin((p) => p.slice(0, -1));
        const next = (pin + k).slice(0, len);
        setPin(next);
        if (next.length < len) return;
        if (step === 1) { setFirst(next); setPin(''); setStep(2); return; }
        if (next !== first) { setErr('Los PIN no coinciden. Empieza de nuevo.'); setPin(''); setFirst(''); setStep(1); return; }
        await finish(close, next);
      }} />
      ${bioOk && html`<label class="check-row"><input type="checkbox" checked=${useBio} onChange=${(e) => setUseBio(e.target.checked)} /> Usar también Face ID / huella</label>`}
    </div>`}
  <//>`;
}
