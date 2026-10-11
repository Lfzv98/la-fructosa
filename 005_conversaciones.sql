-- =====================================================================
--  La Fructosa · Migración 005: guardar las conversaciones con Fructosa
--  Ejecutar UNA vez en Supabase > SQL Editor. Idempotente.
--  Una fila por usuario con sus últimos mensajes. RLS: cada quien ve solo la suya.
-- =====================================================================

create table if not exists public.ai_chats (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  messages    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  -- Tope de tamaño (la app guarda como máximo los últimos 60 mensajes, sin audio).
  constraint ai_chats_size check (octet_length(messages::text) < 300000)
);

alter table public.ai_chats enable row level security;

drop policy if exists "ai_chats_select_own" on public.ai_chats;
drop policy if exists "ai_chats_insert_own" on public.ai_chats;
drop policy if exists "ai_chats_update_own" on public.ai_chats;
drop policy if exists "ai_chats_delete_own" on public.ai_chats;

create policy "ai_chats_select_own" on public.ai_chats for select to authenticated using (auth.uid() = user_id);
create policy "ai_chats_insert_own" on public.ai_chats for insert to authenticated with check (auth.uid() = user_id);
create policy "ai_chats_update_own" on public.ai_chats for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ai_chats_delete_own" on public.ai_chats for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.ai_chats to authenticated;
