// Ilustraciones de La Fructosa: línea fina + relleno suave, temática financiera.
// Dibujadas en 96×96. Las clases f1/f2/f3 (styles.css) pintan los rellenos con la paleta de la app;
// el trazo usa currentColor. Son SVG propios: no dependen de imágenes externas.
const T = (x, y, s, ch) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${s}" font-weight="700" fill="currentColor" stroke="none" font-family="Inter, system-ui, sans-serif">${ch}</text>`;

export const ART = {
  // Monedas apiladas + moneda de dólar
  coins: `
    <ellipse class="f1" cx="38" cy="72" rx="27" ry="9"/>
    <path d="M12 58v12c0 5 12 9 26 9s26-4 26-9V58"/>
    <path d="M12 44v12c0 5 12 9 26 9s26-4 26-9V44"/>
    <ellipse class="f1" cx="38" cy="44" rx="26" ry="9"/>
    <ellipse cx="38" cy="44" rx="26" ry="9"/>
    <circle class="f2" cx="68" cy="30" r="18"/><circle cx="68" cy="30" r="18"/><circle cx="68" cy="30" r="12.5" stroke-opacity=".35"/>
    ${T(68, 37, 19, '$')}`,

  // Divisas: USD · EUR · VES
  currencies: `
    <circle class="f1" cx="34" cy="36" r="21"/><circle cx="34" cy="36" r="21"/>${T(34, 44, 24, '$')}
    <circle class="f2" cx="64" cy="40" r="19"/><circle cx="64" cy="40" r="19"/>${T(64, 47, 22, '€')}
    <circle class="f3" cx="46" cy="68" r="17"/><circle cx="46" cy="68" r="17"/>${T(46, 73, 14, 'Bs')}`,

  // Divisas de España: EUR · USD · USDT
  currencies_ES: `
    <circle class="f1" cx="34" cy="36" r="21"/><circle cx="34" cy="36" r="21"/>${T(34, 44, 24, '€')}
    <circle class="f2" cx="64" cy="40" r="19"/><circle cx="64" cy="40" r="19"/>${T(64, 47, 22, '$')}
    <circle class="f3" cx="46" cy="68" r="17"/><circle cx="46" cy="68" r="17"/>${T(46, 74, 18, '₮')}`,

  // Divisas de Estados Unidos: USD · USDT
  currencies_US: `
    <circle class="f1" cx="38" cy="44" r="24"/><circle cx="38" cy="44" r="24"/>${T(38, 53, 27, '$')}
    <circle class="f2" cx="66" cy="62" r="18"/><circle cx="66" cy="62" r="18"/>${T(66, 69, 19, '₮')}`,

  // Gráfico de crecimiento
  growth: `
    <path d="M14 14v68h70"/>
    <path class="f1" d="M20 68 36 52l12 10 28-30v50H20z"/>
    <path d="m20 68 16-16 12 10 28-30"/><path d="M62 32h14v14"/>
    <circle cx="36" cy="52" r="2.6" fill="currentColor" stroke="none"/><circle cx="48" cy="62" r="2.6" fill="currentColor" stroke="none"/>`,

  // Escudo de seguridad
  shield: `
    <path class="f1" d="M48 10 18 21v23c0 19 13 33 30 40 17-7 30-21 30-40V21z"/>
    <path d="M48 10 18 21v23c0 19 13 33 30 40 17-7 30-21 30-40V21z"/>
    <path d="m34 46 10 10 19-21"/>`,

  // Banco
  bank: `
    <path class="f1" d="M48 12 12 30h72z"/><path d="M48 12 12 30h72z"/>
    <path d="M20 38v30M38 38v30M58 38v30M76 38v30"/>
    <path d="M12 76h72M8 84h80"/><circle cx="48" cy="24" r="3" fill="currentColor" stroke="none"/>`,

  // Meta / presupuesto
  target: `
    <circle class="f1" cx="46" cy="52" r="32"/><circle cx="46" cy="52" r="32"/>
    <circle cx="46" cy="52" r="21"/><circle cx="46" cy="52" r="10"/>
    <path d="M46 52 78 20M68 18v14h14"/>`,

  // Pagos fijos
  calendar: `
    <rect class="f1" x="12" y="20" width="72" height="64" rx="11"/><rect x="12" y="20" width="72" height="64" rx="11"/>
    <path d="M12 40h72M32 12v14M64 12v14"/>
    <circle cx="48" cy="62" r="12"/>${T(48, 67, 14, '$')}`,

  // Recibo / sin movimientos
  receipt: `
    <path class="f1" d="M24 10h48v76l-8-6-8 6-8-6-8 6-8-6-8 6z"/>
    <path d="M24 10h48v76l-8-6-8 6-8-6-8 6-8-6-8 6z"/>
    <path d="M36 28h24M36 40h24M36 52h13"/>`,

  // Búsqueda sin resultados
  search: `
    <circle class="f1" cx="42" cy="42" r="26"/><circle cx="42" cy="42" r="26"/>
    <path d="m62 62 22 22"/>${T(42, 50, 24, '?')}`,

  // Base de datos (falta migración)
  database: `
    <ellipse class="f1" cx="48" cy="26" rx="28" ry="11"/><ellipse cx="48" cy="26" rx="28" ry="11"/>
    <path d="M20 26v44c0 6 12.5 11 28 11s28-5 28-11V26"/>
    <path d="M20 48c0 6 12.5 11 28 11s28-5 28-11"/>`,

  // Sin conexión
  offline: `
    <path class="f1" d="M26 70a15 15 0 0 1 1-30 23 23 0 0 1 43-4 17 17 0 0 1 3 34z"/>
    <path d="M26 70a15 15 0 0 1 1-30 23 23 0 0 1 43-4 17 17 0 0 1 3 34z"/>
    <path d="M18 14l60 68"/>`,

  // Asistente (Fructosa): burbuja con gráfico
  assistant: `
    <path class="f1" d="M20 16h56a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H46L28 82V64h-8a10 10 0 0 1-10-10V26a10 10 0 0 1 10-10z"/>
    <path d="M20 16h56a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H46L28 82V64h-8a10 10 0 0 1-10-10V26a10 10 0 0 1 10-10z"/>
    <path d="m24 52 14-12 10 7 20-20"/><path d="M60 27h8v8"/>`,

  // Nube de respaldo
  cloud: `
    <path class="f1" d="M26 70a15 15 0 0 1 1-30 23 23 0 0 1 43-4 17 17 0 0 1 3 34z"/>
    <path d="M26 70a15 15 0 0 1 1-30 23 23 0 0 1 43-4 17 17 0 0 1 3 34z"/>
    <path d="m38 52 8 8 14-16"/>`,
};
