// Confianza y términos: antes del recorrido de bienvenida, cada persona ve en palabras simples por qué
// sus datos están seguros y acepta los términos. La aceptación se guarda en su cuenta (sirve en cualquier
// teléfono) y en este teléfono (para abrir sin internet). Si cambian los términos, se sube TERMS_VERSION
// y todos los vuelven a ver una vez.
import { useCallback, useEffect, useState } from 'react';
import { html, Icon, toast, errorText } from './ui.js';
import { api } from './api.js';
import { PageHeader } from './screens/common.js';

export const TERMS_VERSION = 1;
export const TERMS_DATE = '11 de octubre de 2026';

const TRUST = [
  ['lock', 'Tus datos son solo tuyos', 'Cada cuenta está separada y protegida en el servidor. Nadie más puede ver tus saldos ni tus movimientos: ni otros usuarios ni quien vea el código de la app.'],
  ['shield', 'No tocamos tu dinero', 'La Fructosa no se conecta a tu banco ni te pide claves bancarias. Solo guarda lo que tú anotas.'],
  ['fingerprint', 'Tu contraseña, protegida', 'Se guarda cifrada y nadie puede leerla, ni siquiera el administrador. Además, puedes bloquear la app con Face ID, huella digital o PIN.'],
  ['sparkle', 'Fructosa (la IA) es opcional', 'Solo funciona si tú la activas. Google procesa lo que le escribes para poder responderte, así que no le envíes claves ni datos que no quieras compartir.'],
  ['download', 'Tus datos te pertenecen', 'Descarga un archivo de Excel con todo cuando quieras y, si un día decides irte, puedes borrar tu cuenta con todos sus datos desde Ajustes.'],
  ['info', 'Una herramienta para organizar tus finanzas', 'Las tasas provienen de fuentes públicas y son solo de referencia. La app no es un banco ni ofrece asesoría financiera.'],
];

// Texto completo (también en Más › Ajustes › Términos y privacidad).
export const TERMS = [
  ['1. Qué es La Fructosa', 'La Fructosa es una aplicación gratuita para llevar el control de tus finanzas personales: cuentas, gastos, ingresos, presupuestos, pagos fijos, metas, préstamos y tasas de cambio. No es un banco, no mueve dinero, no se conecta a tus cuentas bancarias y no ofrece asesoría financiera, legal ni fiscal.'],
  ['2. Tu cuenta', 'Para usarla, creas una cuenta con un nombre de usuario, un correo electrónico y una contraseña. Eres responsable de mantener tu contraseña en secreto y de la actividad que ocurra en tu cuenta. Si crees que alguien la conoce, cámbiala en Ajustes. Puedes activar el bloqueo con Face ID, huella digital o PIN en tu teléfono.'],
  ['3. Qué datos guardamos', 'Guardamos lo que tú escribes en la app (cuentas, montos, categorías, descripciones, metas y préstamos), además de tu nombre de usuario, tu correo electrónico, tu país y tus preferencias. No pedimos ni guardamos claves bancarias, números de tarjeta ni documentos de identidad.'],
  ['4. Cómo los protegemos', 'Tus datos viajan cifrados (HTTPS) y se guardan en Supabase, un servicio profesional de bases de datos. Cada registro está vinculado a tu cuenta mediante reglas de seguridad en el propio servidor: aunque el código de la app sea visible, nadie puede leer los datos de otra persona. Las contraseñas se guardan cifradas y no se pueden leer.'],
  ['5. Con quién se comparten', 'No vendemos tus datos ni los compartimos con nadie con fines publicitarios. Solo intervienen los servicios que hacen funcionar la app: Supabase (base de datos y acceso), GitHub Pages (donde está alojada la app) y, únicamente si usas el copiloto, Google Gemini. Las tasas se consultan en fuentes públicas (DolarApi y Binance P2P) sin enviar ningún dato tuyo.'],
  ['6. El copiloto con IA', 'Fructosa, el copiloto con IA, es opcional y te pide permiso antes de usarse. Para responderte, envía a Google tu pregunta, las capturas que adjuntes y un resumen de tus cuentas. En la versión gratuita de Gemini, Google puede conservar esas conversaciones y revisarlas para mejorar sus servicios. Las respuestas de la IA pueden contener errores: revisa siempre los montos antes de guardar un movimiento. Nunca le envíes contraseñas ni claves.'],
  ['7. Tus derechos', 'Puedes ver y corregir tus datos en cualquier momento, descargarlos completos en un archivo de Excel (Ajustes › Respaldo) y borrar tu cuenta con todos sus datos (Ajustes › Borrar mi cuenta). El borrado es inmediato y no se puede deshacer.'],
  ['8. Respaldo y disponibilidad', 'Hacemos todo lo posible para que la app funcione de forma continua, pero pueden ocurrir fallas de internet, del servidor o de los servicios externos. Por eso te recordamos que hagas tu respaldo en Excel cada semana y lo guardes en un lugar seguro.'],
  ['9. Tasas de cambio', 'Las tasas de cambio se obtienen de fuentes públicas varias veces al día y son solo de referencia. Pueden tener retrasos o diferencias con la tasa que te ofrezcan en un comercio o en tu banco.'],
  ['10. Uso correcto', 'Te comprometes a usar la app solo para tus finanzas personales, a no intentar acceder a cuentas ajenas, a no interferir con el servicio y a no usarla para actividades ilegales. Podemos suspender las cuentas que hagan un uso indebido.'],
  ['11. Responsabilidad', 'La app se ofrece «tal cual» y sin costo. Las decisiones que tomes con tu dinero son responsabilidad tuya. No nos hacemos responsables de las pérdidas causadas por datos mal anotados, tasas desactualizadas, respuestas de la IA o fallas de servicios externos.'],
  ['12. Cambios', 'Si cambiamos estos términos, te los mostraremos de nuevo al iniciar sesión y tendrás que aceptarlos para seguir usando la app. Si no estás de acuerdo, puedes descargar tus datos y borrar tu cuenta.'],
];

const localKey = (uid) => 'fructosa-terms-' + (uid || 'demo');
const readLocal = (uid) => { try { return Number(localStorage.getItem(localKey(uid))) || 0; } catch { return 0; } };
const writeLocal = (uid, v) => { try { localStorage.setItem(localKey(uid), String(v)); } catch { /* nada */ } };

// [aceptado: true | false | null (revisando), aceptar()]
export function useTerms(uid) {
  const [ok, setOk] = useState(() => (readLocal(uid) >= TERMS_VERSION ? true : null));
  useEffect(() => {
    let alive = true;
    api.auth.termsVersion().then((v) => {
      if (!alive) return;
      if (v >= TERMS_VERSION) { writeLocal(uid, v); setOk(true); }
      else if (readLocal(uid) >= TERMS_VERSION) api.auth.acceptTerms(TERMS_VERSION).catch(() => {}); // aceptó sin internet
      else setOk(false);
    }).catch(() => { if (alive && readLocal(uid) < TERMS_VERSION) setOk(false); });
    return () => { alive = false; };
  }, [uid]);
  const accept = useCallback(async () => {
    writeLocal(uid, TERMS_VERSION);
    setOk(true);
    try { await api.auth.acceptTerms(TERMS_VERSION); } catch { /* se sube la próxima vez que haya internet */ }
  }, [uid]);
  return [ok, accept];
}

function TermsText() {
  return html`<div class="prose terms-text">
    ${TERMS.map(([t, p]) => html`<p key=${t}><b>${t}.</b> ${p}</p>`)}
    <p class="muted">Última actualización: ${TERMS_DATE}.</p>
  </div>`;
}

export function TermsGate({ onAccept }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    try { await api.auth.signOut(); } catch (e) { toast(errorText(e), { tone: 'bad' }); }
  };
  return html`<div class="onboard terms-gate" role="dialog" aria-modal="true" aria-labelledby="terms-title">
    <div class="terms-scroll">
      <div class="terms-head">
        <span class="terms-badge"><${Icon} name="shield" size=${34} /></span>
        <h1 id="terms-title">Tu tranquilidad es lo primero</h1>
        <p>Antes de empezar, esto es lo que debes saber sobre La Fructosa.</p>
      </div>
      <ul class="trust-list">${TRUST.map(([icon, title, text]) => html`<li key=${title}>
        <span class="trust-ico"><${Icon} name=${icon} size=${20} /></span>
        <div><b>${title}</b><small>${text}</small></div>
      </li>`)}</ul>
      <details class="card pad glossary terms-more">
        <summary><b>Leer los términos y condiciones completos</b><${Icon} name="down" size=${18} /></summary>
        <${TermsText} />
      </details>
    </div>
    <div class="onboard-foot terms-foot">
      <label class="terms-check">
        <input type="checkbox" checked=${checked} onChange=${(e) => setChecked(e.target.checked)} />
        <span>He leído y acepto los <b>términos y condiciones</b> y la <b>política de privacidad</b>.</span>
      </label>
      <button class="btn primary lg" disabled=${!checked || busy} onClick=${async () => { setBusy(true); await onAccept(); }}>
        Acepto y continuar <${Icon} name="right" size=${18} /></button>
      <button class="btn ghost sm" onClick=${leave}>No acepto, salir</button>
    </div>
  </div>`;
}

export function TermsPage() {
  return html`<div class="page">
    <${PageHeader} title="Términos y privacidad" sub=${'Versión ' + TERMS_VERSION + ' · ' + TERMS_DATE} back="#/ajustes" />
    <ul class="trust-list card pad">${TRUST.map(([icon, title, text]) => html`<li key=${title}>
      <span class="trust-ico"><${Icon} name=${icon} size=${20} /></span>
      <div><b>${title}</b><small>${text}</small></div>
    </li>`)}</ul>
    <div class="card pad"><${TermsText} /></div>
  </div>`;
}
