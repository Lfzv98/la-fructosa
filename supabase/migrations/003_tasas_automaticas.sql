-- =====================================================================
--  La Fructosa · Monitor de tasas automático (pg_cron + Edge Function)
--  Requisitos: haber desplegado la función:  supabase functions deploy update-rates
--  Reemplaza TU-PROYECTO y TU-ANON-KEY (Project Settings > API) y ejecuta.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Quita la programación anterior si existía.
select cron.unschedule('fructosa-tasas') where exists (select 1 from cron.job where jobname = 'fructosa-tasas');

-- 9:00 a. m. y 5:00 p. m. hora de Caracas (13:00 y 21:00 UTC), todos los días.
select cron.schedule(
  'fructosa-tasas',
  '0 13,21 * * *',
  $$
  select net.http_post(
    url     := 'https://TU-PROYECTO.supabase.co/functions/v1/update-rates',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer TU-ANON-KEY'),
    body    := '{}'::jsonb
  );
  $$
);

-- Para probar ya mismo (devuelve un id; mira el resultado en net._http_response):
-- select net.http_post(url := 'https://TU-PROYECTO.supabase.co/functions/v1/update-rates',
--   headers := jsonb_build_object('Authorization', 'Bearer TU-ANON-KEY'), body := '{}'::jsonb);
-- select * from public.latest_rates;
