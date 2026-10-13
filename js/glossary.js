// Glosario corto ("Palabras que te pueden sonar raras"). Solo datos, sin interfaz:
// lo usan la app (js/learn.js) y el libro digital (manual.html).

export const GLOSSARY = {
  consolidado: {
    title: 'Saldo consolidado',
    body: [
      'Es la suma de todas tus cuentas convertida a una sola moneda (la que elijas en Ajustes).',
      'Si tienes $100 en Zelle y Bs. 18.000 en Bancamiga, la app convierte los bolívares con la tasa que elegiste (BCV o Paralelo) y te muestra un solo número: tu patrimonio líquido.',
      'Consejo: valora con Paralelo si quieres saber cuántos dólares "reales" tendrías si cambiaras todo hoy.',
    ],
  },
  brecha: {
    title: 'Brecha cambiaria',
    body: [
      'Es la diferencia entre la tasa oficial (BCV) y la del mercado (Paralelo o USDT).',
      'Si el BCV está en 180 y el paralelo en 250, la brecha es de 38,9%. Eso significa que un dólar en el mercado compra 38,9% más bolívares que en el banco.',
      'Por eso pagar en bolívares un precio fijado en $ a tasa BCV puede salirte más barato si consigues esos bolívares a tasa paralela, o más caro si te los venden a un precio alto.',
    ],
  },
  costoReal: {
    title: 'Costo real de un pago en bolívares',
    body: [
      'Cuando pagas Bs. 3.600 desde una cuenta en dólares, lo que importa es cuántos dólares salieron de verdad de tu bolsillo.',
      'Costo real = bolívares pagados ÷ tasa a la que cambiaste. Precio BCV = bolívares ÷ tasa BCV.',
      'Si el costo real es menor que el precio BCV, la brecha te favoreció (ahorraste). Si es mayor, perdiste en el cambio. La app guarda ambos para que veas cuánto te cuesta o te ahorra la brecha cada mes.',
    ],
  },
  presupuesto: {
    title: 'Presupuesto mensual',
    body: [
      'Un tope de gasto por categoría para cada mes. No bloquea nada: te avisa.',
      'La regla práctica 50/30/20: 50% necesidades (mercado, servicios, alquiler), 30% gustos (salidas, suscripciones) y 20% ahorro.',
      'La barra se pone amarilla al 80% y roja cuando te pasas. El "ritmo" compara lo gastado con los días que van del mes.',
    ],
  },
  fijos: {
    title: 'Pagos fijos',
    body: [
      'Son gastos que se repiten cada mes el mismo día: alquiler, internet, Netflix, colegio.',
      'La app te avisa cuáles vienen en los próximos días y los registra con un toque cuando los pagas, para que nunca se te olviden ni tengas que escribirlos otra vez.',
    ],
  },
  ahorro: {
    title: 'Tasa de ahorro',
    body: [
      'Es el porcentaje de tus ingresos del mes que no gastaste: (ingresos − gastos) ÷ ingresos.',
      'Por encima del 20% vas muy bien; entre el 10% y el 20% es saludable; por debajo del 10% conviene revisar los gastos más grandes del mes.',
    ],
  },
  transferencia: {
    title: 'Transferencias entre cuentas',
    body: [
      'Mover dinero entre tus propias cuentas no es gasto ni ingreso: tu patrimonio no cambia.',
      'Si las cuentas tienen monedas distintas (Zelle → Pago Móvil), registra cuánto salió y cuánto llegó. La app sugiere el monto con la tasa del día y calcula la tasa a la que cambiaste.',
    ],
  },
  ajuste: {
    title: 'Ajustar saldo',
    body: [
      'Si el saldo de la app no coincide con el de tu banco, escribe el saldo real y la app crea un movimiento de "Ajuste de saldo" por la diferencia.',
      'Así nunca tocas el historial y siempre sabes cuándo y cuánto ajustaste.',
    ],
  },
};

// Textos que cambian por país: fuera de Venezuela no se habla de bolívares ni de BCV.
const LOCAL = {
  ES: {
    consolidado: ['Es la suma de todas tus cuentas convertida a una sola moneda (la que elijas en Ajustes).',
      'Si tienes 1.000 € en tu banco y 200 $ en PayPal, la app pasa los dólares a euros y te muestra un solo número: tu patrimonio líquido.'],
    transferencia: ['Mover dinero entre tus propias cuentas no es gasto ni ingreso: tu patrimonio no cambia.',
      'Si las cuentas tienen monedas distintas (por ejemplo, de euros a USDT en Binance), registra cuánto salió y cuánto llegó, y la app calcula a qué tasa cambiaste.'],
  },
  US: {
    consolidado: ['Es la suma de todas tus cuentas convertida a una sola moneda.',
      'Si tienes $1.000 en Chase y 200 USDT en Binance, la app los suma y te muestra un solo número: tu patrimonio líquido.'],
    transferencia: ['Mover dinero entre tus propias cuentas no es gasto ni ingreso: tu patrimonio no cambia.',
      'Por ejemplo, pasar dinero de tu checking a tu savings, o pagar con Zelle desde tu cuenta de Chase a tu cuenta de Bank of America.'],
  },
  INT: {
    consolidado: ['Es la suma de todas tus cuentas convertida a una sola moneda (la que elijas en Ajustes).',
      'Si tienes cuentas en dólares, euros o USDT, la app las convierte y te muestra un solo número: tu patrimonio líquido.'],
  },
};
const VE_ONLY = new Set(['brecha', 'costoReal']);
// Glosario de la persona: lo de bolívares y brecha solo si su país usa tasas.
export function glossaryFor(region) {
  const code = region?.code || 'VE';
  const out = {};
  for (const [k, g] of Object.entries(GLOSSARY)) {
    if (VE_ONLY.has(k) && !region?.rates) continue;
    const body = !region?.rates && LOCAL[code]?.[k];
    out[k] = body ? { ...g, body } : g;
  }
  return out;
}
