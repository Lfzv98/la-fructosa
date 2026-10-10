-- Vista opcional de saldos. La PWA ya calcula el saldo en el cliente
-- desde public.accounts + public.transactions (RLS: auth.uid() = user_id).
-- Ejecutar en Supabase SQL Editor si quieres la vista en el dashboard.

create or replace view public.account_balances
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

grant select on public.account_balances to authenticated;
revoke all on public.account_balances from anon;
