-- =====================================================================
--  La Fructosa · Migración 014: tasas guardadas todos los días + historial
--  No hay nada que reemplazar: copia todo, pégalo en el SQL Editor y presiona Run.
--  Antes: despliega la función con  npx supabase functions deploy update-rates --no-verify-jwt
--  Idempotente: puedes ejecutarla otra vez sin problema.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. El reloj: 8:00, 11:00, 2:00 p. m. y 6:00 p. m. hora de Caracas, todos los días.
--    Reemplaza la programación anterior (la 003 pedía pegar la dirección y una clave a mano).
select cron.unschedule(jobid) from cron.job where jobname = 'fructosa-tasas';
select cron.schedule(
  'fructosa-tasas',
  '0 12,15,18,22 * * *',
  $$
  select net.http_post(
    url     := 'https://bkausossugbbyfsersmb.supabase.co/functions/v1/update-rates',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- 2. Ahora mismo: guarda las tasas de hoy y copia el historial público (BCV, paralelo y euro).
select net.http_post(
  url     := 'https://bkausossugbbyfsersmb.supabase.co/functions/v1/update-rates',
  headers := jsonb_build_object('Content-Type', 'application/json'),
  body    := '{"backfill": true}'::jsonb,
  timeout_milliseconds := 30000
) as llamada;

-- 3. Espera unos 20 segundos y ejecuta SOLO estas consultas para comprobar (selecciónalas y presiona Run):
--
-- Días guardados por tasa (debería haber decenas para BCV, paralelo y euro, y hoy para USDT):
-- select rate_type, count(*) as dias, min(rate_date) as desde, max(rate_date) as hasta
--   from public.exchange_rates group by rate_type order by rate_type;
--
-- Qué respondió la función (200 = bien; 401 = falta --no-verify-jwt; 404 = la función no está desplegada):
-- select status_code, left(content::text, 300) as respuesta, created
--   from net._http_response order by created desc limit 5;
--
-- El reloj está programado:
-- select jobname, schedule, active from cron.job where jobname = 'fructosa-tasas';
