// Configuración de Supabase para La Fructosa
// Estas claves son públicas (anon/publishable). La seguridad real está en RLS.
export const SUPABASE_URL = "https://bkausossugbbyfsersmb.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_yNEvh9BPnRoTVDbfQAa0ZQ_AF3gJgVE";

// ---------------------------------------------------------------------
// Copiloto IA incluido: que nadie tenga que pegar una clave.
// Este archivo es PÚBLICO (GitHub Pages): nunca pongas aquí una clave que no quieras que lea cualquiera.
//
// OPCIÓN 1 · RECOMENDADA — Proxy seguro. La clave vive como secreto en Supabase y la app
// se identifica con la sesión del usuario. Pasos en supabase/functions/ai-proxy/index.ts.
// Ejemplo: https://bkausossugbbyfsersmb.supabase.co/functions/v1/ai-proxy
export const AI_PROXY_URL = "https://bkausossugbbyfsersmb.supabase.co/functions/v1/ai-proxy";

// OPCIÓN 2 · NO recomendada — Clave global dentro de la app. Cualquiera podrá leerla y usarla,
// gastar tu cuota y GitHub/Google/Groq/xAI suelen revocarla al detectarla. Déjala vacía si no la necesitas.
export const AI_DEFAULT_KEY = "";
export const AI_DEFAULT_PROVIDER = "gemini";   // gemini | groq | grok | custom
export const AI_DEFAULT_MODEL = "";            // vacío = modelo por defecto del proveedor
export const AI_DEFAULT_ENDPOINT = "";         // solo para provider "custom"
