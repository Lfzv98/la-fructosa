-- =====================================================================
--  La Fructosa · Migración 002 (versión 2.0 de la app)
--  Ejecutar UNA vez en Supabase > SQL Editor sobre tu base actual.
--  Es idempotente: si algo ya existe, lo deja como está.
--  No borra datos. Mantiene la regla de oro: RLS auth.uid() = user_id.
-- =====================================================================

-- 1. Perfil: región (VE/US/ES) y euro como moneda principal ------------
alter table public.profiles add column if not exists region text not null default 'VE';
do $$ begin
  alter table public.profiles drop constraint if exists profiles_region_check;
  alter table public.profiles add constraint profiles_region_check check (region in ('VE', 'US', 'ES'));
  alter table public.profiles drop constraint if exists profiles_preferred_currency_check;
  alter table public.profiles add constraint profiles_preferred_currency_check check (preferred_currency in ('USD', 'VES', 'EUR'));
end $$;

-- El registro guarda nombre y región elegidos en la pantalla de alta.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, region, preferred_currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'region', 'VE'),
    case coalesce(new.raw_user_meta_data ->> 'region', 'VE') when 'ES' then 'EUR'::public.currency_code else 'USD'::public.currency_code end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 2. Cuentas: columnas que usa la app (por si tu base viene de otra versión)
alter table public.accounts add column if not exists color text;
alter table public.accounts add column if not exists icon text;
alter table public.accounts add column if not exists archived boolean not null default false;
alter table public.accounts add column if not exists sort_order int not null default 0;

-- 3. Presupuestos ------------------------------------------------------
create table if not exists public.budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category       text not null check (char_length(category) between 1 and 40),
  monthly_limit  numeric(20, 8) not null check (monthly_limit > 0),
  currency       public.currency_code not null default 'USD',
  created_at     timestamptz not null default now(),
  unique (user_id, category, currency)
);
create index if not exists budgets_user_idx on public.budgets (user_id);

-- 4. Pagos fijos -------------------------------------------------------
create table if not exists public.recurring_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  amount      numeric(20, 8) not null check (amount > 0),
  currency    public.currency_code not null,
  category    text,
  due_day     int not null check (due_day between 1 and 31),
  account_id  uuid not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);
create index if not exists recurring_expenses_user_idx on public.recurring_expenses (user_id) where is_active;

-- 5. Movimientos: enlace al pago fijo que los generó --------------------
alter table public.transactions add column if not exists recurring_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_recurring_fk') then
    alter table public.transactions
      add constraint transactions_recurring_fk foreign key (recurring_id, user_id)
      references public.recurring_expenses (id, user_id) on delete set null (recurring_id);
  end if;
end $$;
create index if not exists transactions_recurring_idx on public.transactions (recurring_id) where recurring_id is not null;

-- 6. RLS: cada quien solo lo suyo (también en las tablas nuevas) --------
alter table public.budgets            enable row level security;
alter table public.recurring_expenses enable row level security;

drop policy if exists "budgets_select_own" on public.budgets;
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_own" on public.budgets;
drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_select_own" on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy "budgets_insert_own" on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budgets_update_own" on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budgets_delete_own" on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "recurring_select_own" on public.recurring_expenses;
drop policy if exists "recurring_insert_own" on public.recurring_expenses;
drop policy if exists "recurring_update_own" on public.recurring_expenses;
drop policy if exists "recurring_delete_own" on public.recurring_expenses;
create policy "recurring_select_own" on public.recurring_expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy "recurring_insert_own" on public.recurring_expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recurring_update_own" on public.recurring_expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recurring_delete_own" on public.recurring_expenses for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.budgets, public.recurring_expenses from anon;
grant select, insert, update, delete on public.budgets, public.recurring_expenses to authenticated;

-- 7. Verificación rápida: debe listar 6 tablas con rls = true ----------
select relname as tabla, relrowsecurity as rls
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles', 'accounts', 'transactions', 'exchange_rates', 'budgets', 'recurring_expenses')
order by relname;
