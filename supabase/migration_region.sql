-- La Fructosa · Región y moneda base del perfil
-- Ejecutar en un proyecto ya creado. No altera las políticas RLS:
-- profiles sigue siendo solo (select auth.uid()) = id.

alter table public.profiles
  add column if not exists region text not null default 'VE';

alter table public.profiles drop constraint if exists profiles_region_check;
alter table public.profiles
  add constraint profiles_region_check check (region in ('VE', 'US', 'ES'));

alter table public.profiles drop constraint if exists profiles_preferred_currency_check;
alter table public.profiles
  add constraint profiles_preferred_currency_check
  check (preferred_currency in ('USD', 'VES', 'EUR'));

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

-- RLS vigente (sin cambios): cada perfil es solo del dueño.
-- profiles_select_own: using ((select auth.uid()) = id)
-- profiles_update_own: using / with check ((select auth.uid()) = id)
