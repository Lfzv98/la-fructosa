// Logos e imágenes de cuentas, inversiones y comercios.
// Bancos, apps y cripto muestran su logo; lo que no es una entidad (efectivo, tarjeta, ahorro…)
// muestra un dibujo de lo que es. Todo vive en icons/brands/ (sin conexión no hace falta internet).
// Si no se reconoce el nombre, se muestra el ícono de siempre. Los componentes están en logos.js.
import { BRANDS } from './brands.data.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const logoSrc = (id) => `./icons/brands/${id}.svg`;

const memo = new Map();
// Logo de una marca escrita en un texto (nombre de cuenta, descripción, inversión). null si no hay.
// banks: false deja fuera los bancos (para descripciones de movimientos).
export function brandId(text, { banks = true } = {}) {
  const n = norm(text);
  if (!n) return null;
  const k = (banks ? 'b:' : 'm:') + n;
  if (memo.has(k)) return memo.get(k);
  const hit = BRANDS.find(([, re, bank]) => (banks || !bank) && re.test(n));
  const id = hit ? hit[0] : null;
  memo.set(k, id);
  return id;
}

const CASH = { USD: 'cash-usd', VES: 'cash-ves', EUR: 'cash-eur', USDT: 'cash-usd' };
// Íconos que la app pone por defecto (o que se eligen en "Ícono y color") y su dibujo equivalente.
const EMOJI_ART = { '🏦': 'bank', '📱': 'digital', '📲': 'digital', '🪙': 'crypto', '💳': 'card', '🐷': 'savings', '💶': 'cash-eur', '💰': 'wallet' };
const KIND_ART = { bank: 'bank', digital: 'digital', crypto: 'crypto' };

// Imagen de una cuenta: logo de la entidad, o dibujo de lo que es. null = usar su emoji.
export function accountLogo(a) {
  if (!a) return null;
  const n = norm(a.name);
  const b = brandId(n);
  if (b) return b;
  if (/pago ?movil/.test(n)) return 'pagomovil';
  if (a.icon && a.icon !== '💵' && !EMOJI_ART[a.icon]) return null; // emoji propio (✈️, 🎓…): se respeta
  if (/efectivo|\bcash\b|billete/.test(n) || a.icon === '💵' || a.kind === 'cash') return CASH[a.currency] || 'cash-usd';
  if (/tarjeta|\bcard\b|credito|debito/.test(n)) return 'card';
  if (/ahorro|savings|alcancia/.test(n)) return 'savings';
  if (a.icon && EMOJI_ART[a.icon] !== 'bank') return EMOJI_ART[a.icon];
  return KIND_ART[a.kind] || 'bank';
}
