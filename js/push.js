// Avisos al teléfono (push): pagos fijos por vencer, préstamos y tasas del día.
// La clave pública VAPID la da la Edge Function "send-reminders"; si no está desplegada,
// la opción simplemente no aparece. En iPhone hace falta tener la app instalada en el inicio (iOS 16.4+).
import { api, isDemo } from './api.js';

let config = {};
try { config = await import('./config.js'); } catch { /* sin config */ }
const FN = () => String(config.SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/send-reminders';

export const DEFAULT_PREFS = { bills: true, loans: true, rates: false };

export function pushSupport() {
  if (isDemo || !config.SUPABASE_URL) return 'off';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !standalone ? 'install' : 'unsupported';
  return 'ok';
}

let keyPromise;
export function publicKey() {
  return (keyPromise ??= fetch(FN(), { headers: { apikey: config.SUPABASE_ANON_KEY || '' } })
    .then((r) => (r.ok ? r.json() : {})).then((j) => j.publicKey || null).catch(() => { keyPromise = null; return null; }));
}

const b64ToBytes = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
};

export async function currentSubscription() {
  if (pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) || null;
}

export async function enablePush(prefs = DEFAULT_PREFS) {
  const key = await publicKey();
  if (!key) throw new Error('Los avisos aún no están activados en el servidor.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Para recibir avisos, permite las notificaciones de La Fructosa en tu teléfono.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  const j = sub.toJSON();
  await api.push.save({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, prefs });
  return sub;
}

export async function updatePushPrefs(prefs) {
  const sub = await currentSubscription();
  if (sub) await api.push.update(sub.endpoint, { prefs });
}

// Al apagar los avisos o cerrar sesión: este teléfono deja de recibirlos.
export async function disablePush() {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  await api.push.remove(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
