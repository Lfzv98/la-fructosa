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
import { BackupButton, downloadBackup, exportMovementsXlsx } from '../backup.js';
import { LockSettings, clearLock } from '../lock.js';
import { applyTheme } from '../theme.js';
import { pushSupport, publicKey, currentSubscription, enablePush, disablePush, updatePushPrefs, DEFAULT_PREFS } from '../push.js';

export const APP_VERSION = '3.1.0';

export function More() {
  const d = useData();
  const { region, txs, accById, recurring, budgets, goals, loans } = d;
  const owed = loans.filter((l) => !l.settled).length;
  const tiles = [
    ['#/cuentas', 'wallet', 'Cuentas', 'Saldos y billeteras', '#A0C4FF'],
    ['#/presupuestos', 'target', 'Presupuestos', `${budgets.length} activos`, '#FFADAD'],
    ['#/fijos', 'repeat', 'Pagos fijos', `${recurring.filter((r) => r.is_active !== false).length} programados`, '#FDFFB6'],
    ['#/metas', 'flag', 'Metas de ahorro', goals.length ? `${goals.filter((g) => !g.done).length} en curso` : 'Ahorra para algo', '#FFD6A5'],
    ['#/prestamos', 'hand', 'Préstamos', owed ? `${owed} pendientes` : 'Quién te debe', '#CAFFBF'],
    region.rates && ['#/tasas', 'trend', 'Tasas y calculadora', 'BCV, Paralelo, USDT', '#CAFFBF'],
    ['#/copiloto', 'sparkle', 'Copiloto IA', 'Pregunta por tus finanzas', '#FFC6FF'],
    ['#/aprende', 'book', 'Manual de uso', 'Guía fácil y tour', '#BDB2FF'],
    ['#/ajustes', 'sliders', 'Ajustes', 'Perfil, moneda, privacidad', '#9BF6FF'],
  ].filter(Boolean);
  return html`<div class="page">
    <${PageHeader} title="Más" />
    <div class="tiles">${tiles.map(([h, i, t, s, c]) => html`<a key=${h} href=${h} class="tile" style=${{ '--tc': c }}>
      <span class="tile-ico"><${Icon} name=${i} /></span><b>${t}</b><small>${s}</small></a>`)}</div>
    <button class="btn soft block" onClick=${() => exportMovementsXlsx(txs, d, 'todo')} disabled=${!txs.length}><${Icon} name="download" size=${18} /> Exportar todos los movimientos (Excel)</button>
    <button class="btn ghost block" onClick=${() => exportCSV(txs, accById, 'todo')} disabled=${!txs.length}>Exportar en CSV (texto simple)</button>
  </div>`;
}

export function Settings() {
  const d = useData();
  const { profile, region, actions } = d;
  const [hide, setHide] = usePref('hide', false);
  const [theme, setTheme] = usePref('theme', 'dark');
  useEffect(() => { applyTheme(theme); }, [theme]);
  const [name, setName] = useState(profile.display_name || '');
  const [pwd, setPwd] = useState(false);
  const [del, setDel] = useState(false);
  const install = useInstall();

  const save = async (patch, msg) => {
    try { await actions.updateProfile(patch); if (msg) toast(msg); } catch (e) { toast(errorText(e), { tone: 'bad' }); }
  };
  const setRegion = async (r) => {
    if (r === (profile.region || 'VE')) return;
    const reg = REGIONS[r];
    const ok = await confirmDialog({ title: `¿Cambiar a ${reg.flag} ${reg.label}?`,
      body: reg.rates ? 'Verás las tasas BCV/Paralelo/USDT y la calculadora de brecha. Tu moneda principal pasa a USD.'
        : `Se ocultan las tasas y la brecha cambiaria (vuelven solas si tienes cuentas en bolívares), y tu moneda principal pasa a ${reg.base}. Tus cuentas y movimientos no cambian.`, confirm: 'Cambiar país' });
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
        <${Segmented} value=${profile.region || 'VE'} onChange=${setRegion} options=${Object.entries(REGIONS).map(([k, r]) => [k, `${r.flag} ${r.short || k}`])} />
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

    <${PushSettings} region=${region} />

    <${SectionTitle}>Apariencia<//>
    <section class="card pad stack">
      <${Field} label="Tema" hint="Automático sigue el modo claro u oscuro de tu teléfono.">
        <${Segmented} value=${theme} onChange=${setTheme} options=${[['dark', 'Oscuro'], ['light', 'Claro'], ['auto', 'Automático']]} />
      <//>
    </section>

    <${SectionTitle}>Copiloto IA<//>
    <section class="card pad stack">
      <p class="hint">Conecta tu propia clave de Google Gemini para conversar sobre tus finanzas. <a class="link" href="#/copiloto">Abrir el copiloto</a></p>
      <${AiSettings} />
    </section>

    <${SectionTitle}>Privacidad y seguridad<//>
    <section class="card list">
      <${Switch} checked=${hide} onChange=${setHide} label="Ocultar saldos" sub="Útil si usas la app frente a otras personas" />
      <${LockSettings} uid=${profile.id} label=${profile.username ? '@' + profile.username : profile.display_name} />
      ${!isDemo && html`<button class="menu-row" onClick=${() => setPwd(true)}><${Icon} name="lock" /><span>Cambiar contraseña</span><${Icon} name="right" class="muted" /></button>`}
      <a class="menu-row" href="#/terminos"><${Icon} name="shield" /><span>Términos y privacidad<small>Qué guardamos, cómo lo protegemos y tus derechos</small></span><${Icon} name="right" class="muted" /></a>
      <div class="menu-row static"><${Icon} name="info" /><span><b>Tus datos son solo tuyos.</b><small>Cada registro lleva tu identificador y la base de datos (seguridad a nivel de fila) bloquea cualquier consulta de otra persona, incluso de la familia.</small></span></div>
    </section>

    <${SectionTitle}>Respaldo<//>
    <section class="card list">
      <${BackupButton} d=${d} />
      <div class="menu-row static"><${Icon} name="info" /><span><b>Guárdalo en una carpeta segura.</b><small>El Excel trae todas tus cuentas, movimientos, presupuestos y pagos fijos. Cada 7 días la app te recuerda descargar uno nuevo.</small></span></div>
    </section>

    <${SectionTitle}>App<//>
    <section class="card list">
      ${install.state !== 'installed' && html`<button class="menu-row" onClick=${install.run}><${Icon} name="phone" /><span>Instalar en este teléfono<small>${install.state === 'ios' ? 'Safari → Compartir → Agregar a inicio' : 'Abre como app, a pantalla completa'}</small></span><${Icon} name="right" class="muted" /></button>`}
      <a class="menu-row" href="#/aprende"><${Icon} name="book" /><span>Manual de uso y tour</span><${Icon} name="right" class="muted" /></a>
      ${isDemo && html`<button class="menu-row" onClick=${resetDemo}><${Icon} name="refresh" /><span>Reiniciar datos de ejemplo</span></button>`}
      ${!isDemo && html`<button class="menu-row danger-text" onClick=${() => setDel(true)}><${Icon} name="trash" /><span>Borrar mi cuenta<small>Elimina tu cuenta y todos tus datos para siempre</small></span></button>`}
      <button class="menu-row danger-text" onClick=${signOut}><${Icon} name="logout" /><span>${isDemo ? 'Salir del demo' : 'Cerrar sesión'}</span></button>
    </section>
    <p class="hint center">La Fructosa ${APP_VERSION} ${isDemo ? '· modo demo (datos en este navegador)' : ''}<br/>Hecha con cariño para la familia 🍊</p>
    ${pwd && html`<${PasswordSheet} onClose=${() => setPwd(false)} />`}
    ${del && html`<${DeleteAccountSheet} d=${d} onClose=${() => setDel(false)} />`}
  </div>`;
}

// Avisos al teléfono. Solo aparece cuando el servidor tiene los avisos activados.
function PushSettings({ region }) {
  const support = pushSupport();
  const [ready, setReady] = useState(false);   // el servidor tiene clave VAPID
  const [sub, setSub] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (support === 'off') return;
    publicKey().then((k) => setReady(Boolean(k)));
    currentSubscription().then(async (s) => {
      setSub(s);
      if (s) { const row = await api.push.get(s.endpoint).catch(() => null); if (row?.prefs) setPrefs({ ...DEFAULT_PREFS, ...row.prefs }); }
    }).catch(() => {});
  }, []);
  if (support === 'off' || !ready) return null;

  const turnOn = async () => {
    setBusy(true);
    try { setSub(await enablePush(prefs)); toast('Avisos activados en este teléfono'); } catch (e) { toast(errorText(e), { tone: 'bad' }); }
    setBusy(false);
  };
  const turnOff = async () => { setBusy(true); await disablePush(); setSub(null); setBusy(false); toast('Avisos desactivados'); };
  const setPref = async (k, v) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    try { await updatePushPrefs(next); } catch (e) { toast(errorText(e), { tone: 'bad' }); }
  };

  return html`<${SectionTitle}>Avisos<//>
    <section class="card list">
      ${support === 'install' ? html`<div class="menu-row static"><${Icon} name="bell" /><span><b>Instala la app para recibir avisos</b><small>En iPhone: Safari → Compartir → "Agregar a inicio", ábrela desde ahí y vuelve a esta pantalla.</small></span></div>`
      : support === 'unsupported' ? html`<div class="menu-row static"><${Icon} name="bell" /><span><b>Este navegador no admite avisos</b><small>Prueba con Chrome o con la app instalada.</small></span></div>`
      : !sub ? html`<button class="menu-row" disabled=${busy} onClick=${turnOn}><${Icon} name="bell" /><span>Activar avisos en este teléfono<small>Pagos fijos que vencen, préstamos y más. Llegan a las 8:30 a. m.</small></span><${Icon} name="right" class="muted" /></button>`
      : html`
        <${Switch} checked=${prefs.bills} onChange=${(v) => setPref('bills', v)} label="Pagos fijos por vencer" sub="El día antes y el mismo día, si aún no los pagaste" />
        <${Switch} checked=${prefs.loans} onChange=${(v) => setPref('loans', v)} label="Préstamos que vencen" sub="El día que vence lo que te deben o lo que debes" />
        <${Switch} checked=${prefs.backup !== false} onChange=${(v) => setPref('backup', v)} label="Recordatorio de respaldo" sub="Si pasan 7 días sin descargar tu Excel, te aviso" />
        ${region.rates && html`<${Switch} checked=${prefs.rates} onChange=${(v) => setPref('rates', v)} label="Tasas del día" sub="BCV, Paralelo, USDT y la brecha cada mañana" />`}
        <button class="menu-row danger-text" disabled=${busy} onClick=${turnOff}><${Icon} name="bell" /><span>Desactivar avisos en este teléfono</span></button>`}
    </section>`;
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

// Borrar la cuenta: primero ofrece el respaldo y pide escribir el usuario para confirmar.
function DeleteAccountSheet({ d, onClose }) {
  const want = d.profile.username || 'BORRAR';
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().replace(/^@/, '').toLowerCase() === want.toLowerCase();
  const run = async () => {
    setBusy(true);
    try {
      await api.auth.deleteAccount();
      clearLock(d.profile.id);
      try { for (const k of Object.keys(localStorage)) if (k.includes(d.profile.id)) localStorage.removeItem(k); } catch { /* nada */ }
      toast('Tu cuenta y todos tus datos fueron borrados.');
      setTimeout(() => { location.hash = ''; location.reload(); }, 1200);
    } catch (e) {
      const missing = /delete_my_account|PGRST202|not find the function|404/i.test(String(e?.message || e?.code || e));
      toast(missing ? 'Esta opción aún no está activada en el servidor. Pídele al administrador que ejecute la migración 009.' : errorText(e), { tone: 'bad' });
      setBusy(false);
    }
  };
  return html`<${Sheet} title="Borrar mi cuenta" onClose=${onClose}
    footer=${html`<button class="btn ghost" onClick=${onClose}>Cancelar</button>
      <button class="btn danger" disabled=${!ok || busy} onClick=${run}>${busy ? 'Borrando…' : 'Borrar para siempre'}</button>`}>
    <div class="stack">
      <p>Se borran tu cuenta, tus cuentas, movimientos, presupuestos, pagos fijos, metas, préstamos y tu conversación con Fructosa. <b>No se puede deshacer.</b></p>
      <button class="btn soft block" onClick=${() => downloadBackup(d).catch((e) => toast(errorText(e), { tone: 'bad' }))}><${Icon} name="download" size=${18} /> Descargar mi respaldo antes</button>
      <${Field} label=${html`Para confirmar, escribe <b>${want}</b>`}>
        <input class="input" value=${typed} autocomplete="off" autocapitalize="off" onInput=${(e) => setTyped(e.target.value)} />
      <//>
    </div>
  <//>`;
}
