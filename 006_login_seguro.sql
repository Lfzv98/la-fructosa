-- =====================================================================
--  La Fructosa · Migración 006: entrar con usuario sin revelar correos
--  Ejecutar SOLO DESPUÉS de:
--    1. supabase functions deploy login --no-verify-jwt
--    2. Probar en la app que entras con tu USUARIO (no con el correo).
--  Idempotente. Si algo falla, se revierte con la última línea comentada.
-- =====================================================================

-- email_for_login devolvía el correo de cualquier usuario a cualquiera que lo pidiera, incluso sin sesión.
-- Ahora la Edge Function "login" lo consulta por dentro con el rol de servicio (service role) y nunca lo devuelve.
revoke execute on function public.email_for_login(text) from anon, authenticated, public;

-- Verificación: debe devolver false en ambas columnas.
select has_function_privilege('anon', 'public.email_for_login(text)', 'execute') as anon_puede,
       has_function_privilege('authenticated', 'public.email_for_login(text)', 'execute') as autenticado_puede;

-- Revertir (solo si hiciera falta):
-- grant execute on function public.email_for_login(text) to anon, authenticated;
