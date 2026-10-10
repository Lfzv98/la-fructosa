-- =====================================================================
--  La Fructosa · Esquema inicial (Fase 1)
--  Proyecto Supabase NUEVO e independiente.
--  Ejecutar completo en: Supabase Dashboard > SQL Editor > New query.
--
--  Principio: cada fila de datos financieros pertenece a un usuario
--  (user_id = auth.uid()) y RLS impide que nadie más la vea o la toque.
--  La única tabla compartida es exchange_rates (tasas públicas), que
--  todos los usuarios autenticados leen y solo el service role escribe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Tipos
-- ---------------------------------------------------------------------
create type public.currency_code as enum ('USD', 'VES', 'USDT', 'EUR');

-- Tasas de referencia, todas expresadas en VES por 1 unidad de divisa.
create type public.rate_type as enum (
  'BCV_USD',    -- Dólar oficial BCV
  'BCV_EUR',    -- Euro oficial BCV
  'PARALELO',   -- Dólar paralelo / Monitor
  'USDT'        -- USDT (P2P Binance u otra fuente)
);

create type public.account_kind as enum ('cash', 'bank', 'digital', 'crypto');

create type public.transaction_type as enum ('income', 'expense', 'transfer');

-- ---------------------------------------------------------------------
-- 1. Utilidad: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. profiles (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text,
  preferred_currency  public.currency_code not null default 'USD'
                        check (preferred_currency in ('USD', 'VES')),
  -- Tasa con la que se consolida el saldo total (BCV o Paralelo).
  valuation_rate      public.rate_type not null default 'BCV_USD',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil automáticamente al registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. accounts (billeteras / cuentas multimoneda)
-- ---------------------------------------------------------------------
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 60),
  currency         public.currency_code not null,
  kind             public.account_kind not null default 'bank',
  initial_balance  numeric(20, 8) not null default 0,
  color            text,
  icon             text,
  archived         boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Permite FKs compuestas (account_id, user_id) desde transactions:
  -- así la BD garantiza que una transacción solo use cuentas de su dueño.
  unique (id, user_id)
);

create index accounts_user_idx on public.accounts (user_id) where not archived;

create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. exchange_rates (tasas de referencia, compartidas y de solo lectura)
-- ---------------------------------------------------------------------
create table public.exchange_rates (
  id          bigint generated always as identity primary key,
  rate_type   public.rate_type not null,
  rate        numeric(20, 8) not null check (rate > 0),   -- VES por 1 unidad
  rate_date   date not null default (now() at time zone 'America/Caracas')::date,
  source      text,                                       -- ej. 'bcv.org.ve', 'dolarapi'
  fetched_at  timestamptz not null default now(),
  unique (rate_type, rate_date)
);

create index exchange_rates_lookup_idx on public.exchange_rates (rate_type, rate_date desc);

-- Última tasa disponible de cada tipo.
create view public.latest_rates
with (security_invoker = true) as
select distinct on (rate_type)
  rate_type, rate, rate_date, source, fetched_at
from public.exchange_rates
order by rate_type, rate_date desc;

-- ---------------------------------------------------------------------
-- 5. transactions (ingresos, gastos, transferencias)
-- ---------------------------------------------------------------------
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type             public.transaction_type not null,
  account_id       uuid not null,
  -- Monto que sale/entra de account_id, en la moneda de esa cuenta.
  amount           numeric(20, 8) not null check (amount > 0),

  -- Solo transferencias: cuenta destino y monto recibido en su moneda.
  to_account_id    uuid,
  to_amount        numeric(20, 8) check (to_amount > 0),

  category         text,
  description      text,
  occurred_on      date not null default (now() at time zone 'America/Caracas')::date,

  -- Calculadora de brecha: lo que se pagó realmente en el comercio
  -- (ej. 3.650 VES) cuando difiere de la moneda de la cuenta (ej. USD).
  original_amount    numeric(20, 8) check (original_amount > 0),
  original_currency  public.currency_code,
  rate_applied       numeric(20, 8) check (rate_applied > 0),  -- VES por unidad de la cuenta usada
  rate_bcv           numeric(20, 8) check (rate_bcv > 0),      -- snapshot BCV del día
  rate_paralelo      numeric(20, 8) check (rate_paralelo > 0), -- snapshot Paralelo/USDT del día

  -- Valor en USD del pago en VES según cada tasa, y la brecha entre ambos.
  usd_at_bcv       numeric(20, 8) generated always as (
                     case when original_currency = 'VES' then original_amount / rate_bcv end
                   ) stored,
  usd_at_paralelo  numeric(20, 8) generated always as (
                     case when original_currency = 'VES' then original_amount / rate_paralelo end
                   ) stored,
  spread_usd       numeric(20, 8) generated always as (
                     case when original_currency = 'VES'
                          then original_amount / rate_bcv - original_amount / rate_paralelo end
                   ) stored,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Integridad de propiedad: ambas cuentas deben ser del mismo user_id.
  foreign key (account_id, user_id)    references public.accounts (id, user_id) on delete cascade,
  foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete cascade,

  constraint transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_amount is not null and to_account_id <> account_id)
    or
    (type <> 'transfer' and to_account_id is null and to_amount is null)
  ),
  constraint original_shape check (
    (original_amount is null and original_currency is null)
    or (original_amount is not null and original_currency is not null)
  )
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc, created_at desc);
create index transactions_account_idx   on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id) where to_account_id is not null;

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Saldos por cuenta (vista que respeta RLS del usuario que consulta)
-- ---------------------------------------------------------------------
create view public.account_balances
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.currency,
  a.kind,
  a.color,
  a.icon,
  a.archived,
  a.sort_order,
  a.initial_balance
    + coalesce((select sum(case t.type when 'income' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id), 0)
    + coalesce((select sum(t.to_amount)
                from public.transactions t where t.to_account_id = a.id), 0)
    as balance
from public.accounts a;

-- =====================================================================
-- 7. Row Level Security
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.accounts       enable row level security;
alter table public.transactions   enable row level security;
alter table public.exchange_rates enable row level security;

-- profiles: cada quien ve y edita solo su perfil (lo crea el trigger).
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- accounts: CRUD solo sobre las propias.
create policy "accounts_select_own" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "accounts_insert_own" on public.accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accounts_update_own" on public.accounts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accounts_delete_own" on public.accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- transactions: CRUD solo sobre las propias.
create policy "transactions_select_own" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions_update_own" on public.transactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- exchange_rates: lectura para autenticados; sin políticas de escritura,
-- así que solo el service role (Edge Function / cron) puede escribir.
create policy "exchange_rates_read_authenticated" on public.exchange_rates
  for select to authenticated using (true);

-- Defensa extra: el rol anónimo no toca nada.
revoke all on public.profiles, public.accounts, public.transactions, public.exchange_rates from anon;
revoke all on public.account_balances, public.latest_rates from anon;
revoke insert, update, delete on public.exchange_rates from authenticated;
