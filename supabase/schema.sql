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
  -- VE = motor de tasas BCV/USDT; US = dólares; ES = euros; INT = otro país (migración 011).
  region              text not null default 'VE'
                        check (region in ('VE', 'US', 'ES', 'INT')),
  preferred_currency  public.currency_code not null default 'USD'
                        check (preferred_currency in ('USD', 'VES', 'EUR')),
  -- Tasa con la que se consolida el saldo total (BCV o Paralelo). Solo aplica en VE.
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
  insert into public.profiles (id, display_name, region, preferred_currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'region', 'VE'),
    case coalesce(new.raw_user_meta_data ->> 'region', 'VE')
      when 'ES' then 'EUR'
      when 'US' then 'USD'
      else 'USD'
    end
  );
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
-- 6. Saldos por cuenta (vista OPCIONAL).
-- La PWA NUNCA consulta account_balances, archived ni occurred_on:
-- lee accounts + transactions y calcula saldos y fechas en el cliente.
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

-- ---------------------------------------------------------------------
-- 6b. budgets (tope mensual por categoría)
-- ---------------------------------------------------------------------
create table public.budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category       text not null check (char_length(category) between 1 and 40),
  monthly_limit  numeric(20, 8) not null check (monthly_limit > 0),
  currency       public.currency_code not null default 'USD',
  created_at     timestamptz not null default now(),
  unique (user_id, category, currency)
);

create index budgets_user_idx on public.budgets (user_id);

-- ---------------------------------------------------------------------
-- 6c. recurring_expenses (gastos fijos / suscripciones)
-- ---------------------------------------------------------------------
create table public.recurring_expenses (
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

create index recurring_expenses_user_idx on public.recurring_expenses (user_id) where is_active;

-- =====================================================================
-- 7. Row Level Security
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.accounts            enable row level security;
alter table public.transactions        enable row level security;
alter table public.exchange_rates      enable row level security;
alter table public.budgets             enable row level security;
alter table public.recurring_expenses  enable row level security;

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

-- budgets: CRUD solo propias.
create policy "budgets_select_own" on public.budgets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "budgets_insert_own" on public.budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budgets_update_own" on public.budgets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budgets_delete_own" on public.budgets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- recurring_expenses: CRUD solo propias.
create policy "recurring_select_own" on public.recurring_expenses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recurring_insert_own" on public.recurring_expenses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recurring_update_own" on public.recurring_expenses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recurring_delete_own" on public.recurring_expenses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Defensa extra: el rol anónimo no toca nada.
revoke all on public.profiles, public.accounts, public.transactions, public.exchange_rates,
  public.budgets, public.recurring_expenses from anon;
revoke all on public.account_balances, public.latest_rates from anon;
revoke insert, update, delete on public.exchange_rates from authenticated;

-- ---------------------------------------------------------------------
-- 8. Enlace movimiento → pago fijo que lo generó (app 2.0)
-- ---------------------------------------------------------------------
alter table public.transactions add column recurring_id uuid;
alter table public.transactions
  add constraint transactions_recurring_fk foreign key (recurring_id, user_id)
  references public.recurring_expenses (id, user_id) on delete set null (recurring_id);
create index transactions_recurring_idx on public.transactions (recurring_id) where recurring_id is not null;
grant select, insert, update, delete on public.budgets, public.recurring_expenses to authenticated;

-- ---------------------------------------------------------------------
-- 9. Usuario para entrar (app 2.1) — igual que migrations/004_usuarios.sql
-- ---------------------------------------------------------------------
-- 1. Usuario único (sin distinguir mayúsculas) ---------------------------
alter table public.profiles add column if not exists username text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9._]{3,20}$');
  end if;
end $$;
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- 2. Alta: guarda nombre, usuario y país elegidos en la pantalla de registro.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reg text := coalesce(new.raw_user_meta_data ->> 'region', 'VE');
begin
  insert into public.profiles (id, display_name, username, region, preferred_currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    nullif(lower(new.raw_user_meta_data ->> 'username'), ''),
    reg,
    case reg when 'ES' then 'EUR'::public.currency_code else 'USD'::public.currency_code end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Login por usuario: devuelve el correo para que Supabase Auth valide la contraseña.
--    Solo responde a un usuario exacto; nunca lista ni expone datos financieros.
create or replace function public.email_for_login(p_username text)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text
  from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

-- 4. Disponibilidad del usuario mientras se escribe en el registro.
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;

revoke all on function public.email_for_login(text), public.username_available(text) from public;
-- email_for_login NO se expone (migración 006): entrar con usuario pasa por la Edge Function "login".
revoke execute on function public.email_for_login(text) from anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Metas de ahorro y préstamos (app 3.0) — igual que migrations/007_metas_prestamos.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 11. Avisos push (app 3.0) — igual que migrations/008_avisos.sql (el envío diario se programa ahí)
-- ---------------------------------------------------------------------
-- 1. Suscripciones: una fila por persona y teléfono. RLS: cada quien ve solo las suyas.
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

-- ---------------------------------------------------------------------
-- 13. Comprobantes y lista de compras (app 3.3) — igual que migrations/013_comprobantes_compras.sql
-- ---------------------------------------------------------------------

-- 1. Comprobantes ------------------------------------------------------------
--    Cada movimiento puede llevar la foto de su recibo o captura de pago.
--    La foto vive en Storage (bucket privado "comprobantes", 1 GB gratis), dentro de una
--    carpeta con el id de la persona: <user_id>/<id del movimiento>.jpg
alter table public.transactions add column if not exists receipt_path text
  check (receipt_path is null or char_length(receipt_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Cada persona solo puede ver, subir, cambiar y borrar los archivos de SU carpeta.
drop policy if exists comprobantes_select_own on storage.objects;
drop policy if exists comprobantes_insert_own on storage.objects;
drop policy if exists comprobantes_update_own on storage.objects;
drop policy if exists comprobantes_delete_own on storage.objects;
create policy comprobantes_select_own on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy comprobantes_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy comprobantes_update_own on storage.objects for update to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy comprobantes_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2. Lista de compras -------------------------------------------------------
--    No mueve dinero: al terminar la compra, la app ofrece registrar el gasto.
create table if not exists public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_name   text not null default 'Mercado' check (char_length(list_name) between 1 and 40),
  name        text not null check (char_length(name) between 1 and 80),
  qty         numeric(12, 3) not null default 1 check (qty > 0),
  price       numeric(20, 8) check (price is null or price >= 0),  -- precio por unidad (opcional)
  currency    public.currency_code not null default 'USD',
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists shopping_items_user_idx on public.shopping_items (user_id, list_name);
drop trigger if exists shopping_items_updated_at on public.shopping_items;
create trigger shopping_items_updated_at before update on public.shopping_items
  for each row execute function public.set_updated_at();

alter table public.shopping_items enable row level security;
drop policy if exists shopping_items_select_own on public.shopping_items;
drop policy if exists shopping_items_insert_own on public.shopping_items;
drop policy if exists shopping_items_update_own on public.shopping_items;
drop policy if exists shopping_items_delete_own on public.shopping_items;
create policy shopping_items_select_own on public.shopping_items for select to authenticated using ((select auth.uid()) = user_id);
create policy shopping_items_insert_own on public.shopping_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy shopping_items_update_own on public.shopping_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy shopping_items_delete_own on public.shopping_items for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.shopping_items from anon;
grant select, insert, update, delete on public.shopping_items to authenticated;

-- 3. Historial de tasas: la app ahora pide hasta un año para el gráfico.
--    El índice hace que esa consulta siga siendo rápida.
create index if not exists exchange_rates_date_idx on public.exchange_rates (rate_date);

-- Para comprobar:
-- select id, public, file_size_limit from storage.buckets where id = 'comprobantes';
-- select count(*) from public.shopping_items;
