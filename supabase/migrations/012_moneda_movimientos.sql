-- 012 · Cada movimiento toma la moneda de su cuenta si no viene (red de seguridad para transactions.currency).
-- Se puede ejecutar varias veces. Supabase → SQL Editor → New query → pegar todo → Run.
create or replace function public.tx_fill_currency()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.currency is null then
    select a.currency into new.currency from public.accounts a where a.id = new.account_id;
  end if;
  return new;
end $$;

drop trigger if exists tx_fill_currency on public.transactions;
create trigger tx_fill_currency
  before insert or update on public.transactions
  for each row execute function public.tx_fill_currency();

-- Comprobación: columnas obligatorias de transactions que no tienen valor por defecto.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'transactions'
  and is_nullable = 'NO' and column_default is null and is_generated = 'NEVER'
order by ordinal_position;
