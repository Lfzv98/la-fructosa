-- =====================================================================
--  La Fructosa · Migración 013 (v30): comprobantes en los movimientos y lista de compras
--  Copia todo, pégalo en Supabase → SQL Editor → New query y dale a Run.
--  Idempotente: puedes correrlo de nuevo sin problema. Todo cabe en el plan gratis.
-- =====================================================================

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
  currency    text not null default 'USD' check (currency in ('USD', 'VES', 'USDT', 'EUR')),  -- texto, como en la 011
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
