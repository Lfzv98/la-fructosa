// La Fructosa · Manual de uso (howToUseIt)
// Fuente única del manual: la pantalla Más › Manual de uso lo muestra y docs/howToUseIt.md
// se genera a partir de este archivo (node tests/howToUseIt.test.mjs --write).
// Solo datos, sin interfaz: así también se puede leer y probar fuera del navegador.

export const MANUAL_VERSION = 'v23';
// Enlace que se muestra en el manual: el de donde está abierta la app (Vercel, GitHub Pages
// o el dominio que sea). Fuera del navegador (pruebas, docs/howToUseIt.md) se usa el oficial.
const HERE = typeof location !== 'undefined' && /^https?:$/.test(location.protocol)
  ? location.origin + location.pathname.replace(/[^/]*$/, '') : '';
export const APP_URL = HERE || 'https://lfzv98.github.io/la-fructosa/';

// Las cinco funciones principales, paso a paso. `only` limita una sección a ciertos países.
export const CORE = [
  {
    id: 'cuentas',
    emoji: '🏦',
    title: 'Tus cuentas: crea, elige moneda y banco',
    intro: 'Una cuenta es cualquier lugar donde guardas dinero: la cartera, un banco, una app de pagos o tu billetera de cripto. Cada cuenta tiene una sola moneda: USD, Bs. (VES), USDT o EUR.',
    steps: [
      'Entra a Más › Cuentas y toca "+ Nueva" (la primera vez, la bienvenida te ofrece crearlas de una vez).',
      'Usa una plantilla rápida (Pago Móvil, Zelle, Efectivo USD, Binance…) o arma la tuya.',
      'Elige la moneda (USD, VES, USDT o EUR) y el tipo (Efectivo, Banco, Digital o Cripto).',
      'Escribe el nombre. Si es tipo Banco, la app te sugiere bancos según la moneda: en bolívares, la lista completa de bancos venezolanos (BDV, Banesco, Mercantil, Provincial, BNC, Bancamiga, Tesoro, Bancaribe, Exterior, Banplus, BFC, Activo, Plaza, Sofitasa, 100% Banco, DelSur, Bancrecer, R4, Banfanb y los demás); en dólares, euros o USDT, bancos internacionales, apps de pago (Zelle, PayPal, Wise, Zinli, Wally, Airtm…) y cripto (Binance, Bybit, OKX…). Si el tuyo no aparece, escríbelo.',
      'Escribe el saldo que tienes hoy (puede ser 0) y toca "Crear cuenta". Desde ahí la app suma y resta sola con cada movimiento.',
    ],
    tips: [
      'Archiva las cuentas que ya no uses: desaparecen de la lista pero su historial se conserva.',
      'Vives fuera de Venezuela: elige tu país (o "Otro país") en Ajustes. Si conservas una cuenta en bolívares, créala igual: las tasas BCV, Paralelo y USDT se activan solas.',
      'En el inicio ves el patrimonio total de todas tus cuentas convertido a la moneda que prefieras (USD, Bs. o EUR).',
    ],
  },
  {
    id: 'registros',
    emoji: '➕',
    title: 'Registrar gastos, ingresos y transferencias',
    intro: 'Todo movimiento se anota con el botón + del centro, en menos de diez segundos.',
    steps: [
      'Toca el botón + de abajo.',
      'Elige Gasto, Ingreso o Transferencia.',
      'Escribe el monto y elige la cuenta (de dónde sale o a dónde entra).',
      'Elige la categoría (Comida, Mercado, Servicios, Transporte, Sueldo, Remesas…), y si quieres agrega una descripción o cambia la fecha.',
      'Toca Guardar.',
    ],
    tips: [
      'Transferencia es mover dinero entre TUS cuentas (por ejemplo, de Zelle a Binance). No es gasto ni ingreso: tu patrimonio no cambia. Elige "Desde" y "Hacia"; si las monedas son distintas, escribe cuánto llegó y la app calcula la tasa a la que cambiaste.',
      'Si pagas en bolívares desde una cuenta en dólares o USDT, activa "Pagué en bolívares": escribe los Bs. y la tasa que usaste, y la app te dice el costo real en dólares y cuánto te ahorró o te costó la brecha frente al BCV.',
      '¿Te equivocaste? Toca el movimiento en Movimientos para corregirlo o borrarlo.',
    ],
  },
  {
    id: 'copiloto',
    emoji: '✨',
    title: 'Copiloto IA (Fructosa): voz, texto y capturas',
    intro: 'Fructosa es tu asistente con inteligencia artificial. Conoce tus cuentas y te ayuda a registrar sin escribir formularios. Ábrela con el botón "Copiloto IA" del inicio.',
    steps: [
      'Texto libre: escribe como hablas, por ejemplo "gasté 12 dólares en el mercado con Zelle" o "me pagaron 300 de sueldo en Banesco".',
      'Nota de voz: toca el micrófono 🎙️ y dilo en voz alta. Lo que dices se escribe en tiempo real; cuando termines, toca enviar.',
      'Captura o foto: toca la cámara 📷 y elige la captura del comprobante (Pago Móvil, transferencia, Zelle, Binance, PayPal, Zinli, una factura o un ticket).',
      'Fructosa te muestra el movimiento listo: monto, moneda, fecha, cuenta y categoría. Revísalo y toca "Registrar", o "Descartar" si algo no cuadra.',
    ],
    tips: [
      'Nada se guarda sin que toques "Registrar".',
      'También responde preguntas: "¿cuánto tengo en total?", "¿en qué gasté más este mes?", "calcúlame 400 euros a tasa BCV".',
      'Si una captura es un cambio de divisa entre tus propias cuentas (vender USDT y recibir bolívares), te pedirá anotarlo como Transferencia con el botón +.',
      'Por tu seguridad, Fructosa nunca repite números de cuenta, cédulas ni teléfonos que aparezcan en una imagen. La primera vez te pide permiso para usar la IA; si el navegador pide el micrófono, acepta.',
    ],
  },
  {
    id: 'conciliacion',
    emoji: '⚖️',
    title: 'Conciliación semanal: tu saldo igual a la realidad',
    intro: 'Conciliar es comparar el saldo de la app con el de tu banco o tu cartera y corregir la diferencia. Hazlo una vez por semana (por ejemplo, cada domingo) y tu patrimonio siempre será real.',
    steps: [
      'Abre la app de tu banco (o cuenta el efectivo) y anota el saldo real de cada cuenta.',
      'En La Fructosa entra a Más › Cuentas y toca la cuenta.',
      'Si el saldo coincide, listo. Si no, revisa en su lista de movimientos si te faltó anotar algo (una comisión, un Pago Móvil, una compra pequeña) y regístralo.',
      'Si aún hay diferencia, toca "Ajustar", escribe el saldo real y confirma. La app registra la diferencia como "Ajuste de saldo".',
      'Repite con cada cuenta y termina en Análisis para ver cómo va el mes.',
    ],
    tips: [
      'Un ajuste grande o frecuente es una señal: hay gastos que se te escapan. Anótalos al momento la semana siguiente.',
      'Las comisiones bancarias y de cambio cuentan: anótalas como gasto para que el saldo cuadre.',
    ],
  },
  {
    id: 'exportar',
    emoji: '📤',
    title: 'Exportación y respaldo: Excel y CSV',
    intro: 'Tus datos son tuyos y puedes llevártelos cuando quieras para tu control local.',
    steps: [
      'Respaldo completo en Excel: Más › Ajustes › Respaldo › "Descargar todos mis datos (Excel)". Trae resumen, cuentas, movimientos, presupuestos, pagos fijos, metas, préstamos y tasas.',
      'Movimientos en CSV: en Movimientos filtra lo que quieras (mes, cuenta, categoría) y toca el ícono de descarga ⬇️. En Análisis, el mismo ícono exporta el mes que estás viendo.',
      'En iPhone, cuando aparezca el menú de compartir, toca "Guardar en Archivos" y elige una carpeta (iCloud Drive o En mi iPhone). En computadora se descarga directo.',
      'Abre el archivo en Excel, Numbers o Google Sheets. El CSV viene separado por punto y coma, con acentos y montos listos para Excel en español.',
    ],
    tips: [
      'Haz tu respaldo cada semana, después de conciliar. Si pasan 7 días sin respaldo, la app te lo recuerda.',
    ],
  },
];

// Otras funciones, explicadas en corto.
export const MORE = [
  {
    emoji: '💰',
    title: 'Tu resumen en el inicio',
    body: [
      'Arriba ves cuánto tienes en total, sumando todas tus cuentas en una sola moneda (cámbiala con los botones de la derecha). Debajo, cuánto entró, cuánto salió y qué porcentaje te está quedando este mes.',
      'El ícono del ojo oculta los montos si estás en un lugar público.',
    ],
  },
  {
    emoji: '💱',
    title: 'El dólar de hoy: BCV, Paralelo y USDT',
    only: 'rates',
    body: [
      'Ves el dólar oficial (BCV), el del mercado (Paralelo), el USDT y el Euro BCV. Se actualizan solos varias veces al día; en Tasas también puedes tocar actualizar.',
      'La brecha es cuánto más cuesta el dólar del mercado que el oficial. En Tasas tienes una calculadora para convertir y comparar si te conviene pagar en divisas o en bolívares.',
    ],
  },
  {
    emoji: '🎯',
    title: 'Presupuestos y pagos fijos',
    body: [
      'Un presupuesto es el tope mensual de una categoría (por ejemplo, mercado: 200 $). La barra se pone amarilla al 80% y roja al pasarte.',
      'Los pagos fijos son los que se repiten (alquiler, internet, colegio). La app te recuerda cuándo vencen y los registra con un toque.',
    ],
  },
  {
    emoji: '🏁',
    title: 'Metas de ahorro y préstamos',
    body: [
      'En Más › Metas de ahorro creas una meta con su monto y fecha y vas abonando; la app te dice cuánto apartar cada mes.',
      'En Más › Préstamos anotas quién te debe y a quién le debes. Con "Me pagó" o "Pagué" registras abonos.',
    ],
  },
  {
    emoji: '📊',
    title: 'Análisis del mes',
    body: ['En qué se va tu dinero, la comparación con el mes anterior, tu tasa de ahorro y, si usas bolívares, cuánto te ahorró o costó la brecha.'],
  },
  {
    emoji: '📶',
    title: 'Sin internet también funciona',
    body: ['Sin señal, la app abre con lo último que cargó y puedes seguir anotando. Arriba verás "⏳ movimientos por subir": se suben solos al volver la conexión, sin duplicarse.'],
  },
  {
    emoji: '🔔',
    title: 'Avisos en tu teléfono',
    body: [
      'En Ajustes › Avisos activas recordatorios de pagos fijos, préstamos, respaldo y las tasas de la mañana.',
      'En iPhone, primero instala la app en tu pantalla de inicio (ver "Instalar en iPhone").',
    ],
  },
  {
    emoji: '🔒',
    title: 'Bloqueo con Face ID, huella o PIN',
    body: ['En Ajustes › Privacidad y seguridad activas el bloqueo. Si olvidas el PIN, toca "Olvidé mi PIN" y entras de nuevo con tu contraseña.'],
  },
  {
    emoji: '🛡️',
    title: 'Tu privacidad',
    body: [
      'Cada persona tiene su propia cuenta y nadie más puede ver sus datos: el servidor lo bloquea. La app no se conecta a tu banco ni pide claves bancarias.',
      'En Ajustes › Términos y privacidad lees los términos, y en Ajustes › Borrar mi cuenta eliminas tu cuenta con todos sus datos.',
    ],
  },
  {
    emoji: '🌗',
    title: 'Modo claro u oscuro',
    body: ['En Ajustes › Apariencia eliges Oscuro, Claro o Automático.'],
  },
];

// Guía de finanzas personales: cómo ver resultados siguiendo el sistema de La Fructosa.
export const FINANCE_GUIDE = {
  motto: 'Lo que no se mide, no se controla ni se mejora.',
  intro: 'La Fructosa funciona como un sistema: registrar, conciliar, revisar y ahorrar. Si sigues estos hábitos durante un mes, vas a saber exactamente a dónde va tu dinero y qué cambiar.',
  tips: [
    {
      emoji: '📏',
      title: 'La regla de oro: mide todo',
      body: 'No puedes mejorar lo que no ves. Anota cada gasto, por pequeño que sea: el café, el estacionamiento, la comisión del banco. Los gastos "hormiga" suelen sumar entre el 10% y el 20% del mes.',
    },
    {
      emoji: '⚡',
      title: 'Registra al momento',
      body: 'Anota el gasto apenas pagues, en los siguientes diez segundos. Con Fructosa basta una nota de voz o la captura del comprobante. No dejes acumular capturas: después de dos días ya no recuerdas la mitad.',
    },
    {
      emoji: '⚖️',
      title: 'Concilia cada semana',
      body: 'Elige un día fijo (domingo funciona bien) y compara el saldo de cada cuenta con el real. Quince minutos a la semana mantienen tu patrimonio exacto y te avisan de fugas a tiempo.',
    },
    {
      emoji: '🛟',
      title: 'Fondo de emergencia primero',
      body: 'Antes de invertir o hacer compras grandes, junta entre 3 y 6 meses de tus gastos básicos en una cuenta aparte, en una moneda estable (USD o USDT). Créalo como Meta de ahorro y abónale cada mes.',
    },
    {
      emoji: '🏁',
      title: 'Metas de ahorro con fecha',
      body: 'Una meta sin fecha es un deseo. Ponle monto y fecha en Más › Metas de ahorro y la app te dice cuánto apartar cada mes. Págate primero: cuando cobres, aparta el ahorro antes de gastar.',
    },
    {
      emoji: '🧮',
      title: 'Reparte con la regla 50/30/20',
      body: '50% para necesidades (mercado, servicios, alquiler), 30% para gustos y 20% para ahorro y deudas. Ponle un presupuesto a las categorías donde más se te va el dinero.',
    },
    {
      emoji: '💱',
      title: 'Cuida la brecha',
      body: 'Si pagas en bolívares con respaldo en divisas, compara antes en Tasas si te conviene pagar en dólares o cambiar. La app te muestra cada mes cuánto te ahorró o te costó.',
      only: 'rates',
    },
    {
      emoji: '📅',
      title: 'Revisa el mes los lunes',
      body: 'Abre Análisis, mira tus tres categorías más altas y compáralas con el mes anterior. Decide un solo ajuste para la semana: es más fácil cumplir uno que diez.',
    },
  ],
  weekly: [
    'Cada día: registra al momento (voz, captura o +).',
    'Cada domingo: concilia tus cuentas y descarga tu respaldo.',
    'Cada lunes: revisa Análisis y tus presupuestos.',
    'Cada mes: abona a tu fondo de emergencia y a tus metas.',
  ],
};

// Qué cuentas te sugerimos en cada país.
export const BY_REGION = {
  VE: {
    title: 'Venezuela',
    text: 'Pago Móvil, efectivo en dólares y bolívares, Zelle, Binance (USDT) y tu banco venezolano. Además ves el dólar BCV, el Paralelo y el USDT, y la calculadora de brecha.',
  },
  US: {
    title: 'Estados Unidos',
    text: 'Zelle, Venmo, Cash App, Apple Pay, tu tarjeta de crédito y tu cuenta de cheques (checking account). Todo en dólares; si conservas una cuenta en bolívares, las tasas se activan solas.',
  },
  ES: {
    title: 'España y Europa',
    text: 'Bizum, tu cuenta con IBAN, la tarjeta de débito y el efectivo en euros. Si conservas una cuenta en bolívares, las tasas se activan solas.',
  },
  INT: {
    title: 'Otro país',
    text: 'Panamá, Colombia, Chile, México, Perú o donde vivas: tu banco local en dólares o euros, Wise, PayPal, Zelle, Binance y, si la tienes, tu cuenta venezolana en bolívares.',
  },
};

// Instalar la app en iPhone desde Safari.
export const INSTALL_IPHONE = [
  `Copia el enlace ${APP_URL} y ábrelo en Safari.`,
  'Toca el botón de Opciones o Compartir (los 3 puntos ••• o el ícono de compartir, abajo a la derecha).',
  'Selecciona "Compartir" (Share).',
  'Toca "Ver más" (View More) si no aparece a primera vista.',
  'Presiona "Agregar a la pantalla de inicio" (Add to Home Screen) y luego "Agregar".',
];

export const INSTALL_ANDROID = [
  `Abre ${APP_URL} en Chrome.`,
  'Toca "Instalar" en el aviso, o el menú ⋮ › "Instalar app" (o "Agregar a pantalla principal").',
];

// ¿Esta sección aplica a la persona? (rates = tiene tasas activas: Venezuela o cuentas en Bs.)
export const applies = (item, region) => !item.only || (item.only === 'rates' && Boolean(region?.rates));

// Versión en Markdown (docs/howToUseIt.md), para leer fuera de la app o imprimir.
export function toMarkdown() {
  const L = [`# La Fructosa · Manual de uso (${MANUAL_VERSION})`, '', `App: ${APP_URL}`, ''];
  L.push('## Las cinco funciones principales', '');
  CORE.forEach((s, i) => {
    L.push(`### ${String.fromCharCode(97 + i)}) ${s.emoji} ${s.title}`, '', s.intro, '');
    s.steps.forEach((t, k) => L.push(`${k + 1}. ${t}`));
    L.push('');
    s.tips.forEach((t) => L.push(`- ${t}`));
    L.push('');
  });
  L.push('## Otras funciones', '');
  for (const m of MORE) { L.push(`### ${m.emoji} ${m.title}`, ''); m.body.forEach((p) => L.push(p, '')); }
  L.push('## Guía de finanzas personales', '', `> **${FINANCE_GUIDE.motto}**`, '', FINANCE_GUIDE.intro, '');
  for (const t of FINANCE_GUIDE.tips) L.push(`### ${t.emoji} ${t.title}`, '', t.body, '');
  L.push('### Tu rutina', '');
  FINANCE_GUIDE.weekly.forEach((w) => L.push(`- ${w}`));
  L.push('', '## Según tu país', '');
  for (const r of Object.values(BY_REGION)) L.push(`- **${r.title}:** ${r.text}`);
  L.push('', '## Instalar en iPhone (Safari)', '');
  INSTALL_IPHONE.forEach((s, i) => L.push(`${i + 1}. ${s}`));
  L.push('', '## Instalar en Android (Chrome)', '');
  INSTALL_ANDROID.forEach((s, i) => L.push(`${i + 1}. ${s}`));
  L.push('');
  return L.join('\n');
}
