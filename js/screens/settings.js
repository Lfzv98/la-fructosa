// Más (menú) y Ajustes: perfil, región, moneda, privacidad, instalación, guía y sesión.
import { useEffect, useState } from 'react';
import { html, Icon, Segmented, Switch, Sheet, Field, SectionTitle, toast, confirmDialog, errorText } from '../ui.js';
import { useData, usePref } from '../store.js';
import { Learn } from '../learn.js';
import { PageHeader, go } from './common.js';
import { exportCSV } from '../export.js';
import { api, isDemo } from '../api.js';
import { REGIONS, RATE_LABELS } from '../money.js';
import { AiSettings } from './copilot.js';

export const APP_VERSION = '2.1.0';

export function More() {
  const { region, txs, accById, recurring, budgets } = useData();
  const tiles = [
    ['#/cuentas', 'wallet', 'Cuentas', 'Saldos y billeteras', '#A0C4FF'],
    ['#/presupuestos', 'target', 'Presupuestos', `${budgets.length} activos`, '#FFADAD'],
    ['#/fijos', 'repeat', 'Pagos fijos', `${recurring.filter((r) => r.is_active !== false).length} programados`, '#FDFFB6'],
    region.rates && ['#/tasas', 'trend', 'Tasas y calculadora', 'BCV, Paralelo, USDT', '#CAFFBF'],
    ['#/copiloto', 'sparkle', 'Copiloto IA', 'Pregunta por tus finanzas', '#FFC6FF'],
    ['#/aprende', 'book', 'Manual de uso', 'Guía fácil y tour', '#BDB2FF'],
    ['#/ajustes', 'sliders', 'Ajustes', 'Perfil, moneda, privacidad', '#9BF6FF'],
  ].filter(Boolean);
  return html`<div class="page">
    <${PageHeader} title="Más" />
    <div class="tiles">${tiles.map(([h, i, t, s, c]) => html`<a key=${h} href=${h} class="tile" style=${{ '--tc': c }}>
      <span class="tile-ico"><${Icon} name=${i} /></span><b>${t}</b><small>${s}</small></a>`)}</div>
    <button class="btn soft block" onClick=${() => exportCSV(txs, accById, 'todo')} disabled=${!txs.length}><${Icon} name="download" size=${18} /> Exportar todos los movimientos (CSV)</button>
  </div>`;
}

export function Settings() {
  const { profile, region, actions } = useData();
  const [hide, setHide] = usePref('hide', false);
  const [name, setName] = useState(profile.display_name || '');
  const [pwd, setPwd] = useState(false);
  const install = useInstall();

  const save = async (patch, msg) => {
    try { await actions.updateProfile(patch); if (msg) toast(msg); } catch (e) { toast(errorText(e), { tone: 'bad' }); }
  };
  const setRegion = async (r) => {
    if (r === (profile.region || 'VE')) return;
    const reg = REGIONS[r];
    const ok = await confirmDialog({ title: `¿Cambiar a ${reg.flag} ${reg.label}?`,
      body: reg.rates ? 'Verás tasas BCV/Paralelo/USDT y la calculadora de brecha. Tu moneda principal pasa a USD.'
        : `Se ocultan tasas y brecha cambiaria y tu moneda principal pasa a ${reg.base}. Tus cuentas y movimientos no cambian.`, confirm: 'Cambiar país' });
    if (!ok) return;
    const patch = { region: r, preferred_currency: reg.base };
    save(patch, `Región: ${reg.label}`);
  };
  async function signOut() {
    if (!(await confirmDialog({ title: '¿Cerrar sesión?', body: isDemo ? 'En el demo se reinician los datos de ejemplo.' : 'Tus datos quedan guardados en tu cuenta.', confirm: 'Cerrar sesión' }))) return;
    await api.auth.signOut();
  }
  async function resetDemo() {
    if (!(await confirmDialog({ title: '¿Reiniciar el demo?', body: 'Se borran tus cambios y vuelven los datos de ejemplo.', confirm: 'Reiniciar', tone: 'danger' }))) return;
    api.reset(); location.reload();
  }

  return html`<div class="page">
    <${PageHeader} title="Ajustes" back="#/mas" />
    <section class="card pad profile">
      <span class="avatar lg">${(name || 'L')[0].toUpperCase()}</span>
      <div class="grow">
        <input class="input bare" value=${name} onInput=${(e) => setName(e.target.value)} aria-label="Tu nombre"
          onBlur=${() => name.trim() && name !== profile.display_name && save({ display_name: name.trim() }, 'Nombre actualizado')} />
        <small class="muted">${profile.username ? '@' + profile.username + ' · ' : ''}${profile.email || ''}</small>
      </div>
    </section>

    <${SectionTitle}>Región y moneda<//>
    <section class="card pad stack">
      <${Field} label="País" hint=${region.rates ? 'Muestra tasas BCV/Paralelo/USDT y la calculadora de brecha.' : 'Oculta tasas y brecha cambiaria.'}>
        <${Segmented} value=${profile.region || 'VE'} onChange=${setRegion} options=${Object.entries(REGIONS).map(([k, r]) => [k, `${r.flag} ${k}`])} />
      <//>
      <${Field} label="Moneda principal" hint="En ella se muestran el patrimonio y los análisis.">
        <${Segmented} value=${profile.preferred_currency} onChange=${(c) => save({ preferred_currency: c }, `Moneda principal: ${c}`)}
          options=${region.currencies.filter((c) => c !== 'USDT').map((c) => [c, c])} />
      <//>
      ${region.rates && html`<${Field} label=${html`Valorar dólares con <${Learn} term="consolidado" />`} hint="Paralelo refleja mejor cuántos dólares reales tendrías si cambiaras todo hoy.">
        <${Segmented} value=${profile.valuation_rate} onChange=${(v) => save({ valuation_rate: v }, `Valorando con ${RATE_LABELS[v]}`)}
          options=${[['BCV_USD', 'BCV'], ['PARALELO', 'Paralelo']]} />
      <//>`}
    </section>

    <${SectionTitle}>Copiloto IA<//>
    <section class="card pad stack">
      <p class="hint">Conecta tu propia clave de Gemini, Groq o Grok (xAI) para chatear con tus números. <a class="link" href="#/copiloto">Abrir el copiloto</a></p>
      <${AiSettings} />
    </section>

    <${SectionTitle}>Privacidad y seguridad<//>
    <section class="card list">
      <${Switch} checked=${hide} onChange=${setHide} label="Ocultar saldos" sub="Útil si usas la app frente a otras personas" />
      ${!isDemo && html`<button class="menu-row" onClick=${() => setPwd(true)}><${Icon} name="lock" /><span>Cambiar contraseña</span><${Icon} name="right" class="muted" /></button>`}
      <div class="menu-row static"><${Icon} name="info" /><span><b>Tus datos son solo tuyos.</b><small>Cada registro lleva tu identificador y la base de datos (Row Level Security) bloquea cualquier consulta de otra persona, incluso de la familia.</small></span></div>
    </section>

    <${SectionTitle}>App<//>
    <section class="card list">
      ${install.state !== 'installed' && html`<button class="menu-row" onClick=${install.run}><${Icon} name="phone" /><span>Instalar en este teléfono<small>${install.state === 'ios' ? 'Safari → Compartir → Agregar a inicio' : 'Abre como app, a pantalla completa'}</small></span><${Icon} name="right" class="muted" /></button>`}
      <a class="menu-row" href="#/aprende"><${Icon} name="book" /><span>Manual de uso y tour</span><${Icon} name="right" class="muted" /></a>
      ${isDemo && html`<button class="menu-row" onClick=${resetDemo}><${Icon} name="refresh" /><span>Reiniciar datos de ejemplo</span></button>`}
      <button class="menu-row danger-text" onClick=${signOut}><${Icon} name="logout" /><span>${isDemo ? 'Salir del demo' : 'Cerrar sesión'}</span></button>
    </section>
    <p class="hint center">La Fructosa ${APP_VERSION} ${isDemo ? '· modo demo (datos en este navegador)' : ''}<br/>Hecha con cariño para la familia 🍊</p>
    ${pwd && html`<${PasswordSheet} onClose=${() => setPwd(false)} />`}
  </div>`;
}

export function PasswordSheet({ onClose, title = 'Cambiar contraseña' }) {
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  async function submit(close) {
    if (p.length < 8) return setErr('Mínimo 8 caracteres.');
    try { await api.auth.updatePassword(p); close(); toast('Contraseña actualizada'); } catch (e) { setErr(errorText(e)); }
  }
  return html`<${Sheet} title=${title} onClose=${onClose} footer=${(close) => html`<button class="btn primary block" onClick=${() => submit(close)}>Guardar</button>`}>
    <${Field} label="Nueva contraseña" error=${err}><input class="input" type="password" autocomplete="new-password" autofocus value=${p} onInput=${(e) => { setP(e.target.value); setErr(''); }} /><//>
  <//>`;
}

// Instalación PWA: Android/Chrome usa el aviso nativo; iOS necesita instrucciones.
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
export function useInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((x) => x + 1); window.addEventListener('beforeinstallprompt', f); return () => window.removeEventListener('beforeinstallprompt', f); }, []);
  const state = standalone ? 'installed' : ios ? 'ios' : deferred ? 'prompt' : 'manual';
  const run = async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; force((x) => x + 1); return; }
    toast(ios ? 'En Safari: botón Compartir → "Agregar a inicio"' : 'En Chrome: menú ⋮ → "Instalar app" o "Agregar a pantalla principal"');
  };
  return { state, run };
}
