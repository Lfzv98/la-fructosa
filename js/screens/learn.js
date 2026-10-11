// Manual de uso y "Aprende": cómo sacarle provecho a la app, contado como entre amigos.
import { html, Icon, SectionTitle } from '../ui.js';
import { useData, usePref } from '../store.js';
import { GLOSSARY } from '../learn.js';
import { PageHeader, go } from './common.js';
import { REGIONS } from '../money.js';

// Guía por funciones. `only` limita una sección a ciertos países.
const MANUAL = [
  {
    emoji: '🏦',
    title: 'Empieza por tus cuentas',
    body: [
      'Una cuenta es cualquier lugar donde guardas dinero: la cartera, el banco, una app de pago o tus criptos.',
      'Créalas una sola vez, ponles lo que tienes hoy y listo. Desde ahí, la app va sumando y restando por ti.',
      'En "Cuentas" también puedes archivar las que ya no uses, sin perder el historial.',
    ],
  },
  {
    emoji: '💰',
    title: 'Tu resumen en el inicio',
    body: [
      'Lo primero que ves es cuánto tienes en total, sumando todas tus cuentas en una sola moneda. Puedes cambiarla con los botoncitos de arriba a la derecha.',
      'Debajo ves cuánto entró, cuánto salió y qué porcentaje te está quedando este mes.',
      'Si estás en un lugar público, toca el ojito y los montos se ocultan.',
    ],
  },
  {
    emoji: '💱',
    title: 'El dólar de hoy: BCV, Paralelo y USDT',
    only: ['VE'],
    body: [
      'Mira tus dólares y bolívares al mismo tiempo, con el precio del día: el dólar oficial (BCV), el del mercado (Paralelo) y el USDT.',
      'La "brecha" es solo cuánto más cuesta el dólar en la calle que en el banco. Si es grande, conviene fijarse bien antes de cambiar o pagar en bolívares.',
      'Las tasas se actualizan solas varias veces al día. En "Tasas" también puedes tocar actualizar, y si pasan 2 días sin tasas nuevas la app te avisa. Tienes además una calculadora para convertir rápido.',
    ],
  },
  {
    emoji: '➕',
    title: 'Anota un gasto o un ingreso',
    body: [
      'Toca el botón + de abajo, escribe cuánto fue y elige la categoría. Ya está.',
      'Si te pagaron o pagaste en otra moneda, la app hace la cuenta por ti.',
      'Si te equivocas, toca el movimiento en la lista y lo corriges o lo borras.',
    ],
  },
  {
    emoji: '📷',
    title: 'Registra con una captura de cualquier pago',
    body: [
      'En el Copiloto toca la cámara 📷 y elige la captura o la foto del comprobante. Sirve de cualquier banco o app: Pago Móvil, transferencias de Banesco, Mercantil, Provincial, Venezuela y los demás bancos, Zelle, Binance, PayPal, Zinli, Wally, Venmo, Cash App, Bizum, una factura o un ticket.',
      'Fructosa lee el monto, la moneda, la fecha, si fue un pago o un cobro y la comisión si la hay. Te muestra el movimiento listo con la cuenta que corresponde y tú tocas "Guardar". Nada se guarda sin tu confirmación.',
      'Si la captura es un cambio de divisa entre tus propias cuentas (por ejemplo vender USDT y recibir bolívares), te dirá que lo anotes como Transferencia con el botón +.',
      'Por tu seguridad, Fructosa nunca repite números de cuenta, cédulas ni teléfonos que aparezcan en la imagen.',
    ],
  },
  {
    emoji: '📶',
    title: 'Sin internet también funciona',
    body: [
      'Si te quedas sin señal, la app abre con lo último que cargó y puedes seguir anotando gastos e ingresos.',
      'Arriba verás "⏳ movimientos por subir". Cuando vuelva el internet se suben solos, sin duplicarse.',
    ],
  },
  {
    emoji: '💾',
    title: 'Tu respaldo semanal en Excel',
    body: [
      'En Ajustes › Respaldo descargas un Excel con todo: cuentas, movimientos, presupuestos, pagos fijos, metas, préstamos y tasas. Guárdalo en una carpeta segura, en tu computadora o en la nube.',
      'Si pasan 7 días sin respaldo, la app te lo recuerda con una tarjeta en el inicio, un aviso arriba en las demás pantallas y, si activaste los avisos, una notificación en el teléfono.',
    ],
  },
  {
    emoji: '🏁',
    title: 'Metas de ahorro y préstamos',
    body: [
      'En Más › Metas de ahorro creas una meta (un viaje, una laptop), le pones cuánto y para cuándo, y vas abonando. La app te dice cuánto apartar cada mes para llegar.',
      'En Más › Préstamos anotas quién te debe y a quién le debes. Cuando te pagan o pagas, tocas "Me pagó" o "Pagué" y el saldo se actualiza.',
    ],
  },
  {
    emoji: '🔔',
    title: 'Avisos en tu teléfono',
    body: [
      'En Ajustes › Avisos activas las notificaciones: pagos fijos que vencen hoy o mañana, préstamos que vencen, las tasas de la mañana y el recordatorio de respaldo.',
      'En iPhone primero instala la app en tu pantalla de inicio (Safari › Compartir › Agregar a inicio).',
    ],
  },
  {
    emoji: '🔒',
    title: 'Bloqueo con Face ID, huella o PIN',
    body: [
      'En Ajustes › Privacidad y seguridad activas el bloqueo. Cada vez que abras la app, o vuelvas a ella después de un minuto, te pedirá tu cara, tu huella o tu PIN.',
      'Si olvidas el PIN, toca "Olvidé mi PIN": sales de la sesión y entras de nuevo con tu contraseña.',
    ],
  },
  {
    emoji: '🛡️',
    title: 'Tu privacidad y tus derechos',
    body: [
      'Tus datos son solo tuyos: cada cuenta está protegida en el servidor y nadie más puede verla. La app no se conecta a tu banco ni te pide claves bancarias.',
      'Puedes leer los términos cuando quieras en Ajustes › Términos y privacidad, y si un día decides irte, en Ajustes › Borrar mi cuenta eliminas tu cuenta con todos sus datos (antes te ofrece descargar tu respaldo).',
    ],
  },
  {
    emoji: '🌗',
    title: 'Modo claro u oscuro',
    body: ['En Ajustes › Apariencia eliges Oscuro, Claro o Automático (sigue el modo de tu teléfono).'],
  },
  {
    emoji: '💡',
    title: 'Los consejos de Fructosa',
    body: [
      'Arriba en el inicio te aparece un avisito cuando hay algo útil: si el mercado se te está yendo de las manos, si te acercas al tope de un presupuesto o si el dólar se movió.',
      'Para quitarlo, deslízalo hacia arriba o hacia un lado (o toca la ✕). Ese consejo no vuelve a salir en el mismo mes o día; cuando cambien las cosas, te avisamos de nuevo.',
    ],
  },
  {
    emoji: '🎙️',
    title: 'Háblale a Fructosa',
    body: [
      'Entra al Copiloto y toca el micrófono. Dile algo como "¿cuánto gasté en comida este mes?" o "gasté 20 dólares en el mercado".',
      'Lo que dices se va escribiendo en tiempo real. Cuando termines, toca enviar y Fructosa te responde (y te lo puede leer en voz alta si quieres).',
      'Si el navegador te pide permiso para usar el micrófono, dile que sí. Funciona mejor en Chrome, Edge y Safari.',
    ],
  },
  {
    emoji: '🎯',
    title: 'Presupuestos y pagos fijos',
    body: [
      'Un presupuesto es el tope que te pones para una categoría, por ejemplo "mercado: 200 al mes". La barra te va mostrando cuánto llevas y te avisa antes de que te pases.',
      'Los pagos fijos son los que se repiten (alquiler, internet, Netflix). La app te recuerda cuándo vencen y los anota con un toque.',
    ],
  },
  {
    emoji: '📊',
    title: 'Análisis del mes',
    body: [
      'Ahí ves en qué se va tu plata, mes por mes, y cómo vas comparado con el mes anterior.',
      'Un buen hábito: darle una miradita cada lunes.',
    ],
  },
];

// Qué cuentas te sugerimos en cada país.
const BY_REGION = {
  VE: {
    title: 'Venezuela',
    text: 'Pago Móvil, efectivo en dólares y en bolívares, Zelle, Binance (USDT), y tu banco, como Banesco o Mercantil. Además ves el dólar BCV, el Paralelo y el USDT.',
  },
  US: {
    title: 'Estados Unidos',
    text: 'Zelle, Venmo, Cash App, Apple Pay, tu tarjeta de crédito y tu cuenta de cheques (checking account). Todo en dólares, sin tasas ni complicaciones.',
  },
  ES: {
    title: 'España y Europa',
    text: 'Bizum, tu cuenta con IBAN o transferencias, la tarjeta de débito y el efectivo en euros. Todo en euros, sin tasas ni complicaciones.',
  },
};

export function LearnPage() {
  const { profile } = useData();
  const [, setTourDone] = usePref('tour-done', false);
  const mine = profile?.region || 'VE';
  const manual = MANUAL.filter((m) => !m.only || m.only.includes(mine));
  const regions = [mine, ...Object.keys(BY_REGION).filter((k) => k !== mine)];

  const replayTour = () => { setTourDone(false); go('#/'); window.scrollTo(0, 0); };

  return html`<div class="page">
    <${PageHeader} title="Manual de uso" sub="Cómo sacarle el jugo a La Fructosa" back="#/mas" />

    <button class="card pad tour-cta" onClick=${replayTour}>
      <span class="tile-ico" style=${{ '--tc': '#FFADAD' }}><${Icon} name="sparkle" /></span>
      <span><b>Ver el tour otra vez</b><small>Te lo enseñamos paso a paso, en 1 minuto</small></span>
      <${Icon} name="right" class="muted" />
    </button>

    <${SectionTitle}>Lo básico, en palabras simples<//>
    <div class="stack sm">${manual.map((m) => html`<details key=${m.title} class="card pad glossary">
      <summary><b>${m.emoji} ${m.title}</b><${Icon} name="down" size=${18} /></summary>
      <div class="prose">${m.body.map((p, i) => html`<p key=${i}>${p}</p>`)}</div>
    </details>`)}</div>

    <${SectionTitle}>Según tu país<//>
    <div class="stack sm">${regions.map((k) => html`<div key=${k} class=${'card pad prose' + (k === mine ? ' region-mine' : '')}>
      <p><b>${REGIONS[k].flag} ${BY_REGION[k].title}${k === mine ? ' · tu país' : ''}</b></p>
      <p>${BY_REGION[k].text}</p>
    </div>`)}</div>
    <p class="hint">¿Cambiaste de país? Lo ajustas en Ajustes y las sugerencias se actualizan solas.</p>

    <${SectionTitle}>Palabras que te pueden sonar raras<//>
    <div class="stack sm">${Object.entries(GLOSSARY).map(([k, g]) => html`<details key=${k} class="card pad glossary">
      <summary><b>${g.title}</b><${Icon} name="down" size=${18} /></summary>
      <div class="prose">${g.body.map((p, i) => html`<p key=${i}>${p}</p>`)}</div>
    </details>`)}</div>

    <${SectionTitle}>Tres hábitos que funcionan<//>
    <div class="card pad prose">
      <p><b>1. Anota al momento.</b> Diez segundos después de pagar es mucho más fácil que acordarte de todo por la noche.</p>
      <p><b>2. Revisa los lunes.</b> Abre Análisis, mira en qué gastas más y compáralo con tu presupuesto.</p>
      <p><b>3. Págate primero.</b> Cuando te llegue el sueldo, aparta tu ahorro en una cuenta aparte antes de gastar.</p>
    </div>
  </div>`;
}
