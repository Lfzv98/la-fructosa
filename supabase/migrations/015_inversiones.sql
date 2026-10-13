-- =====================================================================
-- La Fructosa · 015 · Inversiones (solo para las cuentas que tengan el permiso)
-- Pégalo completo en Supabase › SQL Editor y presiona Run. Se puede repetir sin problema.
--
-- 1. Agrega a profiles el permiso investments_enabled (apagado para todos).
-- 2. Impide que la app lo cambie: solo se activa desde el SQL Editor.
-- 3. Crea la tabla investments con RLS: cada quien ve solo lo suyo, y además
--    solo si tiene el permiso encendido.
-- 4. Enciende el permiso para luiszeav@gmail.com y lilianzeav@gmail.com (sin tocar contraseñas).
-- =====================================================================

-- 1. Permiso en el perfil ------------------------------------------------
alter table public.profiles add column if not exists investments_enabled boolean not null default false;

-- 2. Desde la app (roles anon y authenticated) el permiso no se puede encender ni apagar.
--    El SQL Editor y las funciones internas (rol postgres) sí pueden.
create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.investments_enabled := false;
    else
      new.investments_enabled := old.investments_enabled;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_flags on public.profiles;
create trigger profiles_protect_flags
  before insert or update on public.profiles
  for each row execute function public.protect_profile_flags();

-- ¿La persona que está usando la app tiene Inversiones? (lo usan las políticas RLS)
create or replace function public.has_investments()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.investments_enabled from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke all on function public.has_investments() from public, anon;
grant execute on function public.has_investments() to authenticated;

-- 3. Tabla de inversiones ---------------------------------------------------
create table if not exists public.investments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 60),
  kind             text not null default 'otro'
                     check (kind in ('acciones', 'fondos', 'cripto', 'plazo_fijo', 'otro')),
  invested_amount  numeric(20, 8) not null check (invested_amount > 0),
  current_value    numeric(20, 8) not null check (current_value >= 0),
  currency         text not null default 'USD'
                     check (currency in ('USD', 'VES', 'USDT', 'EUR')),
  invested_on      date not null default (now() at time zone 'America/Caracas')::date,
  note             text check (note is null or char_length(note) <= 200),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists investments_user_idx on public.investments (user_id);
drop trigger if exists investments_updated_at on public.investments;
create trigger investments_updated_at before update on public.investments
  for each row execute function public.set_updated_at();

alter table public.investments enable row level security;

drop policy if exists investments_select_own on public.investments;
drop policy if exists investments_insert_own on public.investments;
drop policy if exists investments_update_own on public.investments;
drop policy if exists investments_delete_own on public.investments;
create policy investments_select_own on public.investments for select to authenticated
  using ((select auth.uid()) = user_id and (select public.has_investments()));
create policy investments_insert_own on public.investments for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.has_investments()));
create policy investments_update_own on public.investments for update to authenticated
  using ((select auth.uid()) = user_id and (select public.has_investments()))
  with check ((select auth.uid()) = user_id and (select public.has_investments()));
create policy investments_delete_own on public.investments for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.has_investments()));

revoke all on public.investments from anon;
grant select, insert, update, delete on public.investments to authenticated;

-- 4. Encender Inversiones para Luis y Lilian -------------------------------------------
update public.profiles p
   set investments_enabled = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) in ('luiszeav@gmail.com', 'lilianzeav@gmail.com');

-- Comprobación: deben salir dos filas (Luis y Lilian), con investments_enabled = true.
select u.email, p.investments_enabled
  from public.profiles p join auth.users u on u.id = p.id
 where p.investments_enabled;
