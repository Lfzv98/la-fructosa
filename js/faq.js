// La Fructosa · Preguntas frecuentes (Más › Preguntas frecuentes)
// Solo datos, sin interfaz: la pantalla js/screens/faq.js los muestra y tests/faq.test.mjs los prueba.
// Cada respuesta describe cómo funciona la app de verdad (revisado contra el código de la v36).
//
// Textos por país con V(venezuela, españa, eeuu, otro) → null = no se muestra en ese país.
// `only` limita una pregunta o un grupo: 'rates' (tasas activas: Venezuela o cuentas en Bs.),
// 'investments' (perfil con el permiso de Inversiones) o una lista de países (['ES']).
// Un párrafo también puede ser when(only, texto): solo se muestra si aplica.

const V = (VE, ES, US, INT = VE) => ({ __v: true, VE, ES, US, INT });
const when = (only, text) => ({ __when: true, only, text });

export const FAQ = [
  {
    id: 'privacidad',
    emoji: '🛡️',
    title: 'Privacidad y seguridad',
    items: [
      {
        q: '¿Mi familia puede ver mi dinero o mis movimientos?',
        a: [
          'No. Cada persona entra con su propio usuario y solo ve lo suyo. Cada registro lleva tu identificador y la base de datos (seguridad a nivel de fila) rechaza cualquier consulta de otra persona, aunque sea de la familia y aunque use el mismo teléfono con su propia sesión.',
          'Tampoco el Copiloto IA de otra persona puede ver tus datos: solo recibe los de quien está conectado.',
        ],
      },
      {
        q: '¿La app se conecta a mi banco o me pide mis claves bancarias?',
        a: ['No. La Fructosa no se conecta a ningún banco, no mueve dinero y nunca te pide claves bancarias, números de tarjeta ni documentos de identidad. Solo guarda lo que tú anotas.'],
      },
      {
        q: '¿Dónde se guardan mis datos?',
        a: [
          'En Supabase, un servicio profesional de bases de datos. Viajan cifrados (HTTPS) y tu contraseña se guarda cifrada: nadie puede leerla, ni siquiera el administrador.',
          'Las fotos de comprobantes que adjuntes se guardan en un espacio privado de tu cuenta y solo tú puedes verlas.',
        ],
      },
      {
        q: '¿Venden mis datos o hay publicidad?',
        a: [
          'No. La app es gratuita, no tiene publicidad y no vende ni comparte tus datos. Solo intervienen los servicios que la hacen funcionar: Supabase, el servicio donde está alojada la app y, si usas el Copiloto, Google Gemini.',
          when('rates', 'Las tasas se consultan en fuentes públicas sin enviar ningún dato tuyo.'),
        ],
      },
      {
        q: '¿Y si alguien agarra mi teléfono?',
        a: [
          'Activa el bloqueo en Ajustes › Privacidad y seguridad: Face ID, huella o un PIN. Se pide al abrir la app y al volver si estuvo más de un minuto en segundo plano. Después de 5 intentos fallidos hay que esperar 30 segundos.',
          'El PIN no se guarda tal cual, solo una versión cifrada en ese teléfono. Y si estás en un lugar público, toca el ojo del Inicio para ocultar los montos.',
        ],
      },
      {
        q: 'Olvidé mi PIN, ¿qué hago?',
        a: ['En la pantalla de bloqueo toca "Olvidé mi PIN". Se cierra la sesión, entras de nuevo con tu usuario y contraseña y el bloqueo queda desactivado en ese teléfono. Lo vuelves a crear en Ajustes cuando quieras. Tus datos no se tocan.'],
      },
    ],
  },
  {
    id: 'cuenta',
    emoji: '👤',
    title: 'Tu cuenta y contraseña',
    items: [
      {
        q: '¿Puedo entrar con mi correo en vez del usuario?',
        a: ['Sí. En "Usuario o correo" sirve cualquiera de los dos, junto con tu contraseña.'],
      },
      {
        q: 'Olvidé mi contraseña',
        a: ['En la pantalla de entrada toca "¿La olvidaste?", escribe el correo con el que te registraste y toca "Enviar enlace". Abre el enlace que te llega y la app te pide la contraseña nueva. Si no ves el correo, revisa la carpeta de spam.'],
      },
      {
        q: '¿Cómo cambio mi contraseña?',
        a: ['En Ajustes › Privacidad y seguridad › Cambiar contraseña. Debe tener al menos 8 caracteres.'],
      },
      {
        q: '¿Puedo cambiar mi nombre o mi usuario?',
        a: ['Tu nombre sí: en Ajustes toca tu nombre arriba y escríbelo de nuevo. El usuario (@) es fijo, porque es con lo que entras.'],
      },
      {
        q: '¿Puedo usarla en varios teléfonos, en el iPad o en la computadora?',
        a: [
          'Sí. Tus datos viven en tu cuenta, no en el teléfono: entra con tu usuario desde cualquier dispositivo y verás lo mismo. En iPad y en computadora la app muestra un menú lateral a la izquierda.',
          'Lo único que es de cada dispositivo es el bloqueo con PIN o huella y, si la pusiste, tu propia clave de IA.',
        ],
      },
      {
        q: '¿Cuánto cuesta?',
        a: ['Nada. La Fructosa es gratuita, sin suscripciones ni compras dentro de la app.'],
      },
      {
        q: '¿Cómo borro mi cuenta?',
        a: ['En Ajustes › Borrar mi cuenta. Antes te ofrece descargar tu respaldo y te pide escribir tu usuario para confirmar. Se borran tu cuenta y todos tus datos, incluida la conversación con Fructosa. Es inmediato y no se puede deshacer.'],
      },
    ],
  },
  {
    id: 'monedas',
    emoji: '💵',
    title: 'Cuentas y monedas',
    items: [
      {
        q: '¿Qué monedas puedo usar?',
        a: [V(
          'Dólares (USD), bolívares (Bs.), USDT y euros (EUR).',
          'Euros (EUR), dólares (USD) y USDT.',
          'Dólares (USD) y USDT.',
          'Dólares (USD), euros (EUR), USDT y, si conservas una cuenta en Venezuela, bolívares (Bs.).',
        )],
      },
      {
        q: '¿Una cuenta puede tener dos monedas?',
        a: [V(
          'No: cada cuenta tiene una sola moneda. Si tu banco te da una cuenta en bolívares y otra en dólares, crea dos cuentas (por ejemplo, "Banesco Bs." y "Banesco USD").',
          'No: cada cuenta tiene una sola moneda. Si tienes euros y dólares en el mismo banco, crea dos cuentas (por ejemplo, "BBVA EUR" y "BBVA USD").',
          'No: cada cuenta tiene una sola moneda. Si tienes dólares en el banco y USDT en un exchange, son dos cuentas (por ejemplo, "Chase" y "Coinbase USDT").',
          'No: cada cuenta tiene una sola moneda. Si tienes dos monedas en el mismo banco, crea dos cuentas (por ejemplo, "Mi banco USD" y "Mi banco EUR").',
        )],
      },
      {
        q: '¿Cómo se calcula mi patrimonio total?',
        a: [
          V('La app convierte el saldo de cada cuenta a tu moneda principal con las tasas del día y los suma. La moneda principal la cambias con los botones del Inicio o en Ajustes › Región y moneda.',
            'La app convierte el saldo de cada cuenta a tu moneda principal (euros o dólares) y los suma. La cambias con los botones del Inicio o en Ajustes › Región y moneda.',
            'La app suma el saldo de todas tus cuentas en dólares.',
            'La app convierte el saldo de cada cuenta a tu moneda principal y los suma. La cambias con los botones del Inicio o en Ajustes › Región y moneda.'),
          when('rates', 'En Ajustes también eliges si los dólares se valoran a tasa BCV o Paralelo. Paralelo refleja mejor cuántos dólares reales tendrías si cambiaras todo hoy.'),
          when('investments', 'El valor actual de tus inversiones también suma: debajo del total ves "Cuentas" e "Inversiones" por separado.'),
        ],
      },
      {
        q: '¿Cuál es la diferencia entre una transferencia y un gasto?',
        a: [V(
          'Una transferencia es mover dinero entre TUS cuentas (por ejemplo, de Zelle a Binance o vender USDT y recibir bolívares). No es gasto ni ingreso, así que tu patrimonio no cambia. Si las monedas son distintas, escribes cuánto llegó y la app calcula la tasa a la que cambiaste.',
          'Una transferencia es mover dinero entre TUS cuentas (por ejemplo, de tu banco a Revolut). No es gasto ni ingreso, así que tu patrimonio no cambia. Si las monedas son distintas, escribes cuánto llegó y la app calcula el cambio.',
          'Una transferencia es mover dinero entre TUS cuentas (por ejemplo, de tu checking a tu savings). No es gasto ni ingreso, así que tu patrimonio no cambia.',
          'Una transferencia es mover dinero entre TUS cuentas (por ejemplo, de tu banco a Wise). No es gasto ni ingreso, así que tu patrimonio no cambia. Si las monedas son distintas, escribes cuánto llegó y la app calcula el cambio.',
        )],
      },
      {
        q: 'El saldo de la app no coincide con el de mi banco',
        a: ['Entra a la cuenta y revisa si falta algo por anotar (una comisión, un pago pequeño). Si aún hay diferencia, toca "Ajustar" y escribe el saldo real: la app registra la diferencia como "Ajuste de saldo". Hacerlo una vez por semana mantiene todo exacto.'],
      },
      {
        q: '¿Puedo borrar una cuenta que ya no uso?',
        a: ['Mejor archívala: entra a la cuenta, toca editar y "Archivar". Desaparece de la lista y del total, pero su historial se conserva. Si te arrepientes, la restauras desde el mismo lugar.'],
      },
      {
        q: 'Me mudé de país, ¿qué hago?',
        a: [V(
          'Cambia tu país en Ajustes › Región y moneda. La app se adapta a las monedas, bancos y categorías del nuevo país, y tu moneda principal pasa a la de allá. Tus cuentas y movimientos no cambian.',
          'Cambia tu país en Ajustes › Región y moneda. La app se adapta a las monedas, bancos y categorías del nuevo país. Tus cuentas y movimientos no cambian.',
          'Cambia tu país en Ajustes › Región y moneda. La app se adapta a las monedas, bancos y categorías del nuevo país. Tus cuentas y movimientos no cambian.',
          'Cambia tu país en Ajustes › Región y moneda. La app se adapta a las monedas, bancos y categorías del nuevo país, y tu moneda principal pasa a la de allá. Tus cuentas y movimientos no cambian.',
        )],
      },
    ],
  },
  {
    id: 'tasas',
    emoji: '💱',
    title: 'Tasas y brecha cambiaria',
    only: 'rates',
    items: [
      {
        q: '¿De dónde salen las tasas?',
        a: [
          'El dólar BCV, el euro BCV y el dólar Paralelo (promedio Monitor) vienen de DolarApi. El USDT es la mediana de los 10 primeros anuncios de venta en Binance P2P.',
          'Son de referencia: la tasa que te dé un comercio, tu banco o un cambista puede variar un poco.',
        ],
      },
      {
        q: '¿Cada cuánto se actualizan?',
        a: ['Solas, cuatro veces al día: 8:00 a. m., 11:00 a. m., 2:00 p. m. y 6:00 p. m., hora de Venezuela. Si abres la app y todavía no hay tasas de hoy, las pide en ese momento. En Tasas también puedes tocar el botón de actualizar.'],
      },
      {
        q: '¿Qué es la brecha?',
        a: ['Es cuánto más caro está el dólar del mercado (Paralelo) que el oficial (BCV), en porcentaje. Importa cuando pagas en bolívares teniendo tu dinero en dólares o USDT: según la tasa a la que cambies, ese pago te sale más barato o más caro en dólares reales.'],
      },
      {
        q: 'Pagué en bolívares desde mi cuenta en dólares, ¿cómo lo anoto?',
        a: ['Al registrar el gasto, elige la cuenta en dólares o USDT y activa "Pagué en bolívares". Escribe los Bs. que pagaste y la tasa que usaste: la app calcula el costo real en tu moneda y te dice cuánto ahorraste o perdiste frente a la tasa BCV. En Análisis ves el total del mes.'],
      },
      {
        q: '¿Puedo ver cómo se ha movido el dólar?',
        a: ['Sí. En Tasas › Historial eliges una tasa y ves su evolución en el último mes, 3 meses, 6 meses o el año, con su mínimo, su máximo y cuánto subió. Toca la línea para leer el valor de cada día.'],
      },
      {
        q: 'Vivo fuera de Venezuela, ¿por qué veo tasas?',
        only: ['INT'],
        a: ['Porque tienes al menos una cuenta activa en bolívares. Si la archivas, las tasas y la calculadora de brecha dejan de aparecer.'],
      },
    ],
  },
  {
    id: 'respaldo',
    emoji: '💾',
    title: 'Respaldo y tus datos',
    items: [
      {
        q: 'Si pierdo o cambio de teléfono, ¿pierdo mis datos?',
        a: ['No. Todo está guardado en tu cuenta. Instala la app en el teléfono nuevo, entra con tu usuario y contraseña y aparece todo como lo dejaste.'],
      },
      {
        q: '¿Cómo descargo una copia de todo?',
        a: [
          'En Ajustes › Respaldo › "Descargar todos mis datos (Excel)". Trae resumen, cuentas, movimientos, presupuestos, pagos fijos, metas, préstamos y tasas, con colores y filtros listos para Excel, Numbers o Google Sheets.',
          when('investments', 'También trae una hoja con tus inversiones.'),
          'En iPhone, cuando aparezca el menú de compartir, toca "Guardar en Archivos". Si pasan 7 días sin respaldo, la app te lo recuerda.',
        ],
      },
      {
        q: '¿Puedo volver a cargar ese Excel en la app?',
        a: ['No, la app no importa archivos. El Excel es tu copia para consultar, imprimir o guardar en un lugar seguro. Tus datos no dependen de él: ya están guardados en tu cuenta.'],
      },
      {
        q: '¿Puedo exportar solo algunos movimientos?',
        a: ['Sí. En Movimientos filtra por mes, cuenta o categoría y toca el ícono de descarga. En Análisis, el mismo ícono exporta el mes que estás viendo. En Más también puedes exportarlo todo en Excel o en CSV (texto simple).'],
      },
    ],
  },
  {
    id: 'ia',
    emoji: '✨',
    title: 'Copiloto IA (Fructosa)',
    items: [
      {
        q: '¿Qué hace Fructosa?',
        a: ['Es tu asistente con inteligencia artificial. Registra movimientos a partir de lo que escribes, de una nota de voz o de la captura de un comprobante, y responde preguntas sobre tus finanzas, como "¿en qué gasté más este mes?".'],
      },
      {
        q: '¿Tengo que pagar o poner alguna clave?',
        a: ['No. El Copiloto ya viene incluido y funciona sin configurar nada. Si prefieres usar tu propia clave de Google Gemini, la pegas en Ajustes › Copiloto IA; se guarda solo en ese dispositivo.'],
      },
      {
        q: '¿Qué datos ve la IA?',
        a: [
          V('Para responderte, se envía a Google Gemini tu pregunta, las capturas que adjuntes y un resumen de tus cuentas, tasas y últimos movimientos. La primera vez te pide permiso.',
            'Para responderte, se envía a Google Gemini tu pregunta, las capturas que adjuntes y un resumen de tus cuentas y últimos movimientos. La primera vez te pide permiso.',
            'Para responderte, se envía a Google Gemini tu pregunta, las capturas que adjuntes y un resumen de tus cuentas y últimos movimientos. La primera vez te pide permiso.',
            'Para responderte, se envía a Google Gemini tu pregunta, las capturas que adjuntes y un resumen de tus cuentas y últimos movimientos. La primera vez te pide permiso.'),
          V('En la versión gratuita de Gemini, Google puede conservar esas conversaciones para mejorar sus servicios, así que nunca le escribas contraseñas ni claves. Fructosa tampoco repite números de cuenta, cédulas ni teléfonos que aparezcan en una imagen.',
            'En la versión gratuita de Gemini, Google puede conservar esas conversaciones para mejorar sus servicios, así que nunca le escribas contraseñas ni claves. Fructosa tampoco repite números de cuenta, teléfonos ni números de referencia completos que aparezcan en una imagen.',
            'En la versión gratuita de Gemini, Google puede conservar esas conversaciones para mejorar sus servicios, así que nunca le escribas contraseñas ni claves. Fructosa tampoco repite números de cuenta, teléfonos ni números de referencia completos que aparezcan en una imagen.',
            'En la versión gratuita de Gemini, Google puede conservar esas conversaciones para mejorar sus servicios, así que nunca le escribas contraseñas ni claves. Fructosa tampoco repite números de cuenta, teléfonos ni números de referencia completos que aparezcan en una imagen.'),
        ],
      },
      {
        q: '¿Puede guardar un movimiento sin que yo lo apruebe?',
        a: ['No. Fructosa te muestra el movimiento listo y nada se guarda hasta que tocas "Registrar". Revisa siempre el monto y la cuenta: la IA se puede equivocar.'],
      },
      {
        q: 'Me dice "Has hecho demasiadas preguntas seguidas"',
        a: ['Para que la IA incluida alcance para toda la familia, cada persona tiene hasta 50 preguntas cada 10 minutos. Espera unos minutos y vuelve a intentarlo.'],
      },
      {
        q: '¿Se guarda mi conversación?',
        a: ['Sí, en tu cuenta, para que la retomes desde cualquier dispositivo. Solo tú la ves. La borras con "Nueva conversación".'],
      },
      {
        q: 'La nota de voz no funciona',
        a: ['El navegador tiene que tener permiso para usar el micrófono. Cuando lo pida, toca "Permitir". Si lo negaste antes, actívalo en los ajustes del navegador o del teléfono para este sitio.'],
      },
    ],
  },
  {
    id: 'app',
    emoji: '📱',
    title: 'Instalar, actualizar y usar sin internet',
    items: [
      {
        q: '¿La descargo de la App Store o de Google Play?',
        a: ['No hace falta. La Fructosa se instala desde el navegador y queda en tu pantalla de inicio como cualquier app, a pantalla completa. En iPhone: ábrela en Safari, toca Compartir y "Agregar a la pantalla de inicio". En Android: ábrela en Chrome y toca "Instalar". Los pasos completos están en el Manual de uso.'],
      },
      {
        q: '¿Cómo se actualiza?',
        a: ['Sola. Cuando hay una versión nueva, arriba aparece "Hay una versión nueva de La Fructosa": toca "Actualizar" y listo. No pierdes nada.'],
      },
      {
        q: '¿Funciona sin internet?',
        a: ['Sí. Sin señal, la app abre con lo último que cargó y puedes seguir anotando. Verás "⏳ movimientos por subir" y se suben solos cuando vuelve la conexión, sin duplicarse. Lo que sí necesita internet: el Copiloto IA, subir fotos de comprobantes y traer datos nuevos.'],
      },
      {
        q: '¿Me puede avisar cuando vence un pago?',
        a: ['Sí. En Ajustes › Avisos activas recordatorios de pagos fijos, préstamos y respaldo. Llegan a las 8:30 a. m. En iPhone, primero instala la app en la pantalla de inicio y ábrela desde ahí.'],
      },
      {
        q: '¿Puedo ponerla en modo claro?',
        a: ['Sí. En Ajustes › Apariencia eliges Oscuro, Claro o Automático (sigue el modo de tu teléfono).'],
      },
      {
        q: 'Quiero ver el tour otra vez',
        a: ['En Más › Manual de uso toca "Ver el tour otra vez".'],
      },
    ],
  },
  {
    id: 'inversiones',
    emoji: '📈',
    title: 'Inversiones',
    only: 'investments',
    items: [
      {
        q: '¿Qué puedo registrar en Inversiones?',
        a: ['Acciones, fondos, cripto, plazos fijos u otras. De cada una guardas el tipo, el monto invertido, la moneda, el valor actual, la fecha y una nota opcional.'],
      },
      {
        q: '¿El valor actual se actualiza solo?',
        a: ['No. Tú lo escribes: abre la inversión y cambia el valor actual cuando revises tu broker o tu exchange. La app recalcula la ganancia al momento.'],
      },
      {
        q: '¿Cómo se calcula la ganancia o pérdida?',
        a: ['Valor actual menos monto invertido, en dinero y en porcentaje. La ves por inversión, por tipo y en total, convertida a tu moneda principal.'],
      },
      {
        q: '¿Las inversiones mueven dinero de mis cuentas?',
        a: ['No. Son un registro aparte: no restan de ninguna cuenta. Su valor actual sí suma a tu patrimonio total del Inicio.'],
      },
      {
        q: '¿Quién más ve esta sección?',
        a: ['Nadie. Inversiones solo aparece en las cuentas que tienen el permiso activado en el servidor, y la app no puede encenderlo ni apagarlo. Además, cada quien ve solo sus propias inversiones. El Copiloto y el respaldo en Excel las incluyen solo para ti.'],
      },
    ],
  },
];

// ¿Aplica a la persona? ctx = { region, investmentsOn }.
export function faqApplies(only, ctx = {}) {
  if (!only) return true;
  if (only === 'rates') return Boolean(ctx.region?.rates);
  if (only === 'investments') return ctx.investmentsOn === true;
  return Array.isArray(only) && only.includes(ctx.region?.code);
}

function pick(v, ctx) {
  if (v && v.__when) return faqApplies(v.only, ctx) ? pick(v.text, ctx) : null;
  if (v && v.__v) { const code = ctx.region?.code || 'VE'; return code in v ? v[code] : v.VE; }
  return v;
}

// Preguntas frecuentes del país y los permisos de la persona, con los textos ya elegidos.
export function faqFor(ctx = {}) {
  return FAQ.filter((g) => faqApplies(g.only, ctx))
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => faqApplies(it.only, ctx))
        .map((it) => ({ q: pick(it.q, ctx), a: it.a.map((p) => pick(p, ctx)).filter((p) => p != null) }))
        .filter((it) => it.q && it.a.length),
    }))
    .filter((g) => g.items.length);
}

// Búsqueda sin tildes ni mayúsculas: "contrasena" encuentra "contraseña".
export const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function searchFaq(groups, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups.map((g) => ({
    ...g,
    items: g.items.filter((it) => { const hay = fold([it.q, ...it.a, g.title].join(' ')); return words.every((w) => hay.includes(w)); }),
  })).filter((g) => g.items.length);
}
