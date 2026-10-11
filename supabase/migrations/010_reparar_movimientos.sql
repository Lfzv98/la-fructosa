-- 010 · Reparar el registro de movimientos (también los que propone Fructosa).
-- Se puede ejecutar varias veces sin riesgo: solo agrega lo que falte.
-- Supabase → SQL Editor → New query → pegar todo → Run.

-- 1. Columnas que la app envía al guardar un movimiento.
alter table public.transactions add column if not exists to_account_id     uuid;
alter table public.transactions add column if not exists to_amount         numeric(20, 8) check (to_amount > 0);
alter table public.transactions add column if not exists category          text;
alter table public.transactions add column if not exists description       text;
alter table public.transactions add column if not exists original_amount   numeric(20, 8) check (original_amount > 0);
alter table public.transactions add column if not exists original_currency public.currency_code;
alter table public.transactions add column if not exists rate_applied      numeric(20, 8) check (rate_applied > 0);
alter table public.transactions add column if not exists rate_bcv          numeric(20, 8) check (rate_bcv > 0);
alter table public.transactions add column if not exists rate_paralelo     numeric(20, 8) check (rate_paralelo > 0);
alter table public.transactions add column if not exists recurring_id      uuid;

-- 2. Cada persona solo puede crear movimientos propios (RLS: auth.uid() = user_id).
alter table public.transactions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_insert_own') then
    create policy "transactions_insert_own" on public.transactions
      for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
end $$;
grant select, insert, update, delete on public.transactions to authenticated;

-- 3. Que la API vea las columnas nuevas de inmediato (si no, sigue usando su copia vieja).
notify pgrst, 'reload schema';
