-- =====================================================================
--  La Fructosa · Migración 007: metas de ahorro y préstamos (app 3.0)
--  Ejecutar UNA vez en Supabase > SQL Editor. Idempotente: no borra nada.
--  RLS: cada persona ve y edita solo sus datos, igual que en el resto de la app.
-- =====================================================================

-- 1. Metas de ahorro -------------------------------------------------------
create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  emoji          text,
  target_amount  numeric(20, 8) not null check (target_amount > 0),
  saved_amount   numeric(20, 8) not null default 0 check (saved_amount >= 0),
  currency       public.currency_code not null default 'USD',
  target_date    date,
  done           boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id);
drop trigger if exists savings_goals_updated_at on public.savings_goals;
create trigger savings_goals_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();

-- 2. Préstamos (lo que te deben y lo que debes) ------------------------------
create table if not exists public.loans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person       text not null check (char_length(person) between 1 and 60),
  direction    text not null check (direction in ('lent', 'borrowed')),  -- lent = le presté · borrowed = me prestó
  amount       numeric(20, 8) not null check (amount > 0),
  paid_amount  numeric(20, 8) not null default 0 check (paid_amount >= 0),
  currency     public.currency_code not null default 'USD',
  occurred_on  date not null default (now() at time zone 'America/Caracas')::date,
  due_on       date,
  settled      boolean not null default false,
  note         text check (note is null or char_length(note) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists loans_user_idx on public.loans (user_id);
drop trigger if exists loans_updated_at on public.loans;
create trigger loans_updated_at before update on public.loans
  for each row execute function public.set_updated_at();

-- 3. Row Level Security -------------------------------------------------------
alter table public.savings_goals enable row level security;
alter table public.loans enable row level security;

do $$
declare t text;
begin
  foreach t in array array['savings_goals', 'loans'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

revoke all on public.savings_goals, public.loans from anon;
grant select, insert, update, delete on public.savings_goals, public.loans to authenticated;

-- Verificación: debe mostrar las dos tablas con RLS activo (true).
select relname, relrowsecurity from pg_class where relname in ('savings_goals', 'loans');
