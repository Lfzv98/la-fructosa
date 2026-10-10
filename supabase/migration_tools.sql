-- La Fructosa · Herramientas (presupuestos y recurrentes)
-- Ejecutar en un proyecto ya creado si schema.sql inicial ya corrió.

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

alter table public.budgets enable row level security;
alter table public.recurring_expenses enable row level security;

drop policy if exists "budgets_select_own" on public.budgets;
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_own" on public.budgets;
drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_select_own" on public.budgets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "budgets_insert_own" on public.budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "budgets_update_own" on public.budgets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "budgets_delete_own" on public.budgets
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "recurring_select_own" on public.recurring_expenses;
drop policy if exists "recurring_insert_own" on public.recurring_expenses;
drop policy if exists "recurring_update_own" on public.recurring_expenses;
drop policy if exists "recurring_delete_own" on public.recurring_expenses;
create policy "recurring_select_own" on public.recurring_expenses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recurring_insert_own" on public.recurring_expenses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recurring_update_own" on public.recurring_expenses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recurring_delete_own" on public.recurring_expenses
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.budgets, public.recurring_expenses from anon;
