// La Fructosa · Edge Function "login"
// Entrar con USUARIO + contraseña sin revelar el correo de nadie.
// Antes, la app pedía a la BD "¿cuál es el correo de este usuario?" (email_for_login) y
// cualquiera, sin sesión, podía preguntarlo. Ahora todo pasa aquí, en el servidor:
// se busca el correo, se valida la contraseña y solo se devuelve la sesión si es correcta.
// Si el usuario no existe o la contraseña falla, la respuesta es la misma: nadie aprende nada.
//
// Desplegar (una vez):  supabase functions deploy login --no-verify-jwt
// (--no-verify-jwt porque quien entra todavía no tiene sesión.)
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Orígenes permitidos (CORS), separados por coma. Acepta * como comodín, p. ej.
// https://la-fructosa-*.vercel.app para las vistas previas de Vercel.
const ORIGINS = (Deno.env.get('LOGIN_ALLOWED_ORIGINS') ?? Deno.env.get('AI_ALLOWED_ORIGINS') ??
  'https://lfzv98.github.io,https://la-fructosa.vercel.app,https://la-fructosa-*.vercel.app,http://localhost:8000,http://127.0.0.1:8000')
  .split(',').map((s) => s.trim()).filter(Boolean);
const originOk = (o: string) => ORIGINS.some((p) => p === o ||
  (p.includes('*') && new RegExp('^' + p.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('[a-z0-9-]*') + '$').test(o)));

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// Freno a quien prueba contraseñas (mejor esfuerzo, en memoria de cada instancia).
const LIMIT = 10, WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();
function limited(key: string): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(key, list);
  return list.length > LIMIT;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': originOk(origin) ? origin : ORIGINS[0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  const send = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  const denied = () => send(400, { error: { message: 'Invalid login credentials' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return send(405, { error: { message: 'Método no permitido' } });
  if (origin && !originOk(origin)) return send(403, { error: { message: 'Origen no permitido' } });

  let body: { login?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return denied(); }
  const login = String(body.login ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!/^[a-z0-9._]{3,20}$/.test(login) || !password || password.length > 200) return denied();

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  if (limited('u:' + login) || (ip && limited('ip:' + ip))) {
    return send(429, { error: { message: 'Demasiados intentos. Espera unos minutos.' } });
  }

  // 1. Usuario → id → correo (solo en el servidor; nunca sale de aquí).
  // La BD solo guarda usuarios en minúsculas (restricción profiles_username_format).
  const { data: prof } = await admin.from('profiles').select('id').eq('username', login).maybeSingle();
  if (!prof) return denied();
  const { data: u } = await admin.auth.admin.getUserById(prof.id);
  const email = u?.user?.email;
  if (!email) return denied();

  // 2. Contraseña: la valida Supabase Auth como siempre.
  const pub = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await pub.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    // "Email not confirmed" sí se informa: es del propio usuario, que ya sabe su contraseña.
    if (error && /confirm/i.test(error.message)) return send(400, { error: { message: error.message } });
    return denied();
  }
  return send(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
