// Estado global: carga los datos una vez, calcula saldos y estadísticas
// y expone acciones que actualizan la base de datos y la interfaz al instante.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, isDemo } from './api.js';
import { fetchLiveRates } from './rates.js';
import { snapshot, queue, isNetworkError, uuid } from './offline.js';
import { toast } from './ui.js';
import { regionFor, setTimeZoneFor, ACCOUNT_TEMPLATES, ACCOUNT_COLORS, KINDS, convert, consolidate, consolidateInvestments, todayISO, monthKey } from './money.js';

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

const TABLE_KEY = { accounts: 'accounts', transactions: 'transactions', budgets: 'budgets', recurring_expenses: 'recurring', savings_goals: 'goals', loans: 'loans', shopping_items: 'shopping', investments: 'investments' };

export function DataProvider({ uid, children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(null);
  const [pending, setPending] = useState(0);   // movimientos guardados sin conexión, por subir
  const [offline, setOffline] = useState(false); // mostrando la última copia guardada
  const dataRef = useRef(null);
  dataRef.current = data;
  const useOffline = !isDemo && Boolean(uid);

  // Agrega a la lista los movimientos que siguen en la cola (aún no están en la base de datos).
  const withQueued = async (next) => {
    if (!useOffline) return next;
    const q = await queue.read(uid);
    setPending(q.length);
    const have = new Set(next.transactions.map((t) => t.id));
    const extra = q.filter((it) => it.table === 'transactions' && !have.has(it.row.id)).map((it) => it.row);
    return extra.length ? { ...next, transactions: [...extra, ...next.transactions] } : next;
  };

  const reload = useCallback(async () => {
    setError(null);
    try {
      let next;
      try {
        next = await api.loadAll();
        setOffline(false);
        if (useOffline) snapshot.write(uid, next);
      } catch (e) {
        // Sin internet: se abre con la última copia guardada en este teléfono.
        const snap = useOffline && isNetworkError(e) ? await snapshot.read(uid) : null;
        if (!snap?.data) throw e;
        next = { ...snap.data, savedAt: snap.at };
        setOffline(true);
      }
      next = await withQueued(next);
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

  // Sube la cola en orden. Si un movimiento ya llegó (id repetido), se cuenta como subido.
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (!useOffline || flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      let q = await queue.read(uid);
      if (!q.length) return;
      let synced = 0;
      while (q.length) {
        const { table, row } = q[0];
        const { pending: _p, ...clean } = row;
        try {
          const saved = await api.insert(table, clean);
          upsertLocal(table, { ...saved, pending: false });
          synced++;
        } catch (e) {
          if (isNetworkError(e)) break;
          if (e?.code === '23505' || /duplicate/i.test(e?.message || '')) { synced++; upsertLocal(table, { ...row, pending: false }); }
          else { dropLocal(table, row.id); toast('No se pudo subir un movimiento guardado sin conexión: ' + (e?.message || e), { tone: 'bad' }); }
        }
        q = q.slice(1);
        await queue.write(uid, q);
      }
      setPending(q.length);
      if (synced) {
        toast(synced === 1 ? '✓ Se subió 1 movimiento guardado sin conexión' : `✓ Se subieron ${synced} movimientos guardados sin conexión`);
        if (useOffline && dataRef.current) snapshot.write(uid, dataRef.current);
      }
    } finally { flushing.current = false; }
  }, [uid]);

  // Al volver la conexión: sube la cola y actualiza los datos.
  useEffect(() => {
    if (!useOffline) return;
    const back = () => { flush().then(() => { if (dataRef.current?.savedAt || offline) reload(); }); };
    const vis = () => { if (document.visibilityState === 'visible') flush(); };
    addEventListener('online', back);
    document.addEventListener('visibilitychange', vis);
    return () => { removeEventListener('online', back); document.removeEventListener('visibilitychange', vis); };
  }, [flush, reload, offline]);
  useEffect(() => { if (data && pending) flush(); }, [Boolean(data)]);

  // Filas que la función update-rates acaba de guardar: entran al historial sin recargar todo.
  const addRateRows = useCallback((res) => {
    const rows = Array.isArray(res?.rates) ? res.rates : [];
    if (!rows.length) return;
    setData((d) => {
      if (!d) return d;
      const key = (r) => r.rate_type + '|' + r.rate_date;
      const fresh = new Map(rows.map((r) => [key(r), r]));
      return { ...d, rateHistory: [...(d.rateHistory || []).filter((r) => !fresh.has(key(r))), ...fresh.values()]
        .sort((a, b) => a.rate_date.localeCompare(b.rate_date)) };
    });
  }, []);

  const refreshRates = useCallback(async () => {
    // "Actualizar" también le pide al servidor que guarde las de hoy (así crece el historial).
    if (!isDemo && navigator.onLine) api.healRates(true).then(addRateRows).catch(() => {});
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
  }, [addRateRows]);

  // Tasas en vivo si la base de datos no tiene las de hoy (solo en modo real, en Venezuela
  // o fuera de ella si la persona tiene cuentas en bolívares).
  useEffect(() => {
    if (!data || isDemo || !regionFor(data.profile.region || 'VE', data.accounts).rates) return;
    const today = todayISO();
    const stale = ['BCV_USD', 'PARALELO', 'USDT'].some((k) => !data.rateMeta[k] || data.rateMeta[k].rate_date < today || !data.rates[k]);
    if (stale) {
      fetchLiveRates().then(setLive).catch(() => {});
      if (navigator.onLine) api.healRates().then(addRateRows).catch(() => {}); // para que el servidor guarde las de hoy en el historial
    }
  }, [data]);

  const derived = useMemo(() => {
    if (!data) return null;
    const profile = { region: 'VE', preferred_currency: 'USD', valuation_rate: 'BCV_USD', ...data.profile };
    setTimeZoneFor(profile.region); // "hoy" en la hora del país de la persona
    const region = regionFor(profile.region, data.accounts);
    const accountTemplates = ACCOUNT_TEMPLATES[profile.region] || ACCOUNT_TEMPLATES.VE;

    // Tasas: primero las de la base de datos; la API en vivo completa los huecos o los días faltantes.
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

    // Inversiones: solo con el permiso del perfil (migración 015). Su valor actual suma al patrimonio.
    const investmentsOn = profile.investments_enabled === true && !(data.missing || []).includes('investments');
    const investments = investmentsOn ? (data.investments || []) : [];
    // Patrimonio total = cuentas + inversiones, con la valoración que se pida (BCV o Paralelo).
    const wealth = (cur, v) => {
      const acc = consolidate(active, cur, rates, v);
      if (!investmentsOn) return { ...acc, accounts: acc.total, investments: 0 };
      const inv = consolidateInvestments(investments, cur, rates, v);
      return { total: acc.total + inv.value, missing: acc.missing || inv.missing, accounts: acc.total, investments: inv.value };
    };
    const total = wealth(target, val);

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
      budgets: data.budgets, recurring: data.recurring, goals: data.goals || [], loans: data.loans || [], shopping: data.shopping || [],
      investmentsOn, investments, wealth,
      rateHistory: data.rateHistory, missing: data.missing || [], savedAt: data.savedAt };
  }, [data, live]);

  // Mutaciones: escriben en la base de datos y actualizan el estado local sin recargar todo.
  const upsertLocal = (table, row) => setData((d) => {
    const key = TABLE_KEY[table];
    if (!d[key]) d = { ...d, [key]: [] };
    const list = d[key].some((x) => x.id === row.id) ? d[key].map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [...d[key], row];
    return { ...d, [key]: list };
  });
  const dropLocal = (table, id) => setData((d) => {
    const key = TABLE_KEY[table];
    const next = { ...d, [key]: (d[key] || []).filter((x) => x.id !== id) };
    if (table === 'accounts') next.transactions = d.transactions.filter((t) => t.account_id !== id && t.to_account_id !== id);
    return next;
  });

  const actions = useMemo(() => ({
    reload,
    refreshRates,
    async save(table, row, id) {
      // Movimientos nuevos: llevan su id desde el teléfono; así se pueden guardar sin conexión
      // y subir después sin duplicarse.
      if (useOffline && table === 'transactions' && !id) {
        const local = { ...row, id: row.id || uuid() };
        const enqueue = async () => {
          const q = await queue.read(uid);
          await queue.write(uid, [...q, { table, row: local }]);
          setPending(q.length + 1);
          const shown = { ...local, user_id: uid, created_at: new Date().toISOString(), pending: true };
          upsertLocal(table, shown);
          toast('Sin conexión: guardado en el teléfono. Se subirá automáticamente cuando vuelva la conexión.');
          return shown;
        };
        if (!navigator.onLine) return enqueue();
        try {
          const saved = await api.insert(table, local);
          upsertLocal(table, saved);
          return saved;
        } catch (e) {
          if (isNetworkError(e)) return enqueue();
          throw e;
        }
      }
      // Editar un movimiento que aún no se subió: se corrige en la cola.
      if (useOffline && table === 'transactions' && id) {
        const q = await queue.read(uid);
        const i = q.findIndex((it) => it.row.id === id);
        if (i >= 0) {
          q[i] = { ...q[i], row: { ...q[i].row, ...row, id } };
          await queue.write(uid, q);
          const shown = { ...q[i].row, user_id: uid, pending: true };
          upsertLocal(table, shown);
          return shown;
        }
      }
      const saved = id ? await api.update(table, id, row) : await api.insert(table, row);
      upsertLocal(table, saved);
      return saved;
    },
    async remove(table, id) {
      // Un movimiento que aún no se subió se quita de la cola, sin pasar por la base de datos.
      if (useOffline) {
        const q = await queue.read(uid);
        if (q.some((it) => it.row.id === id)) {
          const rest = q.filter((it) => it.row.id !== id);
          await queue.write(uid, rest);
          setPending(rest.length);
          dropLocal(table, id);
          return;
        }
      }
      const receipt = table === 'transactions' && dataRef.current?.transactions.find((t) => t.id === id)?.receipt_path;
      await api.remove(table, id);
      dropLocal(table, id);
      if (receipt) api.receipts.remove(receipt).catch(() => {}); // la foto ya no sirve sin su movimiento
    },
    // Comprobante: sube la foto y la enlaza al movimiento. Necesita conexión.
    async attachReceipt(txId, blob) {
      if (!navigator.onLine && !isDemo) throw new Error('Sin conexión: el comprobante se puede agregar cuando vuelva la señal.');
      const path = await api.receipts.upload(txId, blob);
      let saved;
      try { saved = await api.update('transactions', txId, { receipt_path: path }); } catch (e) {
        api.receipts.remove(path).catch(() => {}); // no dejamos la foto suelta
        // Sin la columna receipt_path (migración 013 pendiente) la base de datos la rechaza.
        throw /receipt_path/.test(e?.message || '') ? new Error('Falta activar los comprobantes: ejecuta la migración 013 en Supabase.') : e;
      }
      upsertLocal('transactions', saved);
      return saved;
    },
    async removeReceipt(tx) {
      const saved = await api.update('transactions', tx.id, { receipt_path: null });
      upsertLocal('transactions', saved);
      if (tx.receipt_path) api.receipts.remove(tx.receipt_path).catch(() => {});
      return saved;
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
    // optimistic: aplica el cambio en pantalla al instante y lo revierte si la base de datos lo rechaza.
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
    flush,
  }), [reload, refreshRates, flush]);

  const value = useMemo(() => ({ ...(derived || {}), ready: Boolean(derived), error, actions, pending, offline }), [derived, error, actions, pending, offline]);
  return React.createElement(Ctx.Provider, { value }, children);
}
