-- =====================================================================
--  La Fructosa · Migración 004: entrar con nombre de usuario (app 2.1)
--  Ejecutar UNA vez en Supabase > SQL Editor (después de la 002).
--  Idempotente. Las cuentas existentes eligen usuario y país al entrar.
-- =====================================================================

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
grant execute on function public.email_for_login(text), public.username_available(text) to anon, authenticated;

-- Verificación: debe mostrar la columna username.
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'username';
