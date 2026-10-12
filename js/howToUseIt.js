// La Fructosa · Manual de uso (howToUseIt)
// Fuente única del manual: la pantalla Más › Manual de uso lo muestra y docs/howToUseIt.md
// se genera a partir de este archivo (node tests/howToUseIt.test.mjs --write).
// Solo datos, sin interfaz: así también se puede leer y probar fuera del navegador.

export const MANUAL_VERSION = 'v29';
// Enlace que se muestra en el manual: el de donde está abierta la app (Vercel, GitHub Pages
// o el dominio que sea). Fuera del navegador (pruebas, docs/howToUseIt.md) se usa el oficial.
const HERE = typeof location !== 'undefined' && /^https?:$/.test(location.protocol)
  ? location.origin + location.pathname.replace(/[^/]*$/, '') : '';
export const APP_URL = HERE || 'https://lfzv98.github.io/la-fructosa/';

// Textos por país: V(venezuela, españa, eeuu, otro) → se elige según el país de la persona
// (null = no se muestra). Así España y Estados Unidos no ven nada de bolívares ni de Venezuela.
const V = (VE, ES, US, INT = VE) => ({ __v: true, VE, ES, US, INT });

// Las cinco funciones principales, paso a paso. `only` limita una sección a ciertos países.
export const CORE = [
  {
    id: 'cuentas',
    emoji: '🏦',
    title: 'Tus cuentas: crea, elige moneda y banco',
    intro: V(
      'Una cuenta es cualquier lugar donde guardas dinero: la cartera, un banco, una app de pagos o tu billetera de cripto. Cada cuenta tiene una sola moneda: USD, Bs. (VES), USDT o EUR.',
      'Una cuenta es cualquier lugar donde guardas dinero: la cartera, un banco, una app de pagos o tu billetera de cripto. Cada cuenta tiene una sola moneda: EUR, USD o USDT.',
      'Una cuenta es cualquier lugar donde guardas dinero: la cartera, un banco, una app de pagos o tu billetera de cripto. Cada cuenta tiene una sola moneda: USD o USDT.',
    ),
    steps: [
      'Entra a Más › Cuentas y toca "+ Nueva" (la primera vez, la bienvenida te ofrece crearlas de una vez).',
      V('Usa una plantilla rápida (Pago Móvil, Zelle, Efectivo USD, Binance…) o arma la tuya.',
        'Usa una plantilla rápida (Bizum, Cuenta IBAN, Tarjeta, Efectivo EUR, Revolut…) o arma la tuya.',
        'Usa una plantilla rápida (Checking, Savings, Zelle, Venmo, Apple Pay, Cash…) o arma la tuya.',
        'Usa una plantilla rápida (Efectivo, PayPal, Wise, Binance…) o arma la tuya.'),
      V('Elige la moneda (USD, VES, USDT o EUR) y el tipo (Efectivo, Banco, Digital o Cripto).',
        'Elige la moneda (EUR, USD o USDT) y el tipo (Efectivo, Banco, Digital o Cripto).',
        'Elige la moneda (USD o USDT) y el tipo (Efectivo, Banco, Digital o Cripto).'),
      V('Escribe el nombre. Según la moneda, la app te sugiere: en bolívares, la lista completa de bancos venezolanos (BDV, Banesco, Mercantil, Provincial, BNC, Bancamiga, Tesoro, Bancaribe, Exterior, Banplus, BFC, Activo, Plaza, Sofitasa, 100% Banco, DelSur, Bancrecer, R4, Banfanb y los demás); en dólares, euros o USDT, bancos internacionales, apps de pago (Zelle, PayPal, Wise, Zinli, Wally, Airtm…) y cripto (Binance, Bybit, OKX…). Si el tuyo no aparece, escríbelo.',
        'Escribe el nombre. La app te sugiere bancos españoles (BBVA, Santander, CaixaBank, Sabadell, ING, Openbank…), apps de pago (Bizum, Revolut, N26, PayPal, Apple Pay…) y cripto (Binance, Coinbase…). Si el tuyo no aparece, escríbelo.',
        'Escribe el nombre. La app te sugiere bancos de Estados Unidos (Chase, Bank of America, Wells Fargo, Citi, Capital One…), apps de pago (Zelle, Venmo, Cash App, Apple Pay, PayPal…) y cripto (Coinbase, Binance…). Si el tuyo no aparece, escríbelo.',
        'Escribe el nombre. La app te sugiere bancos internacionales, apps de pago (PayPal, Wise, Zelle…) y cripto (Binance, Bybit…). Si el tuyo no aparece, escríbelo.'),
      'Escribe el saldo que tienes hoy (puede ser 0) y toca "Crear cuenta". Desde ahí la app suma y resta sola con cada movimiento.',
    ],
    tips: [
      'Archiva las cuentas que ya no uses: desaparecen de la lista pero su historial se conserva.',
      V('¿Vives fuera de Venezuela? Elige tu país (o "Otro país") en Ajustes y la app se adapta.',
        '¿Te mudaste? Cambia tu país en Ajustes y la app se adapta a sus bancos, monedas y categorías.',
        '¿Te mudaste? Cambia tu país en Ajustes y la app se adapta a sus bancos, monedas y categorías.',
        'Si conservas una cuenta en bolívares, créala igual: las tasas BCV, Paralelo y USDT se activan solas.'),
      V('En el inicio ves el patrimonio total de todas tus cuentas convertido a la moneda que prefieras (USD, Bs. o EUR).',
        'En el inicio ves el patrimonio total de todas tus cuentas convertido a euros o dólares.',
        'En el inicio ves el patrimonio total de todas tus cuentas en dólares.',
        'En el inicio ves el patrimonio total de todas tus cuentas convertido a la moneda que prefieras.'),
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
      V('Transferencia es mover dinero entre TUS cuentas (por ejemplo, de Zelle a Binance). No es gasto ni ingreso: tu patrimonio no cambia. Elige "Desde" y "Hacia"; si las monedas son distintas, escribe cuánto llegó y la app calcula la tasa a la que cambiaste.',
        'Transferencia es mover dinero entre TUS cuentas (por ejemplo, de tu banco a Revolut). No es gasto ni ingreso: tu patrimonio no cambia. Elige "Desde" y "Hacia"; si las monedas son distintas, escribe cuánto llegó y la app calcula la tasa a la que cambiaste.',
        'Transferencia es mover dinero entre TUS cuentas (por ejemplo, de tu checking a tu savings). No es gasto ni ingreso: tu patrimonio no cambia. Elige "Desde" y "Hacia".'),
      V('Si pagas en bolívares desde una cuenta en dólares o USDT, activa "Pagué en bolívares": escribe los Bs. y la tasa que usaste, y la app te dice el costo real en dólares y cuánto te ahorró o te costó la brecha frente al BCV.', null, null),
      '¿Te equivocaste? Toca el movimiento en Movimientos para corregirlo o borrarlo.',
    ],
  },
  {
    id: 'copiloto',
    emoji: '✨',
    title: 'Copiloto IA (Fructosa): voz, texto y capturas',
    intro: 'Fructosa es tu asistente con inteligencia artificial. Conoce tus cuentas y te ayuda a registrar sin escribir formularios. Ábrela con el botón "Copiloto IA" del inicio.',
    steps: [
      V('Texto libre: escribe como hablas, por ejemplo "gasté 12 dólares en el mercado con Zelle" o "me pagaron 300 de sueldo en Banesco".',
        'Texto libre: escribe como hablas, por ejemplo "gasté 12 euros en el súper con Bizum" o "me pagaron 1.500 de nómina en BBVA".',
        'Texto libre: escribe como hablas, por ejemplo "gasté 12 dólares en el súper con Apple Pay" o "me pagaron 2.000 de sueldo en Chase".',
        'Texto libre: escribe como hablas, por ejemplo "gasté 12 dólares en el mercado" o "me pagaron 300 de sueldo en mi banco".'),
      'Nota de voz: toca el micrófono 🎙️ y dilo en voz alta. Lo que dices se escribe en tiempo real; cuando termines, toca enviar.',
      V('Captura o foto: toca la cámara 📷 y elige la captura del comprobante (Pago Móvil, transferencia, Zelle, Binance, PayPal, Zinli, una factura o un ticket).',
        'Captura o foto: toca la cámara 📷 y elige la captura del comprobante (Bizum, transferencia de tu banco, Revolut, PayPal, una factura o un ticket).',
        'Captura o foto: toca la cámara 📷 y elige la captura del comprobante (Zelle, Venmo, Cash App, tu banco, una factura o un recibo).',
        'Captura o foto: toca la cámara 📷 y elige la captura del comprobante (transferencia, PayPal, Wise, Binance, una factura o un ticket).'),
      'Fructosa te muestra el movimiento listo: monto, moneda, fecha, cuenta y categoría. Revísalo y toca "Registrar", o "Descartar" si algo no cuadra.',
    ],
    tips: [
      'Nada se guarda sin que toques "Registrar".',
      V('También responde preguntas: "¿cuánto tengo en total?", "¿en qué gasté más este mes?", "calcúlame 400 euros a tasa BCV".',
        'También responde preguntas: "¿cuánto tengo en total?", "¿en qué gasté más este mes?", "¿qué debo saber de la declaración de la renta?".',
        'También responde preguntas: "¿cuánto tengo en total?", "¿en qué gasté más este mes?", "¿qué debo saber de mis taxes?".',
        'También responde preguntas: "¿cuánto tengo en total?", "¿en qué gasté más este mes?".'),
      V('Si una captura es un cambio de divisa entre tus propias cuentas (vender USDT y recibir bolívares), te pedirá anotarlo como Transferencia con el botón +.',
        'Si una captura es un movimiento entre tus propias cuentas (por ejemplo, comprar USDT desde tu banco), te pedirá anotarlo como Transferencia con el botón +.',
        'Si una captura es un movimiento entre tus propias cuentas (por ejemplo, de checking a savings), te pedirá anotarlo como Transferencia con el botón +.'),
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
      V('Si el saldo coincide, listo. Si no, revisa en su lista de movimientos si te faltó anotar algo (una comisión, un Pago Móvil, una compra pequeña) y regístralo.',
        'Si el saldo coincide, listo. Si no, revisa en su lista de movimientos si te faltó anotar algo (una comisión, un Bizum, una compra pequeña) y regístralo.',
        'Si el saldo coincide, listo. Si no, revisa en su lista de movimientos si te faltó anotar algo (un fee, un pago con Zelle o Venmo, una compra pequeña) y regístralo.',
        'Si el saldo coincide, listo. Si no, revisa en su lista de movimientos si te faltó anotar algo (una comisión, una transferencia, una compra pequeña) y regístralo.'),
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
      'Movimientos en Excel: en Movimientos filtra lo que quieras (mes, cuenta, categoría) y toca el ícono de descarga ⬇️. En Análisis, el mismo ícono exporta el mes que estás viendo. En Más también puedes exportarlo todo en Excel o en CSV (texto simple).',
      'En iPhone, cuando aparezca el menú de compartir, toca "Guardar en Archivos" y elige una carpeta (iCloud Drive o En mi iPhone). En computadora se descarga directo.',
      'Abre el archivo en Excel, Numbers o Google Sheets. Viene listo para leer: encabezados en azul oscuro, ingresos en verde (+), gastos en rojo (−), transferencias en azul, ajustes e inactivos en gris y totales en amarillo. La hoja Resumen trae la guía de colores, y cada tabla tiene filtros.',
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
      'La brecha es cuánto más cuesta el dólar del mercado que el oficial. En Tasas tienes una calculadora para convertir entre dólares, euros y bolívares.',
      'En Tasas › Historial eliges una tasa y ves cómo se movió en el último mes, 3 meses, 6 meses o el año, con su mínimo, su máximo y cuánto subió. Toca la línea para leer el valor de cada día.',
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
      'En Más › Por cobrar y pagar anotas quién te debe y a quién le debes. Con "Me pagó" o "Pagué" registras abonos.',
    ],
  },
  {
    emoji: '📎',
    title: 'Comprobantes',
    body: [
      'Al registrar o editar un movimiento, toca "Adjuntar foto del recibo o captura" y elige una foto o tómala en el momento. Queda guardada con ese movimiento y solo tú puedes verla.',
      'Los movimientos con comprobante muestran un 📎. Abre el movimiento y toca la foto para verla en grande. Necesitas conexión para subirla.',
    ],
  },
  {
    emoji: '📅',
    title: 'Calendario de gastos',
    body: [
      'En Movimientos, el botón del calendario muestra el mes por días. Cada día dice cuánto gastaste y se pinta más fuerte cuanto más gastaste; el punto verde indica que ese día entró dinero.',
      'Toca un día para ver solo sus movimientos y sus totales. Tócalo otra vez para volver a todo el mes.',
    ],
  },
  {
    emoji: '🛒',
    title: 'Lista de compras',
    body: [
      'En Más › Lista de compras anotas lo que necesitas, con cantidad y precio si lo sabes. La app te dice el total estimado antes de llegar a la caja.',
      'Marca cada producto al meterlo en el carrito. Al pagar, "Registrar gasto" abre el formulario con el total de lo marcado. Puedes tener varias listas (mercado, farmacia…).',
    ],
  },
  {
    emoji: '🎙️',
    title: 'Dictar un gasto',
    body: [
      'Toca el micrófono de arriba en Inicio y di el gasto, por ejemplo "gasté 10 en el almuerzo". Fructosa lo prepara y tú solo confirmas.',
      'En Android, mantén presionado el ícono de La Fructosa y elige "Dictar un gasto" para ir directo.',
    ],
  },
  {
    emoji: '📊',
    title: 'Análisis del mes',
    body: [V('En qué se va tu dinero, la comparación con el mes anterior, tu tasa de ahorro y, si usas bolívares, cuánto te ahorró o costó la brecha.',
      'En qué se va tu dinero, la comparación con el mes anterior y tu tasa de ahorro.', 'En qué se va tu dinero, la comparación con el mes anterior y tu tasa de ahorro.')],
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
      body: V('Antes de invertir o hacer compras grandes, junta entre 3 y 6 meses de tus gastos básicos en una cuenta aparte y en una moneda estable (USD o USDT). Créalo como Meta de ahorro y abónale cada mes.',
        'Antes de invertir o hacer compras grandes, junta entre 3 y 6 meses de tus gastos básicos en una cuenta de ahorro aparte, en euros. Créalo como Meta de ahorro y abónale cada mes.',
        'Antes de invertir o hacer compras grandes, junta entre 3 y 6 meses de tus gastos básicos en una cuenta de ahorro (savings) aparte. Créalo como Meta de ahorro y abónale cada mes.',
        'Antes de invertir o hacer compras grandes, junta entre 3 y 6 meses de tus gastos básicos en una cuenta aparte y en una moneda estable. Créalo como Meta de ahorro y abónale cada mes.'),
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
      body: 'Si pagas en bolívares con respaldo en divisas, registra la tasa que usaste. La app te muestra cada mes cuánto te ahorró o te costó.',
      only: 'rates',
    },
    {
      emoji: '🇪🇸',
      title: 'España: impuestos sin complicarte',
      body: 'El IVA ya va incluido en lo que pagas. La declaración de la renta (IRPF) se presenta en primavera, normalmente de abril a finales de junio, desde la web o la app de la Agencia Tributaria: guarda tus nóminas y facturas importantes. Si tienes piso, el IBI llega una vez al año: crea un pago fijo o una meta y aparta un poco cada mes. Anota lo que pagues en la categoría Impuestos. Para tu caso concreto, consulta con un gestor.',
      only: ['ES'],
    },
    {
      emoji: '🇺🇸',
      title: 'Estados Unidos: impuestos y crédito, lo básico',
      body: 'El sales tax se suma en la caja: el precio de la etiqueta no es el final. La declaración anual (IRS) se presenta normalmente hasta el 15 de abril: guarda tus W-2 o 1099. Si trabajas por tu cuenta, aparta una parte de cada pago para impuestos. Paga el total de la tarjeta de crédito cada mes: evitas intereses y cuidas tu credit score. Para tu caso concreto, consulta con un contador (CPA).',
      only: ['US'],
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
    text: 'Pago Móvil, efectivo en dólares y bolívares, Zelle, Binance (USDT) y tu banco venezolano. Además ves el dólar BCV, el Paralelo y el USDT, y la calculadora de brecha. Categoría extra: Condominio.',
  },
  US: {
    title: 'Estados Unidos',
    text: 'Todo en dólares: tu banco (Chase, Bank of America, Wells Fargo, Citi, Capital One…), checking y savings, tarjetas de crédito, Zelle, Venmo, Cash App, Apple Pay y PayPal. Categorías extra: Alquiler (renta), Seguros, Impuestos, Propinas y Reembolso de impuestos.',
  },
  ES: {
    title: 'España',
    text: 'Todo en euros: tu banco (BBVA, Santander, CaixaBank, Sabadell, ING…), la cuenta con IBAN, la tarjeta, el efectivo en euros, Bizum, Revolut y PayPal. Categorías extra: Alquiler, Comunidad, Seguros, Impuestos, Devolución de Hacienda y Ayudas.',
  },
  INT: {
    title: 'Otro país',
    text: 'Panamá, Colombia, Chile, México, Perú o donde vivas: tu banco local en dólares o euros, Wise, PayPal, Zelle, Binance y, si la tienes, tu cuenta venezolana en bolívares. Categorías extra: Alquiler, Seguros e Impuestos.',
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
// `only` también puede ser una lista de países (['ES'], ['US']…).
export const applies = (item, region) => !item.only
  || (item.only === 'rates' ? Boolean(region?.rates) : Array.isArray(item.only) && item.only.includes(region?.code));

// Elige el texto del país (y quita los que no aplican). Funciona con textos sueltos y con listas.
export function localize(v, region) {
  if (Array.isArray(v)) return v.map((x) => localize(x, region)).filter((x) => x != null);
  if (v && v.__v) { const code = region?.code || 'VE'; return code in v ? v[code] : v.VE; }
  return v;
}
// Manual completo para un país: { CORE, MORE, FINANCE_GUIDE } con los textos ya elegidos.
export function manualFor(region) {
  const L = (o, keys) => ({ ...o, ...Object.fromEntries(keys.map((k) => [k, localize(o[k], region)])) });
  return {
    CORE: CORE.map((s) => L(s, ['intro', 'steps', 'tips'])),
    MORE: MORE.filter((m) => applies(m, region)).map((m) => L(m, ['body'])),
    FINANCE_GUIDE: { ...FINANCE_GUIDE, tips: FINANCE_GUIDE.tips.filter((t) => applies(t, region)).map((t) => L(t, ['body'])) },
  };
}

// Versión en Markdown (docs/howToUseIt.md), para leer fuera de la app o imprimir (versión de Venezuela,
// con todas las funciones).
export function toMarkdown() {
  const { CORE, MORE, FINANCE_GUIDE } = manualFor({ code: 'VE', rates: true });
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
