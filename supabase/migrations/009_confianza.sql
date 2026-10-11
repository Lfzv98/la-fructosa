-- =====================================================================
--  La Fructosa · Migración 009: tasas más seguidas, recordatorio de respaldo y borrar cuenta
--  No hay nada que reemplazar: copia todo, pégalo en el SQL Editor y dale a Run.
--  Idempotente: puedes correrlo de nuevo. Si aún no corriste 003 u 008, esas partes se saltan solas.
-- =====================================================================

-- 1. Tasas: el monitor (003) corre 4 veces al día en vez de 2, para que si una fuente falla
--    a las 8 se recupere sola más tarde. 8:00, 11:00, 2:00 p. m. y 6:00 p. m. hora de Caracas.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from cron.job where jobname = 'fructosa-tasas') then
    perform cron.alter_job((select jobid from cron.job where jobname = 'fructosa-tasas'), schedule := '0 12,15,18,22 * * *');
  end if;
end $$;

-- 2. Avisos (008): fecha del último respaldo, para el recordatorio semanal al teléfono.
do $$
begin
  if to_regclass('public.push_subscriptions') is not null then
    alter table public.push_subscriptions add column if not exists last_backup_on date;
  end if;
end $$;

-- 3. "Borrar mi cuenta" (Ajustes): cada persona puede borrar SOLO su propia cuenta.
--    Todas las tablas tienen "on delete cascade", así que se van también sus cuentas, movimientos,
--    presupuestos, pagos fijos, metas, préstamos, conversación y avisos. No se puede deshacer.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Para revisar que las tasas se están guardando todos los días:
-- select rate_date, rate_type, rate, source, fetched_at from public.exchange_rates order by rate_date desc, rate_type limit 12;
-- select status, start_time, return_message from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'fructosa-tasas') order by start_time desc limit 8;
