-- =====================================================================
--  La Fructosa · Migración 008: avisos al teléfono (notificaciones push)
--  Antes: desplegar la función (pasos en supabase/functions/send-reminders/index.ts).
--  1) Ejecuta este archivo completo. 2) Reemplaza TU-PROYECTO y TU-CRON-SECRET
--     (el mismo valor que pusiste en  supabase secrets set CRON_SECRET=...).
--  Idempotente: puedes ejecutarlo de nuevo.
-- =====================================================================

-- 1. Suscripciones: una fila por persona y teléfono. RLS: cada persona ve solo las suyas.
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint      text not null check (char_length(endpoint) < 1000),
  p256dh        text not null,
  auth          text not null,
  prefs         jsonb not null default '{"bills": true, "loans": true, "rates": false}'::jsonb,
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz,
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_select_own" on public.push_subscriptions;
drop policy if exists "push_insert_own" on public.push_subscriptions;
drop policy if exists "push_update_own" on public.push_subscriptions;
drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_insert_own" on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_update_own" on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push_delete_own" on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- 2. Envío diario a las 8:30 a. m. de Caracas (12:30 UTC).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('fructosa-avisos') where exists (select 1 from cron.job where jobname = 'fructosa-avisos');
select cron.schedule(
  'fructosa-avisos',
  '30 12 * * *',
  $$
  select net.http_post(
    url     := 'https://TU-PROYECTO.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'TU-CRON-SECRET'),
    body    := '{}'::jsonb
  );
  $$
);

-- Para probar de inmediato (consulta el resultado en net._http_response):
-- select net.http_post(url := 'https://TU-PROYECTO.supabase.co/functions/v1/send-reminders',
--   headers := jsonb_build_object('x-cron-secret', 'TU-CRON-SECRET'), body := '{}'::jsonb);
