// La Fructosa · punto de entrada: sesión, rutas, navegación y servicios globales.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { html, Icon, Art, ToastHost, ConfirmHost, Spinner, errorText } from './ui.js';
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
import { More, Settings, PasswordSheet } from './screens/settings.js';
import { Onboarding } from './screens/onboarding.js';
import { Tour, TourOutro, useTour } from './tour.js';
import { LearnPage } from './screens/learn.js';
import { FaqPage } from './screens/faq.js';
import { TxForm } from './screens/txform.js';
import { Copilot } from './screens/copilot.js';
import { AppLock, clearLock } from './lock.js';
import { Goals, Loans } from './screens/goals.js';
import { Shopping } from './screens/shopping.js';
import { Investments } from './screens/investments.js';
import { TermsGate, TermsPage, useTerms } from './terms.js';
import { BackupBanner, DataPreview } from './backup.js';

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
const TAB_OF = { cuentas: 'mas', cuenta: 'mas', presupuestos: 'mas', fijos: 'mas', tasas: 'mas', ajustes: 'mas', aprende: 'mas', metas: 'mas', prestamos: 'mas', compras: 'mas', inversiones: 'mas', terminos: 'mas', preguntas: 'mas' };

function TabBar({ current, onNew }) {
  return html`<nav class="tabbar" aria-label="Navegación principal"><ul>
    ${TABS.map(([name, icon, label]) => {
      if (name === 'nuevo') return html`<li key=${name}><button class="fab" data-tour="fab" onClick=${onNew} aria-label="Registrar movimiento"><${Icon} name="plus" size=${26} stroke=${2.5} /></button></li>`;
      const on = (TAB_OF[current] || current) === name;
      return html`<li key=${name}><a href=${'#/' + (name === 'inicio' ? '' : name)} class=${on ? 'on' : ''} aria-current=${on ? 'page' : undefined}>
        <${Icon} name=${icon} size=${22} /><span>${label}</span></a></li>`;
    })}
  </ul></nav>`;
}

// Barra lateral para laptop y escritorio (en el teléfono se oculta y queda la barra de abajo).
const SIDE_OF = { cuenta: 'cuentas' };
function Sidebar({ current, onNew }) {
  const { region, profile, investmentsOn } = useData();
  const groups = [
    [null, [
      ['inicio', 'home', 'Inicio'],
      ['movimientos', 'list', 'Movimientos'],
      ['analisis', 'pie', 'Análisis'],
      ['cuentas', 'wallet', 'Cuentas'],
    ]],
    ['Planifica', [
      ['presupuestos', 'target', 'Presupuestos'],
      ['fijos', 'repeat', 'Pagos fijos'],
      ['metas', 'flag', 'Metas de ahorro'],
      ['prestamos', 'hand', 'Por cobrar y pagar'],
      ['compras', 'list', 'Lista de compras'],
      investmentsOn && ['inversiones', 'chart', 'Inversiones'],
    ].filter(Boolean)],
    ['Herramientas', [
      region.rates && ['tasas', 'trend', 'Tasas y calculadora'],
      ['copiloto', 'sparkle', 'Copiloto IA'],
      ['aprende', 'book', 'Manual de uso'],
      ['preguntas', 'help', 'Preguntas frecuentes'],
      ['ajustes', 'sliders', 'Ajustes'],
    ].filter(Boolean)],
  ];
  const on = SIDE_OF[current] || current;
  const name = profile.display_name || profile.username || '';
  return html`<aside class="sidebar" aria-label="Menú">
    <a class="side-brand" href="#/"><img src="./icons/icon-192.png" alt="" width="34" height="34" /><b>La Fructosa</b></a>
    <button class="btn primary side-new" data-tour="fab" onClick=${onNew} title="Registrar movimiento"><${Icon} name="plus" size=${18} stroke=${2.5} /><span>Registrar movimiento</span></button>
    <nav class="side-nav" aria-label="Navegación principal">
      ${groups.map(([title, items]) => html`<div key=${title || 'main'} class="side-group">
        ${title && html`<p class="side-title">${title}</p>`}
        ${items.map(([r, icon, label]) => html`<a key=${r} href=${'#/' + (r === 'inicio' ? '' : r)} class=${on === r ? 'on' : ''} data-tour=${r === 'copiloto' ? 'copilot' : undefined} title=${label} aria-current=${on === r ? 'page' : undefined}>
          <${Icon} name=${icon} size=${19} /><span>${label}</span></a>`)}
      </div>`)}
    </nav>
    <a class="side-user" href="#/ajustes" title="Ajustes">
      <span class="avatar">${(name || 'L')[0].toUpperCase()}</span>
      <span class="side-user-main"><b>${name || 'Mi perfil'}</b><small>${region.flag} ${region.label}</small></span>
    </a>
  </aside>`;
}

function Screen({ route }) {
  const { region, investmentsOn } = useData();
  switch (route.name) {
    case 'movimientos': return html`<${Movements} query=${route.query} />`;
    case 'cuentas': return html`<${Accounts} query=${route.query} />`;
    case 'cuenta': return html`<${AccountDetail} id=${route.param} />`;
    case 'presupuestos': return html`<${Budgets} />`;
    case 'fijos': return html`<${Recurring} />`;
    case 'metas': return html`<${Goals} />`;
    case 'prestamos': return html`<${Loans} />`;
    case 'compras': return html`<${Shopping} />`;
    case 'inversiones': return investmentsOn ? html`<${Investments} />` : html`<${Home} />`; // solo con el permiso del perfil
    case 'tasas': return region.rates ? html`<${Rates} />` : html`<${Home} />`; // fuera de Venezuela no hay tasas
    case 'analisis': return html`<${Insights} />`;
    case 'mas': return html`<${More} />`;
    case 'ajustes': return html`<${Settings} />`;
    case 'aprende': return html`<${LearnPage} />`;
    case 'preguntas': return html`<${FaqPage} />`;
    case 'copiloto': return html`<${Copilot} query=${route.query} />`;
    case 'terminos': return html`<${TermsPage} />`;
    default: return html`<${Home} />`;
  }
}

function Shell({ uid, recovery, clearRecovery }) {
  const d = useData();
  const route = useRoute();
  const [tx, setTx] = useState(null);
  const [onboarded] = usePref('onboarded', false);
  const tour = useTour(uid);
  const [outro, setOutro] = useState(false); // mensaje "Empieza hoy" al cerrar el tour
  // Al cerrar el tour: "Empieza hoy" y después "Así queda registrada tu información".
  const [dataPop, setDataPop] = useState(false);
  const [terms, acceptTerms] = useTerms(uid);

  useEffect(() => {
    const on = (e) => setTx(e.detail || {});
    window.addEventListener('fructosa-open-tx', on);
    return () => window.removeEventListener('fructosa-open-tx', on);
  }, []);
  // Acceso directo "Registrar movimiento" (#/nuevo): abre el formulario sobre Inicio.
  useEffect(() => {
    if (route.name === 'nuevo' && d.ready) { history.replaceState(null, '', '#/'); setTx({}); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  }, [route.name, d.ready]);

  if (d.error) {
    return html`<main class="center-screen"><div class="empty">
      <${Art} name="offline" class="empty-art" /><h3>No pudimos cargar tus datos</h3><p>${errorText(d.error)}</p>
      <button class="btn primary" onClick=${d.actions.reload}>Reintentar</button>
      <button class="btn ghost" onClick=${() => api.auth.signOut()}>Cerrar sesión</button>
    </div></main>`;
  }
  if (!d.ready) return html`<${Skeleton} />`;
  // Usuario y país son obligatorios: cuentas antiguas los eligen una vez.
  if (!isDemo && !d.profile.username) return html`<${CompleteProfile} />`;

  const hasUserData = (d.accounts && d.accounts.length > 0) || (d.txs && d.txs.length > 0);
  // Primero la pantalla de confianza y términos; después la bienvenida y el tour.
  const showTerms = terms === false;
  const termsOk = terms === true;
  const showOnboard = termsOk && !onboarded && !hasUserData;

  return html`<div class="app">
    ${d.pending > 0 && html`<div class="banner pending" role="status">⏳ ${d.pending === 1 ? '1 movimiento por subir' : d.pending + ' movimientos por subir'}</div>`}
    ${isDemo && html`<div class="demo-badge" title="Datos de ejemplo guardados solo en este navegador">DEMO</div>`}
    <main class="main" key=${route.key}>${route.name !== 'inicio' && html`<${BackupBanner} d=${d} />`}<${Screen} route=${route} /></main>
    ${['inicio', 'analisis'].includes(route.name) && html`<a class="ai-fab" data-tour="copilot" href="#/copiloto" aria-label="Abrir Copiloto IA"><${Icon} name="sparkle" size=${20} /><span>Copiloto IA</span></a>`}
    <${TabBar} current=${route.name} onNew=${() => setTx({})} />
    <${Sidebar} current=${route.name} onNew=${() => setTx({})} />
    ${tx && html`<${TxForm} key=${tx.tx?.id || 'new'} tx=${tx.tx} preset=${tx.preset} onClose=${() => setTx(null)} />`}
    ${showOnboard && html`<${Onboarding} />`}
    ${showTerms && html`<${TermsGate} onAccept=${acceptTerms} />`}
    ${termsOk && (onboarded || hasUserData) && tour.show && !showOnboard && !recovery && !tx && route.name === 'inicio' && html`<${Tour} region=${d.region}
      left=${tour.left} onNever=${tour.replay ? null : tour.never} onClose=${() => { tour.done(); setOutro(true); }} />`}
    ${outro && html`<${TourOutro} onClose=${() => { setOutro(false); setDataPop(true); }} />`}
    ${dataPop && html`<${DataPreview} d=${d} onClose=${() => setDataPop(false)} />`}
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
  return html`${!online && html`<div class="banner offline">Sin conexión · mostrando la última información cargada</div>`}
    ${ready && html`<div class="banner update"><span>Hay una versión nueva de La Fructosa</span><button onClick=${ready}>Actualizar</button></div>`}`;
}

function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let sub;
    api.auth.session().then(setSession).catch(() => setSession(null));
    api.auth.onChange((s, ev) => { setSession(s); if (ev === 'PASSWORD_RECOVERY') setRecovery(true); }).then((x) => { sub = x; }).catch(() => {});
    return () => sub?.unsubscribe();
  }, []);

  // Sesión válida (login o registro): se adopta al instante y se fuerza #/inicio, sin esperar
  // a escrituras secundarias ni al evento de Supabase.
  const adoptSession = (s) => { setSession(s); location.hash = '#/inicio'; };

  return html`<${React.Fragment}>
    ${session === undefined ? html`<main class="center-screen"><${Spinner} /></main>`
      : session ? html`<${DataProvider} key=${session.user.id} uid=${session.user.id}>
          <${AppLock} uid=${session.user.id} onSignOut=${() => { clearLock(session.user.id); api.auth.signOut(); }}>
            <${Shell} uid=${session.user.id} recovery=${recovery} clearRecovery=${() => setRecovery(false)} />
          <//>
        <//>`
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
