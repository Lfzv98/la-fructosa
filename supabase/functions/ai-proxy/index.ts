// La Fructosa · Edge Function "ai-proxy"
// Reenvía las preguntas del Copiloto IA a Groq / Gemini / xAI usando una clave que vive
// SOLO aquí (secreto del servidor). Así nadie tiene que pegar una clave y la clave nunca
// llega al navegador ni al repositorio.
//
// Seguridad:
//  · Exige sesión de Supabase (JWT del usuario). Sin sesión no hay respuesta.
//  · Límite por usuario (mejor esfuerzo: en memoria de cada instancia).
//  · El modelo, la temperatura y el máximo de tokens los fija el servidor, no el cliente.
//  · Solo acepta peticiones desde los orígenes permitidos (CORS).
//
// Configurar y desplegar (una sola vez):
//   Gemini (lo más simple, un solo secreto):  supabase secrets set GEMINI_API_KEY=tu-clave
//   Otro proveedor:  supabase secrets set AI_API_KEY=tu-clave AI_UPSTREAM=groq AI_MODEL=llama-3.3-70b-versatile
//   supabase functions deploy ai-proxy
// AI_UPSTREAM: groq | gemini | xai.  Opcional: AI_ALLOWED_ORIGINS="https://lfzv98.github.io,https://la-fructosa.vercel.app"
// Luego pon en js/config.js:  export const AI_PROXY_URL = 'https://<proyecto>.supabase.co/functions/v1/ai-proxy';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const UPSTREAMS: Record<string, { url: string; model: string }> = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-3.6-flash' },
  xai: { url: 'https://api.x.ai/v1/chat/completions', model: 'grok-3-mini' },
};

// gemini-2.0-flash se apagó en junio de 2026 y los 2.5 solo están para cuentas que ya los usaban.
const GEMINI_MODELS = 'gemini-3.6-flash,gemini-3.8-flash,gemini-flash-latest,gemini-3.5-flash-lite,gemini-2.5-flash';
// Lo normal para Gemini: un solo secreto, GEMINI_API_KEY (AI_API_KEY + AI_UPSTREAM sigue valiendo para otros proveedores).
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const KEY = GEMINI_KEY || (Deno.env.get('AI_API_KEY') ?? '');
const UP = UPSTREAMS[Deno.env.get('AI_UPSTREAM') ?? (GEMINI_KEY ? 'gemini' : 'groq')] ?? UPSTREAMS.groq;
// AI_MODEL admite varios modelos separados por coma: se prueban en orden si uno no existe (404),
// no tiene cupo (429), está saturado (5xx) o tarda más de FIRST_BYTE_MS en empezar a responder.
const MODELS = (Deno.env.get('AI_MODEL') || (UP === UPSTREAMS.gemini ? GEMINI_MODELS : UP.model)).split(',').map((s) => s.trim()).filter(Boolean);
// Modelos vigentes según Google (ListModels), revisados cada 6 horas. Se prueban primero los de MODELS que
// sigan existiendo y detrás los Flash más nuevos: si Google apaga un modelo o saca uno nuevo, el copiloto
// sigue funcionando sin volver a desplegar.
const LIST_EVERY_MS = 6 * 60 * 60 * 1000;
let catalog: { at: number; names: Set<string> } | null = null;
export function newestFlash(names: Iterable<string>, exclude: string[] = []): string[] {
  const ver = (m: string) => (m.match(/gemini-(\d+(?:\.\d+)?)/) ?? ['', '0'])[1].split('.').map(Number);
  return [...names]
    .filter((m) => /^gemini-[\d.]+-flash(-lite)?$|^gemini-flash(-lite)?-latest$/.test(m) && !exclude.includes(m))
    .sort((a, b) => {
      const va = ver(a), vb = ver(b);
      return (vb[0] - va[0]) || ((vb[1] ?? 0) - (va[1] ?? 0)) || (Number(a.includes('lite')) - Number(b.includes('lite')));
    });
}
export function chainFrom(models: string[], names: Set<string> | null): string[] {
  if (!names?.size) return models;
  const keep = models.filter((m) => names.has(m));
  const chain = [...keep, ...newestFlash(names, keep).slice(0, 3)];
  return chain.length ? chain : models;
}
async function modelChain(): Promise<string[]> {
  if (UP !== UPSTREAMS.gemini || !GEMINI_KEY) return MODELS;
  if (!catalog || Date.now() - catalog.at > LIST_EVERY_MS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(GEMINI_KEY)}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const j = await res.json();
        const names = new Set<string>();
        for (const m of j.models ?? []) {
          if ((m.supportedGenerationMethods ?? []).includes('generateContent')) names.add(String(m.name ?? '').replace(/^models\//, ''));
        }
        catalog = { at: Date.now(), names };
      } else await res.body?.cancel();
    } catch (_) { /* sin catálogo: se usa la lista fija */ }
  }
  return chainFrom(MODELS, catalog?.names ?? null);
}

// Orígenes permitidos (CORS), separados por coma. Acepta * como comodín, p. ej.
// https://la-fructosa-*.vercel.app para las vistas previas de Vercel.
const ORIGINS = (Deno.env.get('AI_ALLOWED_ORIGINS') ??
  'https://lfzv98.github.io,https://la-fructosa.vercel.app,https://la-fructosa-*.vercel.app,http://localhost:8000,http://127.0.0.1:8000')
  .split(',').map((s) => s.trim()).filter(Boolean);
const originOk = (o: string) => ORIGINS.some((p) => p === o ||
  (p.includes('*') && new RegExp('^' + p.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('[a-z0-9-]*') + '$').test(o)));

const MAX_BODY = 2_000_000;        // bytes de la petición (una captura comprimida ocupa ~0,2–1,2 MB)
const MAX_IMAGE = 1_500_000;       // caracteres base64 de la imagen (solo una por petición, del usuario)
const MAX_MESSAGES = 30;
const MAX_CHARS = 40_000;          // por mensaje (el prompt con datos es largo)
const MAX_TOKENS = 2048;           // respuesta (en Gemini 3 incluye el "pensamiento": con 700 se quedaba sin texto)
const FIRST_BYTE_MS = 30_000;      // Gemini 3 piensa antes de responder: 8 s cortaba respuestas buenas
const LIMIT = 30;                  // peticiones…
const WINDOW_MS = 10 * 60 * 1000;  // …cada 10 minutos por usuario

const hits = new Map<string, number[]>();
function limited(user: string): boolean {
  const now = Date.now();
  const list = (hits.get(user) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= LIMIT) { hits.set(user, list); return true; }
  list.push(now);
  hits.set(user, list);
  return false;
}

// Regla fija del servidor: aunque alguien llame a la función sin la app, solo hay finanzas.
const SERVER_GUARD = 'Eres Fructosa, la asistente personal de finanzas de la app La Fructosa. Solo ayudas con finanzas personales y con el uso de la app. ' +
  'Si te piden cualquier otro tema, responde únicamente: "Lo siento, soy Fructosa, tu asistente personal de finanzas en La Fructosa, y solo puedo ayudarte con tus cuentas, saldos, tasas de cambio y el manejo de tus finanzas dentro de la aplicación."';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': originOk(origin) ? origin : ORIGINS[0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
  const reply = (status: number, message: string) =>
    new Response(JSON.stringify({ error: { message } }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  // GET: la app pregunta qué sabe hacer esta versión (v2 = lee capturas y recibos).
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, v: 3, images: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return reply(405, 'Método no permitido');
  if (!KEY) return reply(503, 'El copiloto no está configurado en el servidor');
  if (origin && !originOk(origin)) return reply(403, 'Origen no permitido');

  // 1. Sesión válida
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return reply(401, 'Inicia sesión para usar el copiloto');

  // 2. Límite por usuario
  if (limited(user.id)) return reply(429, 'Has hecho demasiadas preguntas seguidas. Espera unos minutos e inténtalo de nuevo.');

  // 3. Petición validada y reducida a lo imprescindible
  const raw = await req.text();
  if (raw.length > MAX_BODY) return reply(413, 'La solicitud es demasiado grande');
  let body: { messages?: { role?: string; content?: unknown }[] };
  try { body = JSON.parse(raw); } catch { return reply(400, 'JSON no válido'); }
  if (!Array.isArray(body.messages) || !body.messages.length) return reply(400, 'Faltan mensajes');

  // Contenido: texto, o (solo del usuario) texto + UNA imagen en base64 (captura de Pago Móvil, recibo…).
  type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
  let imageUsed = false;
  const clean = (role: string, content: unknown): string | Part[] | null => {
    if (typeof content === 'string') return content.slice(0, MAX_CHARS);
    if (!Array.isArray(content) || role !== 'user') return null;
    const parts: Part[] = [];
    for (const p of content as { type?: string; text?: unknown; image_url?: { url?: unknown } }[]) {
      if (p?.type === 'text' && typeof p.text === 'string') parts.push({ type: 'text', text: p.text.slice(0, MAX_CHARS) });
      const url = p?.type === 'image_url' ? String(p.image_url?.url ?? '') : '';
      if (url && !imageUsed && url.length <= MAX_IMAGE && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) {
        parts.push({ type: 'image_url', image_url: { url } });
        imageUsed = true;
      }
    }
    return parts.length ? parts : null;
  };
  const messages = body.messages.slice(-MAX_MESSAGES).reverse() // la imagen permitida es la del último mensaje
    .filter((m) => m && ['system', 'user', 'assistant'].includes(String(m.role)))
    .map((m) => ({ role: String(m.role), content: clean(String(m.role), m.content) }))
    .filter((m) => m.content !== null)
    .reverse();
  if (!messages.length) return reply(400, 'Mensajes no válidos');

  // 4. Proveedor (la clave solo viaja de servidor a servidor). Prueba los modelos en orden.
  let upstream: Response | null = null;
  let lastStatus = 502;
  for (const model of await modelChain()) {
    const payload = {
      model, stream: true, temperature: 0.3, max_tokens: MAX_TOKENS,
      ...(UP === UPSTREAMS.gemini ? { reasoning_effort: 'low' } : {}),
      messages: [{ role: 'system', content: SERVER_GUARD }, ...messages],
    };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FIRST_BYTE_MS); // solo hasta que empieza a responder
    try {
      const res = await fetch(UP.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (res.ok) { upstream = res; break; }
      lastStatus = res.status;
      console.error('ai-proxy upstream', model, res.status); // nunca se registra la clave ni la conversación
      await res.body?.cancel();
      if (![404, 429].includes(res.status) && res.status < 500) break; // clave inválida, etc.: otro modelo no ayuda
    } catch (_) {
      clearTimeout(timer);
      lastStatus = 504;
      console.error('ai-proxy upstream', model, 'sin respuesta');
      break; // si un modelo no respondió en FIRST_BYTE_MS, esperar otro tanto con el siguiente no ayuda
    }
  }
  if (!upstream) {
    return reply(lastStatus === 429 ? 429 : 502, lastStatus === 429 ? 'El proveedor alcanzó su límite de uso. Inténtalo más tarde.' : 'El proveedor de IA no respondió. Inténtalo de nuevo.');
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream', 'Cache-Control': 'no-store' },
  });
});
