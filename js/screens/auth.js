// Acceso: entrar con usuario (o correo) y contraseña, crear cuenta con país
// obligatorio, recuperar contraseña y completar el perfil de cuentas antiguas.
import { useEffect, useRef, useState } from 'react';
import { html, Icon, Field, errorText, toast } from '../ui.js';
import { api } from '../api.js';
import { useData } from '../store.js';
import { REGIONS } from '../money.js';

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

const REGION_INFO = {
  VE: 'USD, Bs. y USDT · tasas BCV y paralelo · calculadora de brecha',
  US: 'Dólares · sin tasas ni brecha (salvo que tengas cuentas en Bs.)',
  ES: 'Euros · sin tasas ni brecha (salvo que tengas cuentas en Bs.)',
  INT: 'Panamá, Colombia, Chile, México y demás · USD, EUR, USDT y Bs.',
};

// País: obligatorio y sin opción marcada por defecto, porque cambia cómo funciona la app.
export function RegionPicker({ value, onChange, error }) {
  return html`<div class="field">
    <span class="field-label">¿En qué país manejas tu dinero? <span class="req">Obligatorio</span></span>
    <div class=${'region-list' + (error ? ' invalid' : '')} role="radiogroup" aria-label="País">
      ${Object.entries(REGIONS).map(([k, r]) => html`<button key=${k} type="button" role="radio" aria-checked=${value === k}
        class=${'region-opt' + (value === k ? ' on' : '')} onClick=${() => onChange(k)}>
        <span class="region-flag">${r.flag}</span>
        <span class="region-text"><b>${r.label}</b><small>${REGION_INFO[k]}</small></span>
        <span class="radio"><i></i></span>
      </button>`)}
    </div>
    ${error ? html`<span class="field-error">${error}</span>` : html`<span class="field-hint">Podrás cambiarlo luego en Ajustes.</span>`}
  </div>`;
}

// Usuario con validación de formato y disponibilidad mientras escribes.
export function UsernameField({ value, onChange, error, onStatus }) {
  const [status, setStatus] = useState('');
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    const u = value.trim().toLowerCase();
    if (!u) { setStatus(''); onStatus?.(''); return; }
    if (!USERNAME_RE.test(u)) { setStatus('format'); onStatus?.('format'); return; }
    setStatus('checking'); onStatus?.('checking');
    t.current = setTimeout(async () => {
      const ok = await api.auth.usernameAvailable(u).catch(() => true);
      setStatus(ok ? 'ok' : 'taken'); onStatus?.(ok ? 'ok' : 'taken');
    }, 400);
    return () => clearTimeout(t.current);
  }, [value]);
  const msg = error || (status === 'format' ? '3 a 20 caracteres: letras minúsculas, números, punto o guion bajo.' : status === 'taken' ? 'Ese usuario ya está en uso.' : '');
  return html`<${Field} label="Usuario" error=${msg}
    hint=${status === 'ok' ? '✓ Disponible' : status === 'checking' ? 'Comprobando…' : 'Con él entrarás a la app.'}>
    <div class="input-affix"><span>@</span>
      <input class="input" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="luis.zea"
        value=${value} onInput=${(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ''))} /></div>
  <//>`;
}

function PasswordInput({ value, onInput, autocomplete, show, setShow }) {
  return html`<div class="input-affix right">
    <input class="input" type=${show ? 'text' : 'password'} required autocomplete=${autocomplete} value=${value} onInput=${onInput} placeholder="••••••••" />
    <button type="button" class="icon-btn sm" onClick=${() => setShow(!show)} aria-label=${show ? 'Ocultar contraseña' : 'Mostrar contraseña'}><${Icon} name=${show ? 'eyeOff' : 'eye'} size=${18} /></button>
  </div>`;
}

// onSession(session): la app entra al inicio al instante en cuanto Supabase devuelve una sesión válida.
export function AuthScreen({ onSession }) {
  const [mode, setMode] = useState('login'); // login | signup | reset
  const [f, setF] = useState({ login: '', email: '', password: '', password2: '', name: '', username: '', region: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrors({}); };
  const go = (m) => { setMode(m); setErrors({}); setNotice(''); };

  function validateSignup() {
    const e = {};
    if (!f.name.trim()) e.name = 'Escribe tu nombre.';
    if (!USERNAME_RE.test(f.username)) e.username = 'Elige un usuario válido.';
    else if (userStatus === 'taken') e.username = 'Ese usuario ya está en uso.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Escribe un correo válido (sirve para recuperar la contraseña).';
    if (f.password.length < 8) e.password = 'Mínimo 8 caracteres.';
    else if (f.password !== f.password2) e.password2 = 'Las contraseñas no coinciden.';
    if (!f.region) e.region = 'Elige tu país para continuar.';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit(ev) {
    ev.preventDefault();
    setNotice('');
    if (mode === 'signup' && !validateSignup()) return;
    setBusy(true);
    try {
      if (mode === 'login') {
        const r = await api.auth.signIn(f.login, f.password);
        if (r?.session) onSession?.(r.session);
      } else if (mode === 'signup') {
        const r = await api.auth.signUp(f.email.trim(), f.password, { display_name: f.name.trim(), username: f.username, region: f.region });
        if (r.session) onSession?.(r.session);
        else if (r.needsConfirm) { go('login'); setF((x) => ({ ...x, login: x.username, password: '' })); setNotice(`Te enviamos un correo a ${f.email}. Confírmalo y luego entra con @${f.username}.`); }
      } else {
        await api.auth.reset(f.email.trim());
        setNotice('Si el correo existe, te llegará un enlace para crear una contraseña nueva.');
      }
    } catch (err) {
      const m = errorText(err);
      setErrors({ form: /saving new user|duplicate/i.test(err?.message || '') ? 'Ese usuario o correo ya está registrado.' : m });
    } finally { setBusy(false); }
  }

  const strength = f.password.length === 0 ? 0 : f.password.length < 8 ? 1 : /[A-Z]/.test(f.password) && /\d/.test(f.password) && f.password.length >= 10 ? 3 : 2;

  return html`<main class="auth">
    <div class="auth-brand">
      <img src="icons/icon-192.png" alt="" width="76" height="76" class="logo" />
      <h1>La Fructosa</h1>
      <p>${mode === 'signup' ? 'Crea tu cuenta personal. Nadie más verá tu dinero.' : 'Las finanzas de la familia, cada quien con lo suyo.'}</p>
    </div>
    <form class="auth-card stack" onSubmit=${submit} novalidate>
      ${mode !== 'reset' && html`<div class="seg" role="tablist" style=${{ gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" role="tab" aria-selected=${mode === 'login'} class=${mode === 'login' ? 'on' : ''} onClick=${() => go('login')}>Entrar</button>
        <button type="button" role="tab" aria-selected=${mode === 'signup'} class=${mode === 'signup' ? 'on' : ''} onClick=${() => go('signup')}>Crear cuenta</button>
      </div>`}

      ${mode === 'login' && html`
        <${Field} label="Usuario o correo">
          <input class="input" autocomplete="username" autocapitalize="none" spellcheck="false" required value=${f.login} onInput=${set('login')} placeholder="luis.zea" />
        <//>
        <${Field} label="Contraseña" action=${html`<button type="button" class="link" onClick=${() => go('reset')}>¿La olvidaste?</button>`}>
          <${PasswordInput} value=${f.password} onInput=${set('password')} autocomplete="current-password" show=${show} setShow=${setShow} />
        <//>`}

      ${mode === 'signup' && html`
        <${Field} label="Nombre" error=${errors.name}><input class="input" autocomplete="given-name" value=${f.name} onInput=${set('name')} placeholder="Tu nombre" /><//>
        <${UsernameField} value=${f.username} onChange=${(v) => { setF({ ...f, username: v }); setErrors({}); }} error=${errors.username} onStatus=${setUserStatus} />
        <${Field} label="Correo" error=${errors.email} hint="Solo para confirmar tu cuenta y recuperar la contraseña.">
          <input class="input" type="email" autocomplete="email" value=${f.email} onInput=${set('email')} placeholder="tu@correo.com" />
        <//>
        <${Field} label="Contraseña" error=${errors.password}>
          <${PasswordInput} value=${f.password} onInput=${set('password')} autocomplete="new-password" show=${show} setShow=${setShow} />
          ${f.password && html`<div class=${'strength s' + strength}><i></i><i></i><i></i><small>${['', 'Muy corta', 'Aceptable', 'Fuerte'][strength]}</small></div>`}
        <//>
        <${Field} label="Repite la contraseña" error=${errors.password2}>
          <input class="input" type=${show ? 'text' : 'password'} autocomplete="new-password" value=${f.password2} onInput=${set('password2')} placeholder="••••••••" />
        <//>
        <${RegionPicker} value=${f.region} onChange=${(r) => { setF({ ...f, region: r }); setErrors({}); }} error=${errors.region} />`}

      ${mode === 'reset' && html`
        <div><h2 class="card-title">Recuperar contraseña</h2><p class="hint">Escribe el correo con el que te registraste y te enviamos un enlace.</p></div>
        <${Field} label="Correo"><input class="input" type="email" autocomplete="email" required value=${f.email} onInput=${set('email')} placeholder="tu@correo.com" /><//>`}

      ${errors.form && html`<p class="form-error">${errors.form}</p>`}
      ${notice && html`<p class="callout good">${notice}</p>`}
      <button class="btn primary block lg" disabled=${busy || (mode === 'signup' && !f.region)}>
        ${busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? (f.region ? `Crear mi cuenta · ${REGIONS[f.region].flag}` : 'Elige tu país para continuar') : 'Enviar enlace'}
      </button>
      ${mode === 'reset' && html`<button type="button" class="btn ghost block" onClick=${() => go('login')}>Volver</button>`}
    </form>
    <p class="auth-foot"><${Icon} name="lock" size=${14} /> Privacidad total: nadie más ve tus cuentas.<br/><a href="?demo">Probar con datos de ejemplo</a></p>
  </main>`;
}

// Cuentas creadas antes de la 2.1 (sin usuario): eligen usuario y país una sola vez.
export function CompleteProfile() {
  const { profile, actions } = useData();
  const [username, setUsername] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!USERNAME_RE.test(username) || status === 'taken') er.username = status === 'taken' ? 'Ese usuario ya está en uso.' : 'Elige un usuario válido.';
    if (!region) er.region = 'Elige tu país para continuar.';
    setErrors(er);
    if (Object.keys(er).length) return;
    // Guardado optimista: el perfil se aplica ya en la app y la pantalla principal se muestra
    // de inmediato. La escritura sigue en segundo plano; si el usuario resulta repetido,
    // el store revierte y esta pantalla vuelve con el aviso.
    setBusy(true);
    actions.updateProfile({ username, region, preferred_currency: REGIONS[region].base }, { optimistic: true })
      .then(() => toast(`¡Listo, @${username}!`))
      .catch((x) => toast(/duplicate|unique/i.test(x?.message || '') ? `El usuario @${username} ya está en uso. Elige otro.` : errorText(x), { tone: 'bad' }))
      .finally(() => setBusy(false));
    location.hash = '#/inicio';
  }

  return html`<main class="auth">
    <div class="auth-brand">
      <img src="icons/icon-192.png" alt="" width="64" height="64" class="logo" />
      <h1>La Fructosa</h1>
      <p>Hola${profile.display_name ? ', ' + profile.display_name : ''}. Elige tu usuario y tu país: la app se adapta a cada uno.</p>
    </div>
    <form class="auth-card stack" onSubmit=${submit} novalidate>
      <${UsernameField} value=${username} onChange=${(v) => { setUsername(v); setErrors({}); }} error=${errors.username} onStatus=${setStatus} />
      <${RegionPicker} value=${region} onChange=${(r) => { setRegion(r); setErrors({}); }} error=${errors.region} />
      ${errors.form && html`<p class="form-error">${errors.form}</p>`}
      <button class="btn primary block lg" disabled=${busy || !region}>${busy ? 'Guardando…' : region ? 'Continuar' : 'Elige tu país para continuar'}</button>
    </form>
    <p class="auth-foot"><button class="link" onClick=${() => api.auth.signOut()}>Cerrar sesión</button></p>
  </main>`;
}
