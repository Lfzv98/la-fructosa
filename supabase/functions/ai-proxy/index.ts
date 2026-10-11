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
// AI_UPSTREAM: groq | gemini | xai.  Opcional: AI_ALLOWED_ORIGINS="https://lfzv98.github.io"
// Luego pon en js/config.js:  export const AI_PROXY_URL = 'https://<proyecto>.supabase.co/functions/v1/ai-proxy';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const UPSTREAMS: Record<string, { url: string; model: string }> = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash' },
  xai: { url: 'https://api.x.ai/v1/chat/completions', model: 'grok-3-mini' },
};

const GEMINI_MODELS = 'gemini-2.0-flash,gemini-2.5-flash,gemini-flash-latest';
// Lo normal para Gemini: un solo secreto, GEMINI_API_KEY (AI_API_KEY + AI_UPSTREAM sigue valiendo para otros proveedores).
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const KEY = GEMINI_KEY || (Deno.env.get('AI_API_KEY') ?? '');
const UP = UPSTREAMS[Deno.env.get('AI_UPSTREAM') ?? (GEMINI_KEY ? 'gemini' : 'groq')] ?? UPSTREAMS.groq;
// AI_MODEL admite varios modelos separados por coma: se prueban en orden si uno no existe (404),
// no tiene cupo (429), está saturado (5xx) o tarda más de 8 s en empezar a responder.
const MODELS = (Deno.env.get('AI_MODEL') || (UP === UPSTREAMS.gemini ? GEMINI_MODELS : UP.model)).split(',').map((s) => s.trim()).filter(Boolean);
const ORIGINS = (Deno.env.get('AI_ALLOWED_ORIGINS') ?? 'https://lfzv98.github.io,http://localhost:8000,http://127.0.0.1:8000')
  .split(',').map((s) => s.trim()).filter(Boolean);

const MAX_BODY = 90_000;           // bytes de la petición
const MAX_MESSAGES = 30;
const MAX_CHARS = 40_000;          // por mensaje (el prompt con datos es largo)
const MAX_TOKENS = 700;            // respuesta
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
const SERVER_GUARD = 'Eres el copiloto financiero de la app La Fructosa. Solo ayudas con finanzas personales y con el uso de la app. ' +
  'Si te piden cualquier otro tema, responde únicamente: "Lo siento, soy tu Copiloto Financiero de La Fructosa y solo puedo ayudarte con tus cuentas, saldos, tasas de cambio y el manejo de tus finanzas dentro de la aplicación."';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  const reply = (status: number, message: string) =>
    new Response(JSON.stringify({ error: { message } }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, 'Método no permitido');
  if (!KEY) return reply(503, 'El copiloto no está configurado en el servidor');
  if (origin && !ORIGINS.includes(origin)) return reply(403, 'Origen no permitido');

  // 1. Sesión válida
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return reply(401, 'Inicia sesión para usar el copiloto');

  // 2. Límite por usuario
  if (limited(user.id)) return reply(429, 'Demasiadas preguntas seguidas. Espera unos minutos.');

  // 3. Petición validada y reducida a lo imprescindible
  const raw = await req.text();
  if (raw.length > MAX_BODY) return reply(413, 'Petición demasiado grande');
  let body: { messages?: { role?: string; content?: unknown }[] };
  try { body = JSON.parse(raw); } catch { return reply(400, 'JSON no válido'); }
  if (!Array.isArray(body.messages) || !body.messages.length) return reply(400, 'Faltan mensajes');

  const messages = body.messages.slice(-MAX_MESSAGES)
    .filter((m) => m && ['system', 'user', 'assistant'].includes(String(m.role)) && typeof m.content === 'string')
    .map((m) => ({ role: String(m.role), content: String(m.content).slice(0, MAX_CHARS) }));
  if (!messages.length) return reply(400, 'Mensajes no válidos');

  // 4. Proveedor (la clave solo viaja de servidor a servidor). Prueba los modelos en orden.
  let upstream: Response | null = null;
  let lastStatus = 502;
  for (const model of MODELS) {
    const payload = {
      model, stream: true, temperature: 0.3, max_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: SERVER_GUARD }, ...messages],
    };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8_000); // solo hasta que empieza a responder
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
    }
  }
  if (!upstream) {
    return reply(lastStatus === 429 ? 429 : 502, lastStatus === 429 ? 'El proveedor alcanzó su límite. Inténtalo más tarde.' : 'El proveedor de IA no respondió. Inténtalo de nuevo.');
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream', 'Cache-Control': 'no-store' },
  });
});
