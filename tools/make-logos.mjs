// Genera icons/brands/*.svg y js/brands.js.
// Uso: node tools/make-logos.mjs <carpeta de la app>   (requiere: npm i simple-icons)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const si = require('simple-icons');

const OUT = process.argv[2] || '.';
const DIR = path.join(OUT, 'icons/brands');
fs.mkdirSync(DIR, { recursive: true });

// --- Catálogo. Orden = prioridad (lo más específico primero). ---
// si: logo de Simple Icons (CC0). mono: insignia con iniciales y el color de la marca. art: dibujo propio.
// bg/fg opcionales: colores de la ficha. m: patrón (sin acentos, en minúsculas).
const B = [];
let bank = false; // los bancos no se buscan en descripciones de movimientos ("Hotel del Sur" no es DelSur)
const L = (id, m, si_, o = {}) => B.push({ id, m, si: si_, bank, ...o });
const M = (id, m, mono, bg, o = {}) => B.push({ id, m, mono, bg, bank, ...o });

// Apps de pago, billeteras y cripto
L('zelle', 'zelle', 'zelle');
L('binance', 'binance', 'binance', { bg: '#1E2026', fg: '#F0B90B' });
L('cashapp', 'cash ?app', 'cashapp');
L('applepay', 'apple pay', 'applepay', { bg: '#000000' });
L('applecard', 'apple card', 'apple', { bg: '#000000' });
L('googlepay', 'google pay|\\bgpay\\b', 'googlepay', { bg: '#FFFFFF', fg: '#3C4043' });
L('paypal', 'paypal', 'paypal', { bg: '#003087' });
L('wise', '\\bwise\\b|transferwise', 'wise', { bg: '#9FE870', fg: '#163300' });
L('revolut', 'revolut', 'revolut', { bg: '#191C1F' });
L('venmo', 'venmo', 'venmo', { bg: '#008CFF' });
L('n26', '\\bn26\\b', 'n26', { bg: '#36A18B' });
L('payoneer', 'payoneer', 'payoneer', { bg: '#FF4800' });
L('westernunion', 'western union', 'westernunion', { bg: '#FFDD00', fg: '#000000' });
L('mercadopago', 'mercado ?pago', 'mercadopago', { bg: '#00B1EA' });
L('coinbase', 'coinbase', 'coinbase');
L('okx', '\\bokx\\b', 'okx', { bg: '#000000' });
L('kucoin', 'kucoin', 'kucoin', { bg: '#23AF91' });
L('robinhood', 'robinhood', 'robinhood', { bg: '#CCFF00', fg: '#000000' });
L('tradingview', 'tradingview', 'tradingview', { bg: '#131722' });
L('bitcoin', 'bitcoin|\\bbtc\\b', 'bitcoin');
L('ethereum', 'ethereum|\\beth\\b', 'ethereum', { bg: '#3C3C3D' });
L('solana', 'solana', 'solana', { bg: '#14141B', fg: '#14F195' });
L('cardano', 'cardano', 'cardano');
L('litecoin', 'litecoin', 'litecoin');
L('tether', 'tether|usdt', 'tether');
M('kraken', 'kraken', 'K', '#5741D9');
M('bybit', 'bybit', 'BYBIT', '#17181E', { fg: '#F7A600' });
M('bitget', 'bitget', 'bg', '#0D1117', { fg: '#00F0FF' });
M('trustwallet', 'trust wallet', 'TW', '#0500FF');
M('metamask', 'metamask', 'MM', '#F6851B');
M('eldorado', 'el dorado', 'ED', '#121212', { fg: '#F5C451' });
M('zinli', 'zinli', 'Z', '#5B2BE0');
M('wally', 'wally', 'W', '#00B37E');
M('airtm', 'airtm', 'A', '#2F3AF2');
M('reserve', '\\breserve\\b', 'R', '#3478F6');
M('meru', '\\bmeru\\b', 'M', '#111111', { fg: '#7CFFB2' });
M('kontigo', 'kontigo', 'K', '#00C389');
M('skrill', 'skrill', 'S', '#862165');
M('remitly', 'remitly', 'R', '#2B3990');
M('bizum', 'bizum', 'B', '#05C3DD');
M('nequi', 'nequi', 'N', '#200020', { fg: '#E80B8C' });
M('yape', '\\byape\\b', 'Y', '#742384');
M('chime', 'chime', 'C', '#1EC677');
M('sofi', '\\bsofi\\b', 'SoFi', '#00A2C7');
M('folionet', 'folionet|folio net', 'F', '#0F4C81');

bank = true;
// Bancos de Venezuela (sin logo libre: insignia con su color e iniciales)
M('bdv', 'banco de venezuela|\\bbdv\\b', 'BDV', '#D71920');
M('bvc', 'venezolano de credito', 'BVC', '#1B3B6F');
M('bnc', 'nacional de credito|\\bbnc\\b', 'BNC', '#003C7E');
M('banesco', 'banesco', 'B', '#00843D');
M('mercantil', 'mercantil', 'M', '#0033A0');
M('bbva', 'bbva|provincial', 'BBVA', '#004481');
M('bancamiga', 'bancamiga', 'B', '#00A19B');
M('tesoro', 'banco del tesoro', 'BT', '#B5121B');
M('bicentenario', 'bicentenario|trabajadores', 'BDT', '#C8102E');
M('bancaribe', 'bancaribe', 'B', '#0072BC');
M('bancoex', 'bancoex', 'BX', '#00529B');
M('exterior', 'banco exterior', 'E', '#00539B');
M('banplus', 'banplus', 'B+', '#E4002B');
M('bfc', 'fondo comun|\\bbfc\\b', 'BFC', '#00963F');
M('activo', 'banco activo', 'A', '#F58220');
M('plaza', 'banco plaza', 'P', '#0055A4');
M('caroni', 'caroni', 'C', '#003F87');
M('sofitasa', 'sofitasa', 'S', '#00539F');
M('100banco', '100 ?% ?banco', '100%', '#E31937');
M('delsur', 'del ?sur', 'DS', '#00A3E0');
M('bancrecer', 'bancrecer', 'BC', '#F7941D');
M('r4', '\\br4\\b|mi banco', 'R4', '#6D2077');
M('banfanb', 'banfanb', 'FANB', '#2E6B30');
M('agricola', 'agricola', 'BAV', '#2E7D32');
M('bangente', 'bangente', 'BG', '#F39200');
M('n58', '\\bn58\\b', 'N58', '#111111');
M('bid', 'internacional de desarrollo', 'BID', '#1D4F91');
M('banavih', 'banavih', 'BV', '#C8102E');
M('mcp', 'credito popular', 'IMCP', '#00609C');

// Bancos internacionales
L('bankofamerica', 'bank of america|\\bbofa\\b', 'bankofamerica', { bg: '#012169' });
L('chase', '\\bchase\\b', 'chase', { bg: '#117ACA' });
L('wellsfargo', 'wells fargo', 'wellsfargo', { bg: '#D71E28', fg: '#FFCD41' });
L('hsbc', '\\bhsbc\\b', 'hsbc', { bg: '#FFFFFF', fg: '#DB0011' });
L('discover', 'discover', 'discover', { bg: '#FF6000' });
L('amex', 'amex|american express', 'americanexpress', { bg: '#2E77BC' });
L('caixabank', 'caixabank', 'caixabank', { bg: '#007EAE' });
L('deutschebank', 'deutsche bank', 'deutschebank', { bg: '#0018A8' });
M('citi', 'citi ?bank|\\bciti\\b', 'citi', '#003B70');
M('capitalone', 'capital one', 'C1', '#004977');
M('santander', 'santander', 'S', '#EC0000');
M('scotiabank', 'scotiabank', 'S', '#EC111A');
M('itau', '\\bitau\\b', 'itaú', '#EC7000');
M('amerant', 'amerant', 'A', '#0A2240');
M('bancogeneral', 'banco general', 'BG', '#F39200');
M('bancolombia', 'bancolombia', 'B', '#FDDA24', { fg: '#000000' });
M('davivienda', 'davivienda', 'D', '#ED1C24');
M('bogota', 'banco de bogota', 'BB', '#003B71');
M('bancochile', 'banco de chile', 'BCh', '#002464');
M('bancoestado', 'bancoestado|banco estado', 'BE', '#F7941D');
M('pichincha', 'pichincha', 'P', '#FFDD00', { fg: '#0A2240' });
M('bcp', '\\bbcp\\b', 'BCP', '#002A8D', { fg: '#FF7800' });
M('interbank', 'interbank', 'IB', '#00A94F');
M('banorte', 'banorte', 'B', '#EB0029');
M('galicia', 'galicia', 'G', '#FA6400');
M('popular', 'banco popular', 'P', '#0055A6');
M('millennium', 'millennium|caixa', 'M', '#D1005D');
M('pnc', '\\bpnc\\b', 'PNC', '#EF7622');
M('td', '\\btd bank\\b|\\btd\\b', 'TD', '#008A00');
M('usbank', 'us bank|u\\.s\\. bank', 'US', '#0C2074');
M('truist', 'truist', 'T', '#2E1A47');
M('navyfederal', 'navy federal', 'NF', '#003A70');
M('ally', '\\bally\\b', 'ally', '#650360');
M('schwab', 'schwab', 'S', '#00A0DF');
M('regions', 'regions', 'R', '#5A9F2E');
M('fifththird', 'fifth third', '5/3', '#0B3B8C');
M('citizens', 'citizens', 'C', '#008555');
M('bmo', '\\bbmo\\b', 'BMO', '#0079C1');
M('ing', '\\bing\\b', 'ING', '#FF6200');
M('openbank', 'openbank', 'O', '#E30613');
M('bankinter', 'bankinter', 'B', '#FF6600');
M('sabadell', 'sabadell', 'S', '#006DFF');
M('unicaja', 'unicaja', 'U', '#00843D');
M('abanca', 'abanca', 'A', '#00A0DF');
M('ibercaja', 'ibercaja', 'I', '#003DA5');
M('kutxabank', 'kutxabank', 'K', '#E30613');
M('cajamar', 'cajamar', 'C', '#0BA14B');
M('evo', '\\bevo\\b', 'EVO', '#E4007C');
M('cajarural', 'caja rural', 'CR', '#007A4D');
M('bancamarch', 'banca march', 'M', '#B4975A');
M('mediolanum', 'mediolanum', 'M', '#003E7E');
M('selfbank', 'self bank', 'S', '#00B5E2');
M('triodos', 'triodos', 'T', '#00594F');
M('pibank', 'pibank', 'Pi', '#FF6A13');
M('caminos', 'banco caminos', 'BC', '#004B87');
M('imagin', 'imagin', 'i', '#00C1A7');
M('bnext', 'bnext', 'B', '#1D1D1B', { fg: '#00E1B4' });
M('myinvestor', 'myinvestor', 'MI', '#2D2DA0');

bank = false;
// Comercios y suscripciones (para movimientos y pagos fijos)
L('netflix', 'netflix', 'netflix', { bg: '#000000', fg: '#E50914' });
L('spotify', 'spotify', 'spotify', { bg: '#191414', fg: '#1ED760' });
L('youtube', 'youtube', 'youtube', { bg: '#FFFFFF', fg: '#FF0000' });
L('applemusic', 'apple music', 'applemusic', { bg: '#FA243C' });
L('icloud', 'icloud', 'icloud', { bg: '#3693F3' });
L('hbo', '\\bhbo\\b', 'hbo', { bg: '#000000' });
L('paramount', 'paramount', 'paramountplus', { bg: '#0064FF' });
L('crunchyroll', 'crunchyroll', 'crunchyroll');
L('twitch', 'twitch', 'twitch');
L('claude', '\\bclaude\\b', 'claude', { bg: '#F4F3EE', fg: '#D97757' });
L('anthropic', 'anthropic', 'anthropic', { bg: '#F0EEE6', fg: '#191919' });
L('dropbox', 'dropbox', 'dropbox');
L('playstation', 'playstation|\\bpsn\\b', 'playstation', { bg: '#003791' });
L('steam', '\\bsteam\\b', 'steam', { bg: '#171A21' });
L('ubereats', 'uber ?eats', 'ubereats', { bg: '#06C167' });
L('uber', '\\buber\\b', 'uber', { bg: '#000000' });
L('lyft', '\\blyft\\b', 'lyft');
L('doordash', 'doordash', 'doordash');
L('aliexpress', 'aliexpress', 'aliexpress');
L('mcdonalds', 'mc ?donald', 'mcdonalds', { bg: '#DA291C', fg: '#FFC72C' });
L('burgerking', 'burger king', 'burgerking', { bg: '#F5EBDC', fg: '#D62300' });
L('kfc', '\\bkfc\\b', 'kfc', { bg: '#A3080C' });
L('starbucks', 'starbucks', 'starbucks', { bg: '#006241' });
L('airbnb', 'airbnb', 'airbnb');
L('expedia', 'expedia', 'expedia', { bg: '#191E3B', fg: '#FDDB32' });
L('shell', '\\bshell\\b', 'shell', { bg: '#FFD500', fg: '#DD1D21' });
L('movistar', 'movistar', 'movistar', { bg: '#019DF4' });
L('vodafone', 'vodafone', 'vodafone', { bg: '#E60000' });
L('orange', '\\borange\\b', 'orange', { bg: '#000000', fg: '#FF7900' });
L('verizon', 'verizon', 'verizon', { bg: '#000000', fg: '#EE0000' });
L('duolingo', 'duolingo', 'duolingo');
L('notion', 'notion', 'notion', { bg: '#FFFFFF', fg: '#000000' });
L('github', 'github', 'github', { bg: '#181717' });
L('whatsapp', 'whatsapp', 'whatsapp');
L('ebay', '\\bebay\\b', 'ebay', { bg: '#FFFFFF', fg: '#E53238' });
L('etsy', '\\betsy\\b', 'etsy');
L('visa', '\\bvisa\\b', 'visa', { bg: '#1A1F71' });
L('mastercard', 'mastercard', 'mastercard', { bg: '#252525', fg: '#FF5F00' });
M('amazon', 'amazon|prime video', 'a', '#232F3E', { fg: '#FF9900' });
M('disney', 'disney', 'D+', '#0E1B4D');
M('chatgpt', 'chatgpt|openai', 'AI', '#10A37F');
M('cantv', 'cantv', 'C', '#0060A9');
M('digitel', 'digitel', 'D', '#E30613');
M('corpoelec', 'corpoelec', 'CE', '#0055A4', { fg: '#FFD200' });
M('starlink', 'starlink', 'S', '#000000');
M('mercadolibre', 'mercado ?libre', 'ML', '#FFE600', { fg: '#2D3277' });

// --- Dibujos propios para lo que no es una entidad ---
// Billete: bg, color del billete, símbolo.
const bill = (bg, paper, ink, sym, fs) => `<rect width="64" height="64" rx="15" fill="${bg}"/>
<g transform="rotate(-10 32 32)"><rect x="7" y="23" width="46" height="25" rx="4" fill="${paper}" opacity=".55"/></g>
<rect x="9" y="19" width="46" height="26" rx="4" fill="${paper}"/>
<rect x="12.5" y="22.5" width="39" height="19" rx="2.5" fill="none" stroke="${ink}" stroke-width="1.5" opacity=".6"/>
<circle cx="32" cy="32" r="8" fill="${ink}"/>
<text x="32" y="${32 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="${paper}">${sym}</text>`;
const ART = {
  'cash-usd': bill('#2F9E62', '#D4F5DF', '#2F9E62', '$', 12),
  'cash-ves': bill('#E0763A', '#FFE6D2', '#C2551E', 'Bs', 8.5),
  'cash-eur': bill('#3E6FD8', '#DCE7FF', '#2F59B8', '€', 11),
  'pagomovil': `<rect width="64" height="64" rx="15" fill="#1565C0"/>
<rect x="19" y="9" width="26" height="46" rx="6" fill="#FFFFFF"/><rect x="22" y="15" width="20" height="30" rx="2" fill="#D6E6FB"/>
<circle cx="32" cy="50" r="2" fill="#1565C0"/>
<text x="32" y="28" text-anchor="middle" font-size="9" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="#1565C0">Bs</text>
<path d="M25 34h13l-3-3M39 39H26l3 3" fill="none" stroke="#1565C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  'card': `<rect width="64" height="64" rx="15" fill="#6C5CE7"/>
<rect x="9" y="17" width="46" height="31" rx="5" fill="#FFFFFF"/><rect x="9" y="23" width="46" height="6" fill="#2D2A6E"/>
<rect x="14" y="34" width="9" height="7" rx="1.5" fill="#F5B83D"/><rect x="28" y="37" width="20" height="3" rx="1.5" fill="#C9C4F5"/>`,
  'savings': `<rect width="64" height="64" rx="15" fill="#EE7FA6"/>
<circle cx="35" cy="14" r="5" fill="#FFD25A"/><rect x="31" y="22" width="8" height="2.4" rx="1.2" fill="#B8456F"/>
<path d="M14 36c0-9 8-14 18-14s18 5 18 14c0 5-3 9-7 11v5h-6v-3h-10v3h-6v-5c-3-2-5-4-6-6h-3v-7h3c0 0 0-1 0-1z" fill="#FFFFFF"/>
<path d="M22 24l-3-6 7 3z" fill="#FFFFFF"/><circle cx="41" cy="33" r="1.8" fill="#B8456F"/><rect x="31" y="22" width="8" height="2.4" rx="1.2" fill="#B8456F"/>`,
  'bank': `<rect width="64" height="64" rx="15" fill="#3D5A80"/>
<path d="M32 11 11 22v3h42v-3z" fill="#FFFFFF"/><circle cx="32" cy="19" r="2" fill="#3D5A80"/>
<rect x="15" y="28" width="5" height="17" rx="1" fill="#FFFFFF"/><rect x="25" y="28" width="5" height="17" rx="1" fill="#FFFFFF"/>
<rect x="34" y="28" width="5" height="17" rx="1" fill="#FFFFFF"/><rect x="44" y="28" width="5" height="17" rx="1" fill="#FFFFFF"/>
<rect x="11" y="47" width="42" height="4" rx="1" fill="#FFFFFF"/><rect x="8" y="53" width="48" height="3" rx="1" fill="#FFFFFF" opacity=".75"/>`,
  'digital': `<rect width="64" height="64" rx="15" fill="#2A9D8F"/>
<rect x="20" y="9" width="24" height="46" rx="6" fill="#FFFFFF"/><rect x="23" y="15" width="18" height="30" rx="2" fill="#CDEFEA"/>
<circle cx="32" cy="50" r="2" fill="#2A9D8F"/><path d="M27 30l4 4 7-8" fill="none" stroke="#2A9D8F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  'crypto': `<rect width="64" height="64" rx="15" fill="#F2A900"/>
<circle cx="32" cy="32" r="19" fill="#FFFFFF"/><circle cx="32" cy="32" r="15" fill="none" stroke="#F2A900" stroke-width="2"/>
<path d="M32 21l9.5 5.5v11L32 43l-9.5-5.5v-11z" fill="#F2A900"/><path d="M32 27l4.8 2.8v5.5L32 38l-4.8-2.7v-5.5z" fill="#FFFFFF"/>`,
  'wallet': `<rect width="64" height="64" rx="15" fill="#8D6E63"/>
<rect x="10" y="18" width="44" height="32" rx="6" fill="#FFFFFF"/><path d="M14 18l26-7 4 7" fill="#EFE3DD"/>
<rect x="38" y="29" width="16" height="10" rx="3" fill="#D7C2B8"/><circle cx="44" cy="34" r="2" fill="#8D6E63"/>`,
};

// --- Utilidades ---
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
};
const svg = (body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const out = [];
for (const b of B) {
  let body, title;
  if (b.si) {
    const key = 'si' + b.si[0].toUpperCase() + b.si.slice(1);
    const ic = si[key];
    if (!ic) throw new Error('Falta en simple-icons: ' + b.si);
    title = ic.title;
    const hex = '#' + ic.hex;
    let bg = b.bg, fg = b.fg;
    if (!bg) { if (lum(hex) > 0.45) { bg = '#1E2026'; fg = fg || hex; } else { bg = hex; fg = fg || '#FFFFFF'; } }
    if (!fg) fg = lum(bg) > 0.45 ? hex : '#FFFFFF';
    if (fg.toUpperCase() === bg.toUpperCase()) fg = lum(bg) > 0.45 ? '#111111' : '#FFFFFF';
    const stroke = bg.toUpperCase() === '#FFFFFF' || lum(bg) > 0.85 ? `<rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="none" stroke="#000" stroke-opacity=".08"/>` : '';
    body = `<rect width="64" height="64" rx="15" fill="${bg}"/>${stroke}<path transform="translate(15 15) scale(1.4167)" fill="${fg}" d="${ic.path}"/>`;
  } else {
    title = b.id;
    const t = b.mono, n = [...t].length;
    const fs = n <= 1 ? 32 : n === 2 ? 25 : n === 3 ? 19 : n === 4 ? 15 : 12.5;
    const fg = b.fg || (lum(b.bg) > 0.45 ? '#111111' : '#FFFFFF');
    body = `<rect width="64" height="64" rx="15" fill="${b.bg}"/><text x="32" y="${(32 + fs * 0.36).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="800" letter-spacing="${n > 2 ? -0.5 : 0}" font-family="Arial, Helvetica, sans-serif" fill="${fg}">${esc(t)}</text>`;
  }
  fs.writeFileSync(path.join(DIR, b.id + '.svg'), svg(body, esc(title)));
  out.push([b.id, b.m, b.bank]);
}
for (const [id, body] of Object.entries(ART)) { fs.writeFileSync(path.join(DIR, id + '.svg'), svg(body, id)); }

// --- js/brands.js ---
const js = `// Logos de bancos, apps, cripto y comercios (generado por tools/make-logos.mjs: no editar a mano).
// Los archivos viven en icons/brands/ y se guardan en el teléfono con la app (funcionan sin conexión).
// Logos de Simple Icons (CC0) cuando existen; si no, una insignia con el color y las iniciales de la marca.
// Las marcas pertenecen a sus dueños; aquí solo identifican la cuenta de cada persona.
export const BRANDS = [
${out.map(([id, m, bk]) => `  ['${id}', /${m}/${bk ? ', 1' : ''}],`).join('\n')}
];
export const ART_IDS = ${JSON.stringify(Object.keys(ART))};
`;
fs.writeFileSync(path.join(OUT, 'js/brands.data.js'), js);
console.log(B.length, 'marcas +', Object.keys(ART).length, 'dibujos');
