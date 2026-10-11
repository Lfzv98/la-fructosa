-- =====================================================================
--  La Fructosa · 011 · Verificación y alineación de la base de datos (app v23)
--
--  Supabase → SQL Editor → New query → pega TODO este archivo → Run.
--  Se puede ejecutar cuantas veces quieras: solo agrega lo que falte y nunca borra datos.
--  Funciona tanto si tus monedas son texto como si usan el tipo currency_code.
--
--  Al final aparece una tabla "reporte" (abajo, en Results): cada fila debe decir OK.
--  Si alguna dice REVISAR, copia esa fila y compártela.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Utilidad: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Tablas que la app usa (se crean solo si no existen; monedas como texto)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text,
  username           text,
  region             text not null default 'VE',
  preferred_currency text not null default 'USD',
  valuation_rate     text not null default 'BCV_USD',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 60),
  currency         text not null,
  kind             text not null default 'bank',
  initial_balance  numeric(20, 8) not null default 0,
  color            text,
  icon             text,
  archived         boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.exchange_rates (
  id          bigint generated always as identity primary key,
  rate_type   text not null,
  rate        numeric(20, 8) not null check (rate > 0),
  rate_date   date not null default (now() at time zone 'America/Caracas')::date,
  source      text,
  fetched_at  timestamptz not null default now()
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null,
  account_id  uuid not null references public.accounts (id) on delete cascade,
  amount      numeric(20, 8) not null check (amount > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category       text not null check (char_length(category) between 1 and 40),
  monthly_limit  numeric(20, 8) not null check (monthly_limit > 0),
  currency       text not null default 'USD',
  created_at     timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  amount      numeric(20, 8) not null check (amount > 0),
  currency    text not null default 'USD',
  category    text,
  due_day     int not null check (due_day between 1 and 31),
  account_id  uuid references public.accounts (id) on delete cascade,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  emoji          text,
  target_amount  numeric(20, 8) not null check (target_amount > 0),
  saved_amount   numeric(20, 8) not null default 0 check (saved_amount >= 0),
  currency       text not null default 'USD',
  target_date    date,
  done           boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.loans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person       text not null check (char_length(person) between 1 and 60),
  direction    text not null check (direction in ('lent', 'borrowed')),
  amount       numeric(20, 8) not null check (amount > 0),
  paid_amount  numeric(20, 8) not null default 0 check (paid_amount >= 0),
  currency     text not null default 'USD',
  occurred_on  date not null default (now() at time zone 'America/Caracas')::date,
  due_on       date,
  settled      boolean not null default false,
  note         text check (note is null or char_length(note) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint      text not null check (char_length(endpoint) < 1000),
  p256dh        text not null,
  auth          text not null,
  prefs         jsonb not null default '{"bills": true, "loans": true, "rates": false}'::jsonb,
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz,
  last_backup_on date
);

create table if not exists public.ai_chats (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  messages    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Columnas que la app envía o lee (se agregan solo si faltan)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists display_name       text;
alter table public.profiles add column if not exists username           text;
alter table public.profiles add column if not exists region             text not null default 'VE';
alter table public.profiles add column if not exists preferred_currency text not null default 'USD';
alter table public.profiles add column if not exists valuation_rate     text not null default 'BCV_USD';
alter table public.profiles add column if not exists created_at         timestamptz not null default now();
alter table public.profiles add column if not exists updated_at         timestamptz not null default now();

alter table public.accounts add column if not exists currency        text not null default 'USD';
alter table public.accounts add column if not exists kind            text not null default 'bank';
alter table public.accounts add column if not exists initial_balance numeric(20, 8) not null default 0;
alter table public.accounts add column if not exists color           text;
alter table public.accounts add column if not exists icon            text;
alter table public.accounts add column if not exists archived        boolean not null default false;
alter table public.accounts add column if not exists sort_order      int not null default 0;
alter table public.accounts add column if not exists created_at      timestamptz not null default now();
alter table public.accounts add column if not exists updated_at      timestamptz not null default now();

alter table public.transactions add column if not exists to_account_id     uuid;
alter table public.transactions add column if not exists to_amount         numeric(20, 8);
alter table public.transactions add column if not exists category          text;
alter table public.transactions add column if not exists description       text;
alter table public.transactions add column if not exists original_amount   numeric(20, 8);
alter table public.transactions add column if not exists original_currency text;
alter table public.transactions add column if not exists rate_applied      numeric(20, 8);
alter table public.transactions add column if not exists rate_bcv          numeric(20, 8);
alter table public.transactions add column if not exists rate_paralelo     numeric(20, 8);
alter table public.transactions add column if not exists recurring_id      uuid;
alter table public.transactions add column if not exists created_at        timestamptz not null default now();
alter table public.transactions add column if not exists updated_at        timestamptz not null default now();

-- Fecha del movimiento: si falta, se crea y se llena con la fecha que ya tenga cada fila
-- (transaction_date o created_at), para que ningún movimiento viejo aparezca como "hoy".
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'transactions' and column_name = 'occurred_on') then
    alter table public.transactions add column occurred_on date;
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'transactions' and column_name = 'transaction_date') then
      execute 'update public.transactions set occurred_on = transaction_date::date where occurred_on is null';
    end if;
    update public.transactions set occurred_on = (created_at at time zone 'America/Caracas')::date where occurred_on is null;
    alter table public.transactions alter column occurred_on set default (now() at time zone 'America/Caracas')::date;
    alter table public.transactions alter column occurred_on set not null;
  end if;
  -- Si existe una columna vieja transaction_date obligatoria, que tome la fecha de hoy por defecto
  -- (la app guarda la fecha en occurred_on).
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'transactions' and column_name = 'transaction_date'
               and is_nullable = 'NO' and column_default is null) then
    alter table public.transactions alter column transaction_date set default now();
  end if;
end $$;

-- Brecha guardada por movimiento (la usa el respaldo en Excel).
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'transactions' and column_name = 'spread_usd') then
    alter table public.transactions add column spread_usd numeric(20, 8) generated always as (
      case when original_currency = 'VES' and rate_bcv > 0 and rate_paralelo > 0
           then original_amount / rate_bcv - original_amount / rate_paralelo end
    ) stored;
  end if;
exception when others then
  raise notice 'spread_usd no se pudo crear (no es necesario para usar la app): %', sqlerrm;
end $$;

alter table public.exchange_rates add column if not exists source     text;
alter table public.exchange_rates add column if not exists fetched_at timestamptz not null default now();

alter table public.budgets add column if not exists currency text not null default 'USD';

alter table public.recurring_expenses add column if not exists currency  text not null default 'USD';
alter table public.recurring_expenses add column if not exists category  text;
alter table public.recurring_expenses add column if not exists is_active boolean not null default true;

alter table public.savings_goals add column if not exists emoji        text;
alter table public.savings_goals add column if not exists saved_amount numeric(20, 8) not null default 0;
alter table public.savings_goals add column if not exists target_date  date;
alter table public.savings_goals add column if not exists done         boolean not null default false;
alter table public.savings_goals add column if not exists updated_at   timestamptz not null default now();

alter table public.loans add column if not exists paid_amount numeric(20, 8) not null default 0;
alter table public.loans add column if not exists due_on      date;
alter table public.loans add column if not exists settled     boolean not null default false;
alter table public.loans add column if not exists note        text;
alter table public.loans add column if not exists updated_at  timestamptz not null default now();

alter table public.push_subscriptions add column if not exists prefs          jsonb not null default '{"bills": true, "loans": true, "rates": false}'::jsonb;
alter table public.push_subscriptions add column if not exists last_sent_at   timestamptz;
alter table public.push_subscriptions add column if not exists last_backup_on date;

-- ---------------------------------------------------------------------
-- 3. Reglas de datos (países, monedas, usuario). Las nuevas reglas se aplican a lo que
--    se guarde desde ahora; no tocan ni rechazan filas viejas (NOT VALID).
-- ---------------------------------------------------------------------
do $$
declare c record;
begin
  -- País: VE, US, ES y ahora INT ("Otro país").
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%region%' loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
  alter table public.profiles add constraint profiles_region_check
    check (region in ('VE', 'US', 'ES', 'INT')) not valid;

  -- Moneda principal: USD, VES o EUR.
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%preferred_currency%' loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
  alter table public.profiles add constraint profiles_preferred_currency_check
    check (preferred_currency::text in ('USD', 'VES', 'EUR')) not valid;

  -- Usuario: minúsculas, números, punto y guion bajo.
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9._]{3,20}$') not valid;
  end if;

  -- Monedas de las cuentas y demás tablas: USD, VES, USDT o EUR.
  if not exists (select 1 from pg_constraint where conname = 'accounts_currency_valid') then
    alter table public.accounts add constraint accounts_currency_valid
      check (currency::text in ('USD', 'VES', 'USDT', 'EUR')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_original_currency_valid') then
    alter table public.transactions add constraint transactions_original_currency_valid
      check (original_currency is null or original_currency::text in ('USD', 'VES', 'USDT', 'EUR')) not valid;
  end if;
end $$;

-- Usuario único sin distinguir mayúsculas.
do $$
begin
  create unique index if not exists profiles_username_key on public.profiles (lower(username));
exception when others then
  raise notice 'Hay usuarios repetidos; el índice único no se creó: %', sqlerrm;
end $$;

-- Una tasa por tipo y día (la función update-rates actualiza sobre esta clave).
do $$
begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.exchange_rates'::regclass and i.indisunique
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
           where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['rate_date', 'rate_type']
  ) then
    create unique index exchange_rates_type_date_key on public.exchange_rates (rate_type, rate_date);
  end if;
exception when others then
  raise notice 'Hay tasas repetidas por día; el índice único no se creó: %', sqlerrm;
end $$;

-- Índices para que la app cargue rápido.
create index if not exists accounts_user_idx2           on public.accounts (user_id);
create index if not exists transactions_user_idx2       on public.transactions (user_id);
create index if not exists budgets_user_idx             on public.budgets (user_id);
create index if not exists recurring_expenses_user_idx2 on public.recurring_expenses (user_id);
create index if not exists savings_goals_user_idx       on public.savings_goals (user_id);
create index if not exists loans_user_idx               on public.loans (user_id);
create index if not exists exchange_rates_lookup_idx2   on public.exchange_rates (rate_type, rate_date desc);

-- updated_at automático donde exista la columna.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'accounts', 'transactions', 'savings_goals', 'loans'] loop
    if not exists (select 1 from pg_trigger where tgrelid = format('public.%I', t)::regclass and tgname = t || '_updated_at') then
      execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Alta de usuarios: crea el perfil con nombre, usuario y país.
--    Si algo fallara aquí, el registro NO se bloquea: la app completa el perfil al entrar.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  reg text := coalesce(new.raw_user_meta_data ->> 'region', 'VE');
begin
  if reg not in ('VE', 'US', 'ES', 'INT') then reg := 'VE'; end if;
  begin
    insert into public.profiles (id, display_name, username, region)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
      nullif(lower(new.raw_user_meta_data ->> 'username'), ''),
      reg
    )
    on conflict (id) do nothing;
    if reg = 'ES' then
      update public.profiles set preferred_currency = 'EUR' where id = new.id;
    end if;
  exception when others then
    raise warning 'handle_new_user: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Disponibilidad del usuario (pantalla de registro).
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Entrar con usuario: solo la Edge Function "login" (service role) puede consultar el correo.
create or replace function public.email_for_login(p_username text)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text
  from public.profiles p join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;
revoke execute on function public.email_for_login(text) from public, anon, authenticated;

-- Borrar mi cuenta (Ajustes): cada persona borra SOLO la suya.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Row Level Security: cada persona ve y toca SOLO sus filas (auth.uid() = dueño).
-- ---------------------------------------------------------------------
do $$
declare
  t text; col text; p record;
  owned text[] := array['profiles', 'accounts', 'transactions', 'budgets', 'recurring_expenses',
                        'savings_goals', 'loans', 'push_subscriptions', 'ai_chats'];
  pref text;
begin
  foreach t in array owned loop
    col := case t when 'profiles' then 'id' else 'user_id' end;
    pref := case t when 'recurring_expenses' then 'recurring' when 'push_subscriptions' then 'push' else t end;
    execute format('alter table public.%I enable row level security', t);

    -- Seguridad: se eliminan políticas que no filtren por auth.uid() (dejarían ver datos ajenos).
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = t
               and coalesce(qual, '') || coalesce(with_check, '') not ilike '%auth.uid()%' loop
      execute format('drop policy %I on public.%I', p.policyname, t);
      raise notice 'Política insegura eliminada en %: %', t, p.policyname;
    end loop;

    execute format('drop policy if exists %I on public.%I', pref || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', pref || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', pref || '_update_own', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = %I)', pref || '_select_own', t, col);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = %I)', pref || '_insert_own', t, col);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)', pref || '_update_own', t, col, col);
    if t <> 'profiles' then
      execute format('drop policy if exists %I on public.%I', pref || '_delete_own', t);
      execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = %I)', pref || '_delete_own', t, col);
    end if;

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  -- Tasas: públicas para leer (con sesión); solo el servidor (service role) escribe.
  alter table public.exchange_rates enable row level security;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'exchange_rates' and cmd <> 'SELECT' loop
    execute format('drop policy %I on public.exchange_rates', p.policyname);
  end loop;
  drop policy if exists "exchange_rates_read_authenticated" on public.exchange_rates;
  create policy "exchange_rates_read_authenticated" on public.exchange_rates for select to authenticated using (true);
  revoke all on public.exchange_rates from anon;
  revoke insert, update, delete on public.exchange_rates from authenticated;
  grant select on public.exchange_rates to authenticated;
end $$;

-- Que la API vea los cambios de inmediato.
notify pgrst, 'reload schema';

-- =====================================================================
-- 6. REPORTE: todo debe decir OK
-- =====================================================================
create temp table if not exists _fructosa_reporte (orden int, revision text, estado text, detalle text);
truncate _fructosa_reporte;

do $$
declare
  t text; c text; n int; ok boolean; i int := 0; det text;
  owned text[] := array['profiles', 'accounts', 'transactions', 'budgets', 'recurring_expenses',
                        'savings_goals', 'loans', 'push_subscriptions', 'ai_chats'];
  cols jsonb := '{
    "profiles": ["id","display_name","username","region","preferred_currency","valuation_rate"],
    "accounts": ["id","user_id","name","currency","kind","initial_balance","color","icon","archived","sort_order","created_at"],
    "transactions": ["id","user_id","type","account_id","amount","to_account_id","to_amount","category","description","occurred_on","original_amount","original_currency","rate_applied","rate_bcv","rate_paralelo","recurring_id","created_at"],
    "exchange_rates": ["rate_type","rate","rate_date","source","fetched_at"],
    "budgets": ["id","user_id","category","monthly_limit","currency"],
    "recurring_expenses": ["id","user_id","name","amount","currency","category","due_day","account_id","is_active"],
    "savings_goals": ["id","user_id","name","emoji","target_amount","saved_amount","currency","target_date","done"],
    "loans": ["id","user_id","person","direction","amount","paid_amount","currency","occurred_on","due_on","settled","note"],
    "push_subscriptions": ["id","user_id","endpoint","p256dh","auth","prefs","last_backup_on"],
    "ai_chats": ["user_id","messages","updated_at"]
  }';
  -- Columnas que la app envía al guardar (las demás obligatorias deben tener valor por defecto).
  sent jsonb := '{
    "profiles": ["id","display_name","username","region","preferred_currency","valuation_rate"],
    "accounts": ["user_id","name","currency","kind","initial_balance","color","icon","sort_order","archived"],
    "transactions": ["user_id","type","account_id","amount","to_account_id","to_amount","category","description","occurred_on","original_amount","original_currency","rate_applied","rate_bcv","rate_paralelo","recurring_id"],
    "budgets": ["user_id","category","monthly_limit","currency"],
    "recurring_expenses": ["user_id","name","amount","currency","category","due_day","account_id","is_active"],
    "savings_goals": ["user_id","name","emoji","target_amount","saved_amount","currency","target_date","done"],
    "loans": ["user_id","person","direction","amount","paid_amount","currency","occurred_on","due_on","settled","note"],
    "push_subscriptions": ["user_id","endpoint","p256dh","auth","prefs"],
    "ai_chats": ["user_id","messages","updated_at"]
  }';
begin
  -- Columnas
  for t in select jsonb_object_keys(cols) loop
    select string_agg(x, ', ') into det
    from jsonb_array_elements_text(cols -> t) x
    where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = t and column_name = x);
    i := i + 1;
    insert into _fructosa_reporte values (i, 'Columnas de ' || t, case when det is null then 'OK' else 'REVISAR' end,
      coalesce('Faltan: ' || det, 'Todas presentes'));
  end loop;

  -- Columnas obligatorias sin valor por defecto que la app no envía (harían fallar el guardado)
  for t in select jsonb_object_keys(sent) loop
    select string_agg(column_name::text, ', ') into det
    from information_schema.columns
    where table_schema = 'public' and table_name = t and is_nullable = 'NO' and column_default is null
      and is_generated = 'NEVER' and is_identity = 'NO'
      and column_name::text not in (select jsonb_array_elements_text(sent -> t)) and column_name not in ('id');
    i := i + 1;
    insert into _fructosa_reporte values (i, 'Guardar en ' || t, case when det is null then 'OK' else 'REVISAR' end,
      coalesce('Obligatorias sin valor por defecto: ' || det, 'La app puede guardar sin problema'));
  end loop;

  -- RLS y políticas
  foreach t in array owned || array['exchange_rates'] loop
    select relrowsecurity into ok from pg_class where oid = format('public.%I', t)::regclass;
    select count(*) into n from pg_policies where schemaname = 'public' and tablename = t;
    i := i + 1;
    insert into _fructosa_reporte values (i, 'RLS activo en ' || t, case when ok and n > 0 then 'OK' else 'REVISAR' end,
      n || ' políticas');
  end loop;

  select string_agg(tablename || '.' || policyname, ', ') into det from pg_policies
  where schemaname = 'public' and tablename = any (owned)
    and coalesce(qual, '') || coalesce(with_check, '') not ilike '%auth.uid()%';
  i := i + 1;
  insert into _fructosa_reporte values (i, 'Privacidad: nadie ve datos ajenos', case when det is null then 'OK' else 'REVISAR' end,
    coalesce('Políticas sin auth.uid(): ' || det, 'Todas las políticas filtran por auth.uid()'));

  select string_agg(distinct table_name::text, ', ') into det from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon' and table_name::text = any (owned || array['exchange_rates']);
  i := i + 1;
  insert into _fructosa_reporte values (i, 'Sin acceso anónimo a tablas', case when det is null then 'OK' else 'REVISAR' end,
    coalesce('anon tiene permisos en: ' || det, 'anon no toca ninguna tabla'));

  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'exchange_rates' and cmd <> 'SELECT';
  i := i + 1;
  insert into _fructosa_reporte values (i, 'Tasas: solo lectura para usuarios', case when n = 0 then 'OK' else 'REVISAR' end,
    case when n = 0 then 'Solo el servidor escribe tasas' else n || ' políticas de escritura' end);

  -- Países y funciones
  select pg_get_constraintdef(oid) into det from pg_constraint where conname = 'profiles_region_check';
  i := i + 1;
  insert into _fructosa_reporte values (i, 'Países permitidos (VE, US, ES, INT)', case when det ilike '%INT%' then 'OK' else 'REVISAR' end, coalesce(det, 'sin regla'));

  i := i + 1;
  insert into _fructosa_reporte values (i, 'Alta de usuarios (trigger)',
    case when exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass) then 'OK' else 'REVISAR' end,
    'Crea el perfil al registrarse');

  i := i + 1;
  insert into _fructosa_reporte values (i, 'Funciones de la app',
    case when to_regprocedure('public.username_available(text)') is not null
          and to_regprocedure('public.delete_my_account()') is not null
          and to_regprocedure('public.email_for_login(text)') is not null then 'OK' else 'REVISAR' end,
    'username_available, delete_my_account, email_for_login');

  i := i + 1;
  insert into _fructosa_reporte values (i, 'Correos protegidos al entrar',
    case when not has_function_privilege('anon', 'public.email_for_login(text)', 'execute')
          and not has_function_privilege('authenticated', 'public.email_for_login(text)', 'execute') then 'OK' else 'REVISAR' end,
    'Solo la función login del servidor consulta correos');

  -- Tasas de hoy (informativo: dependen de la función update-rates y del cron)
  select string_agg(rate_type::text || ' ' || to_char(d, 'DD/MM'), ', ' order by rate_type::text) into det
  from (select rate_type, max(rate_date) d from public.exchange_rates group by rate_type) x;
  select count(*) into n from public.exchange_rates where rate_date >= (now() at time zone 'America/Caracas')::date - 2;
  i := i + 1;
  insert into _fructosa_reporte values (i, 'Tasas recientes (últimos 2 días)', case when n > 0 then 'OK' else 'REVISAR' end,
    coalesce('Última por tipo: ' || det, 'No hay tasas guardadas'));

  if to_regclass('cron.job') is not null then
    execute 'select count(*) from cron.job where jobname = ''fructosa-tasas''' into n;
    i := i + 1;
    insert into _fructosa_reporte values (i, 'Tasas automáticas (cron)', case when n > 0 then 'OK' else 'REVISAR' end,
      case when n > 0 then 'fructosa-tasas programado' else 'Falta ejecutar la migración 003' end);
  end if;
end $$;

select revision, estado, detalle from _fructosa_reporte order by (estado = 'OK'), orden;
