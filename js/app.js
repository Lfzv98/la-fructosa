// La Fructosa · punto de entrada: sesión, rutas, navegación y servicios globales.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { html, Icon, ToastHost, ConfirmHost, Spinner, errorText } from './ui.js';
import { api, isDemo } from './api.js';
import { DataProvider, useData, usePref } from './store.js';
import { AuthScreen, CompleteProfile } from './screens/auth.js';
import { Home } from './screens/home.js';
import { Movements } from './screens/movements.js';
import { Accounts, AccountDetail } from './screens/accounts.js';
import { Budgets } from './screens/budgets.js';
import { Recurring } from './screens/recurring.js';
import { Rates } from './screens/rates.js';
import { Insights } from './screens/insights.js';
import { More, Settings, LearnPage, PasswordSheet } from './screens/settings.js';
import { Onboarding } from './screens/onboarding.js';
import { TxForm } from './screens/txform.js';
import { Copilot } from './screens/copilot.js';

// ---------------------------------------------------------------------
// Rutas por hash (#/movimientos): funcionan en GitHub Pages y con "atrás".
// ---------------------------------------------------------------------
function parseHash() {
  const h = location.hash.startsWith('#/') ? location.hash.slice(2) : '';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'inicio', param: parts[1], query: new URLSearchParams(qs || ''), key: h };
}
function useRoute() {
  const [r, setR] = useState(parseHash);
  useEffect(() => {
    const on = () => { setR(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

const TABS = [
  ['inicio', 'home', 'Inicio'],
  ['movimientos', 'list', 'Movimientos'],
  ['nuevo', 'plus', 'Nuevo'],
  ['analisis', 'pie', 'Análisis'],
  ['mas', 'grid', 'Más'],
];
const TAB_OF = { cuentas: 'mas', cuenta: 'mas', presupuestos: 'mas', fijos: 'mas', tasas: 'mas', ajustes: 'mas', aprende: 'mas' };

function TabBar({ current, onNew }) {
  return html`<nav class="tabbar" aria-label="Navegación principal"><ul>
    ${TABS.map(([name, icon, label]) => {
      if (name === 'nuevo') return html`<li key=${name}><button class="fab" onClick=${onNew} aria-label="Registrar movimiento"><${Icon} name="plus" size=${26} stroke=${2.5} /></button></li>`;
      const on = (TAB_OF[current] || current) === name;
      return html`<li key=${name}><a href=${'#/' + (name === 'inicio' ? '' : name)} class=${on ? 'on' : ''} aria-current=${on ? 'page' : undefined}>
        <${Icon} name=${icon} size=${22} /><span>${label}</span></a></li>`;
    })}
  </ul></nav>`;
}

function Screen({ route }) {
  switch (route.name) {
    case 'movimientos': return html`<${Movements} query=${route.query} />`;
    case 'cuentas': return html`<${Accounts} query=${route.query} />`;
    case 'cuenta': return html`<${AccountDetail} id=${route.param} />`;
    case 'presupuestos': return html`<${Budgets} />`;
    case 'fijos': return html`<${Recurring} />`;
    case 'tasas': return html`<${Rates} />`;
    case 'analisis': return html`<${Insights} />`;
    case 'mas': return html`<${More} />`;
    case 'ajustes': return html`<${Settings} />`;
    case 'aprende': return html`<${LearnPage} />`;
    case 'copiloto': return html`<${Copilot} />`;
    default: return html`<${Home} />`;
  }
}

function Shell({ recovery, clearRecovery }) {
  const d = useData();
  const route = useRoute();
  const [tx, setTx] = useState(null);
  const [onboarded] = usePref('onboarded', false);

  useEffect(() => {
    const on = (e) => setTx(e.detail || {});
    window.addEventListener('fructosa-open-tx', on);
    return () => window.removeEventListener('fructosa-open-tx', on);
  }, []);

  if (d.error) {
    return html`<main class="center-screen"><div class="empty">
      <div class="empty-emoji">📡</div><h3>No pudimos cargar tus datos</h3><p>${errorText(d.error)}</p>
      <button class="btn primary" onClick=${d.actions.reload}>Reintentar</button>
      <button class="btn ghost" onClick=${() => api.auth.signOut()}>Cerrar sesión</button>
    </div></main>`;
  }
  if (!d.ready) return html`<${Skeleton} />`;
  // Usuario y país son obligatorios: cuentas antiguas los eligen una vez.
  if (!isDemo && !d.profile.username) return html`<${CompleteProfile} />`;

  return html`<div class="app">
    ${isDemo && html`<div class="demo-badge" title="Datos de ejemplo guardados solo en este navegador">DEMO</div>`}
    <main class="main" key=${route.key}><${Screen} route=${route} /></main>
    ${['inicio', 'analisis'].includes(route.name) && html`<a class="ai-fab" href="#/copiloto" aria-label="Abrir Copiloto IA"><${Icon} name="sparkle" size=${20} /><span>Copiloto IA</span></a>`}
    <${TabBar} current=${route.name} onNew=${() => setTx({})} />
    ${tx && html`<${TxForm} key=${tx.tx?.id || 'new'} tx=${tx.tx} preset=${tx.preset} onClose=${() => setTx(null)} />`}
    ${!onboarded && html`<${Onboarding} />`}
    ${recovery && html`<${PasswordSheet} title="Crea tu nueva contraseña" onClose=${clearRecovery} />`}
  </div>`;
}

function Skeleton() {
  return html`<div class="app"><main class="main page">
    <div class="sk sk-line w40"></div><div class="sk sk-hero"></div>
    <div class="sk sk-row"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
  </main></div>`;
}

function UpdateBanner() {
  const [ready, setReady] = useState(null);
  useEffect(() => {
    const on = (e) => setReady(() => e.detail);
    window.addEventListener('fructosa-sw-update', on);
    return () => window.removeEventListener('fructosa-sw-update', on);
  }, []);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    addEventListener('online', up); addEventListener('offline', down);
    return () => { removeEventListener('online', up); removeEventListener('offline', down); };
  }, []);
  return html`${!online && html`<div class="banner offline">Sin conexión · mostrando lo último cargado</div>`}
    ${ready && html`<div class="banner update"><span>Hay una versión nueva de La Fructosa</span><button onClick=${ready}>Actualizar</button></div>`}`;
}

function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let sub;
    api.auth.session().then(setSession).catch(() => setSession(null));
    api.auth.onChange((s, ev) => { setSession(s); if (ev === 'PASSWORD_RECOVERY') setRecovery(true); }).then((x) => { sub = x; });
    return () => sub?.unsubscribe();
  }, []);

  // Sesión válida (login o registro): se adopta al instante y se fuerza #/inicio, sin esperar
  // a escrituras secundarias ni al evento de Supabase.
  const adoptSession = (s) => { setSession(s); location.hash = '#/inicio'; };

  return html`<${React.Fragment}>
    ${session === undefined ? html`<main class="center-screen"><${Spinner} /></main>`
      : session ? html`<${DataProvider} key=${session.user.id}><${Shell} recovery=${recovery} clearRecovery=${() => setRecovery(false)} /><//>`
      : html`<${AuthScreen} onSession=${adoptSession} />`}
    <${UpdateBanner} />
    <${ToastHost} />
    <${ConfirmHost} />
  <//>`;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);

// ---------------------------------------------------------------------
// Service worker: instala, detecta versiones nuevas y ofrece actualizar.
// ---------------------------------------------------------------------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => window.dispatchEvent(new CustomEvent('fructosa-sw-update', { detail: () => w.postMessage('skip-waiting') }));
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  // Recarga solo cuando una versión nueva reemplaza a otra (no en la primera instalación).
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
