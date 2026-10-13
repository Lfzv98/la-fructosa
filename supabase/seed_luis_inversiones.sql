-- =====================================================================
-- La Fructosa · Datos de Luis (luiszeav@gmail.com): ETFs de Folionet y saldos de bancos
-- Pégalo completo en Supabase › SQL Editor y presiona Run. Va DESPUÉS de 015_inversiones.sql.
-- Se puede repetir: no duplica nada (salta inversiones con el mismo nombre y cuentas que ya existan).
--
-- Inversiones (Folionet, 12/10/2026): el número "+3.28" de la captura se toma como cantidad de acciones.
--   Invertido   = acciones × precio promedio
--   Valor actual = acciones × último precio
-- =====================================================================

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = 'luiszeav@gmail.com';
  if uid is null then raise exception 'No existe la cuenta luiszeav@gmail.com'; end if;
  if not coalesce((select investments_enabled from public.profiles where id = uid), false) then
    raise exception 'Primero corre 015_inversiones.sql (la cuenta aún no tiene Inversiones)';
  end if;

  -- 1. ETFs en Folionet (USD) -------------------------------------------------
  insert into public.investments (user_id, name, kind, currency, invested_amount, current_value, note)
  select uid, v.name, 'fondos', 'USD', round(v.shares * v.avg, 2), round(v.shares * v.last, 2), v.note
    from (values
      ('GPIQ · Folionet', 3.28, 48.82, 57.89, 'ETF · Goldman Sachs Nasdaq-100 Premium Income · 3.28 acciones'),
      ('JEPQ · Folionet', 1.10, 56.05, 60.93, 'ETF · J.P. Morgan Nasdaq Equity Premium Income · 1.10 acciones'),
      ('SCHB · Folionet', 2.32, 23.15, 29.88, 'ETF · Schwab U.S. Broad Market · 2.32 acciones'),
      ('SCHD · Folionet', 5.46, 27.17, 33.27, 'ETF · Schwab US Dividend Equity · 5.46 acciones'),
      ('SPYM · Folionet', 1.01, 77.35, 91.57, 'ETF · SPDR Portfolio S&P 500 · 1.01 acciones')
    ) as v(name, shares, avg, last, note)
   where not exists (select 1 from public.investments i where i.user_id = uid and lower(i.name) = lower(v.name));

  -- 2. Cuentas: solo si no tienes ya una de ese banco en esa moneda ----------------
  --    El saldo de hoy entra como saldo inicial de la cuenta nueva.
  insert into public.accounts (user_id, name, currency, kind, initial_balance, icon, color, sort_order)
  select uid, v.name, v.currency, v.kind, v.balance, v.icon, v.color, v.ord
    from (values
      ('BNC Bs',           'VES',  'bank',   957.50, '🏦', '#A0C4FF', 20, 'bnc'),
      ('BNC $',            'USD',  'bank',     0.92, '🏦', '#CAFFBF', 21, 'bnc'),
      ('Binance',          'USDT', 'crypto',  76.95, '🪙', '#FDFFB6', 22, 'binance'),
      ('Bank of America',  'USD',  'bank',   122.58, '🏦', '#FFADAD', 23, 'america|bofa')
    ) as v(name, currency, kind, balance, icon, color, ord, pattern)
   where not exists (
     select 1 from public.accounts a
      where a.user_id = uid and not a.archived and a.currency::text = v.currency
        and lower(a.name) ~ v.pattern);
end $$;

-- Comprobación ------------------------------------------------------------------
select 'inversión' as tipo, i.name as nombre, i.currency::text as moneda,
       i.invested_amount as invertido, i.current_value as valor_actual,
       round(i.current_value - i.invested_amount, 2) as ganancia
  from public.investments i join auth.users u on u.id = i.user_id
 where lower(u.email) = 'luiszeav@gmail.com'
union all
select 'cuenta', a.name, a.currency::text, a.initial_balance, null, null
  from public.accounts a join auth.users u on u.id = a.user_id
 where lower(u.email) = 'luiszeav@gmail.com' and not a.archived
   and lower(a.name) ~ 'bnc|binance|america|bofa'
order by 1 desc, 2;
