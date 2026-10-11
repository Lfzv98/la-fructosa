// Estado global: carga los datos una vez, calcula saldos y estadísticas,
// y expone acciones que actualizan la BD y la interfaz al instante.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, isDemo } from './api.js';
import { fetchLiveRates } from './rates.js';
import { REGIONS, ACCOUNT_TEMPLATES, ACCOUNT_COLORS, KINDS, convert, consolidate, todayISO, monthKey } from './money.js';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

// Fecha de un movimiento, tolerante a esquemas anteriores.
export const txDate = (t) => (t.occurred_on || t.transaction_date || t.created_at || todayISO()).slice(0, 10);

// Preferencias locales del dispositivo (no son datos financieros).
export function usePref(key, initial) {
  const k = 'fructosa-pref-' + key;
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(k); return s == null ? initial : JSON.parse(s); } catch { return initial; }
  });
  const set = useCallback((nv) => {
    setV((old) => {
      const val = typeof nv === 'function' ? nv(old) : nv;
      queueMicrotask(() => {
        try { localStorage.setItem(k, JSON.stringify(val)); } catch { /* nada */ }
        window.dispatchEvent(new CustomEvent('fructosa-pref', { detail: { k, val } }));
      });
      return val;
    });
  }, [k]);
  useEffect(() => {
    const on = (e) => { if (e.detail.k === k) setV(e.detail.val); };
    window.addEventListener('fructosa-pref', on);
    return () => window.removeEventListener('fructosa-pref', on);
  }, [k]);
  return [v, set];
}

const TABLE_KEY = { accounts: 'accounts', transactions: 'transactions', budgets: 'budgets', recurring_expenses: 'recurring' };

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(null);
  const dataRef = useRef(null);
  dataRef.current = data;

  const reload = useCallback(async () => {
    setError(null);
    try {
      const next = await api.loadAll();
      setData((prev) => {
        if (prev?.profile) {
          const u = prev.profile.username || next.profile?.username;
          const r = prev.profile.region || next.profile?.region;
          next.profile = { ...prev.profile, ...next.profile, ...(u ? { username: u } : {}), ...(r ? { region: r } : {}) };
        }
        return next;
      });
    } catch (e) { setError(e); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const refreshRates = useCallback(async () => {
    try {
      const liveRes = await fetchLiveRates(true);
      if (liveRes) {
        setLive(liveRes);
        setData((d) => {
          if (!d) return d;
          return {
            ...d,
            rates: { ...d.rates, ...liveRes.rates },
            rateMeta: { ...d.rateMeta, ...liveRes.meta },
          };
        });
        return liveRes;
      }
    } catch (e) {
      console.warn('Error al actualizar tasas en segundo plano:', e);
    }
  }, []);

  // Tasas en vivo si la BD no tiene las de hoy (solo en modo real y región VE).
  useEffect(() => {
    if (!data || isDemo || (data.profile.region || 'VE') !== 'VE') return;
    const today = todayISO();
    const stale = ['BCV_USD', 'PARALELO', 'USDT'].some((k) => !data.rateMeta[k] || data.rateMeta[k].rate_date < today || !data.rates[k]);
    if (stale) fetchLiveRates().then(setLive).catch(() => {});
  }, [data]);

  const derived = useMemo(() => {
    if (!data) return null;
    const profile = { region: 'VE', preferred_currency: 'USD', valuation_rate: 'BCV_USD', ...data.profile };
    const region = REGIONS[profile.region] || REGIONS.VE;
    const accountTemplates = ACCOUNT_TEMPLATES[profile.region] || ACCOUNT_TEMPLATES.VE;

    // Tasas: BD primero; la API en vivo rellena huecos o días faltantes.
    const rates = { ...data.rates };
    const rateMeta = { ...data.rateMeta };
    if (live) {
      for (const [k, v] of Object.entries(live.rates)) {
        if (!rateMeta[k] || rateMeta[k].rate_date < live.meta[k].rate_date || !rates[k]) {
          rates[k] = v;
          rateMeta[k] = live.meta[k];
        }
      }
    }

    // Tasas por fecha para convertir cada movimiento con la tasa de su día.
    const byDate = {};
    for (const r of data.rateHistory) (byDate[r.rate_date] ??= {})[r.rate_type] = Number(r.rate);
    const dates = Object.keys(byDate).sort();
    const ratesOn = (d) => {
      if (byDate[d]) return { ...rates, ...byDate[d] };
      let lo = 0, hi = dates.length - 1, best = null;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (dates[mid] <= d) { best = dates[mid]; lo = mid + 1; } else hi = mid - 1; }
      return best ? { ...rates, ...byDate[best] } : rates;
    };

    const target = profile.preferred_currency;
    const val = profile.valuation_rate;

    // Saldos por cuenta.
    const bal = Object.fromEntries(data.accounts.map((a) => [a.id, Number(a.initial_balance) || 0]));
    const txs = data.transactions.map((t) => ({ ...t, date: txDate(t) }))
      .sort((a, b) => (b.date === a.date ? String(b.created_at).localeCompare(String(a.created_at)) : b.date.localeCompare(a.date)));
    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      if (t.account_id in bal) bal[t.account_id] += t.type === 'income' ? amt : -amt;
      if (t.type === 'transfer' && t.to_account_id in bal) bal[t.to_account_id] += Number(t.to_amount) || 0;
    }
    const accounts = data.accounts
      .map((a) => ({ ...a, balance: bal[a.id] }))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at).localeCompare(String(b.created_at)));
    const active = accounts.filter((a) => !a.archived);
    const accById = Object.fromEntries(accounts.map((a) => [a.id, a]));

    // Valor de cada movimiento en la moneda preferida, a la tasa de su día.
    const cur = (t) => accById[t.account_id]?.currency || 'USD';
    for (const t of txs) {
      t.currency = cur(t);
      t.value = convert(t.amount, t.currency, target, ratesOn(t.date), val) ?? 0;
    }

    const total = consolidate(active, target, rates, val);

    const monthStats = (ym) => {
      let income = 0, expense = 0, spread = 0;
      const byCat = {};
      for (const t of txs) {
        if (monthKey(t.date) !== ym || t.type === 'transfer') continue;
        if (t.type === 'income') income += t.value; else {
          expense += t.value;
          byCat[t.category || 'Otros'] = (byCat[t.category || 'Otros'] || 0) + t.value;
          if (t.original_currency === 'VES' && t.rate_bcv && t.rate_applied) {
            spread += convert(Number(t.original_amount) / t.rate_bcv - Number(t.original_amount) / t.rate_applied, 'USD', target, rates, val) ?? 0;
          }
        }
      }
      return { income, expense, net: income - expense, byCat, spread };
    };

    return { profile, region, accountTemplates, rates, rateMeta, ratesOn, accounts, active, accById, txs, total, target, val, monthStats,
      budgets: data.budgets, recurring: data.recurring, rateHistory: data.rateHistory, missing: data.missing };
  }, [data, live]);

  // Mutaciones: escriben en la BD y actualizan el estado local sin recargar todo.
  const upsertLocal = (table, row) => setData((d) => {
    const key = TABLE_KEY[table];
    const list = d[key].some((x) => x.id === row.id) ? d[key].map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [...d[key], row];
    return { ...d, [key]: list };
  });
  const dropLocal = (table, id) => setData((d) => {
    const key = TABLE_KEY[table];
    const next = { ...d, [key]: d[key].filter((x) => x.id !== id) };
    if (table === 'accounts') next.transactions = d.transactions.filter((t) => t.account_id !== id && t.to_account_id !== id);
    return next;
  });

  const actions = useMemo(() => ({
    reload,
    refreshRates,
    async save(table, row, id) {
      const saved = id ? await api.update(table, id, row) : await api.insert(table, row);
      upsertLocal(table, saved);
      return saved;
    },
    async remove(table, id) {
      await api.remove(table, id);
      dropLocal(table, id);
    },
    async createDefaultAccounts(customRegion) {
      const reg = customRegion || dataRef.current?.profile?.region || 'VE';
      const tpls = ACCOUNT_TEMPLATES[reg] || ACCOUNT_TEMPLATES.VE;
      const created = [];
      for (let i = 0; i < tpls.length; i++) {
        const t = tpls[i];
        const row = {
          name: t.name,
          currency: t.currency,
          kind: t.kind,
          initial_balance: 0,
          icon: t.icon || KINDS[t.kind].emoji,
          color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
          sort_order: i,
        };
        const saved = await api.insert('accounts', row);
        upsertLocal('accounts', saved);
        created.push(saved);
      }
      return created;
    },
    // optimistic: aplica el cambio en pantalla al instante y lo revierte si la BD lo rechaza.
    async updateProfile(patch, { optimistic = false } = {}) {
      const before = optimistic ? dataRef.current?.profile : null;
      if (optimistic) setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
      try {
        const p = await api.updateProfile(patch);
        setData((d) => ({ ...d, profile: { ...d.profile, ...p } }));
      } catch (e) {
        if (before) setData((d) => ({ ...d, profile: before }));
        throw e;
      }
    },
  }), [reload, refreshRates]);

  const value = useMemo(() => ({ ...(derived || {}), ready: Boolean(derived), error, actions }), [derived, error, actions]);
  return React.createElement(Ctx.Provider, { value }, children);
}
