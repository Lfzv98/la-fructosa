// Capa de datos. La app habla solo con este módulo.
// - Modo real: Supabase (RLS garantiza que cada quien vea solo lo suyo).
// - Modo demo (?demo o sin config): datos en memoria para ver la UI.
import { supabase, isConfigured } from './supabase.js';
import { fetchLiveMarketRates, normalizeProfile, txDay } from './money.js';

export const isDemo = !isConfigured || new URLSearchParams(location.search).has('demo');

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

function computeBalance(account, txs) {
  let balance = Number(account.initial_balance || 0);
  for (const t of txs) {
    if (t.account_id === account.id) balance += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
    if (t.to_account_id === account.id) balance += Number(t.to_amount || 0);
  }
  return balance;
}

function activeAccounts(accounts) {
  return (accounts || [])
    .filter((a) => a && a.archived !== true)
    .sort((x, y) => {
      const so = (Number(x.sort_order) || 0) - (Number(y.sort_order) || 0);
      if (so) return so;
      return String(x.name || '').localeCompare(String(y.name || ''), 'es');
    });
}

function filterTxs(txs, { from, to, accountId } = {}) {
  return (txs || [])
    .filter((t) => {
      const day = txDay(t);
      if (from && day && day < from) return false;
      if (to && day && day > to) return false;
      if (accountId && t.account_id !== accountId && t.to_account_id !== accountId) return false;
      return true;
    })
    .sort((x, y) => (txDay(y) + (y.created_at || '')).localeCompare(txDay(x) + (x.created_at || '')));
}

function accountPayload(acc) {
  const { archived, balance, id, user_id, created_at, updated_at, ...row } = acc || {};
  return row;
}

function txPayload(tx) {
  const {
    occurred_on, id, user_id, account, to_account, created_at, updated_at,
    usd_at_bcv, usd_at_paralelo, spread_usd, ...row
  } = tx || {};
  return row;
}

function profileFromUser(user, row = {}) {
  const meta = user?.user_metadata || {};
  return normalizeProfile({
    ...row,
    id: row.id || user?.id,
    display_name: String(row.display_name || meta.display_name || user?.email?.split('@')[0] || '').trim(),
    region: row.region || meta.region || row.region,
  });
}

function attachAccounts(txs, accounts) {
  const byId = Object.fromEntries((accounts || []).map((a) => [a.id, a]));
  return (txs || []).map((t) => {
    const from = byId[t.account_id];
    const to = t.to_account_id ? byId[t.to_account_id] : null;
    return {
      ...t,
      account: from ? { name: from.name, currency: from.currency } : null,
      to_account: to ? { name: to.name, currency: to.currency } : null,
    };
  });
}

const real = {
  async getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const row = unwrap(await supabase.from('profiles').select('*').eq('id', user.id).single());
      return profileFromUser(user, row);
    } catch {
      return profileFromUser(user);
    }
  },
  async updateProfile(patch) {
    const { data: { user } } = await supabase.auth.getUser();
    const apply = async (p) => profileFromUser(user, unwrap(
      await supabase.from('profiles').update(p).eq('id', user.id).select().single()
    ));
    try {
      return await apply(patch);
    } catch {
      const { region, valuation_rate, ...rest } = patch;
      if (region || valuation_rate) {
        try { return await apply(rest); } catch { /* perfil mínimo en cliente */ }
      }
      return profileFromUser(user, patch);
    }
  },
  async listBalances() {
    const [accRes, txRes] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('transactions').select('type, account_id, amount, to_account_id, to_amount'),
    ]);
    const accounts = activeAccounts(unwrap(accRes));
    const txs = txRes.error ? [] : (txRes.data || []);
    return accounts.map((a) => ({ ...a, balance: computeBalance(a, txs) }));
  },
  async createAccount(acc) {
    return unwrap(await supabase.from('accounts').insert(accountPayload(acc)).select().single());
  },
  async updateAccount(id, patch) {
    const { data: { user } } = await supabase.auth.getUser();
    const { archived, balance, ...safe } = patch;
    return unwrap(await supabase.from('accounts').update(safe).eq('id', id).eq('user_id', user.id).select().single());
  },
  async listTransactions({ limit = 1500, from, to, accountId } = {}) {
    const [txRes, accRes] = await Promise.all([
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(limit),
      supabase.from('accounts').select('*'),
    ]);
    return filterTxs(attachAccounts(unwrap(txRes), accRes.error ? [] : (accRes.data || [])), { from, to, accountId });
  },
  async createTransaction(tx) {
    return unwrap(await supabase.from('transactions').insert(txPayload(tx)).select().single());
  },
  async listBudgets() {
    try { return unwrap(await supabase.from('budgets').select('*').order('category')) || []; }
    catch { return []; }
  },
  async upsertBudget(row) {
    const { data: { user } } = await supabase.auth.getUser();
    return unwrap(await supabase.from('budgets').upsert({ ...row, user_id: user.id }, { onConflict: 'user_id,category,currency' }).select().single());
  },
  async deleteBudget(id) {
    return unwrap(await supabase.from('budgets').delete().eq('id', id));
  },
  async listRecurring() {
    try { return unwrap(await supabase.from('recurring_expenses').select('*').order('due_day')) || []; }
    catch { return []; }
  },
  async createRecurring(row) {
    const { data: { user } } = await supabase.auth.getUser();
    return unwrap(await supabase.from('recurring_expenses').insert({ ...row, user_id: user.id }).select().single());
  },
  async updateRecurring(id, patch) {
    return unwrap(await supabase.from('recurring_expenses').update(patch).eq('id', id).select().single());
  },
  async deleteRecurring(id) {
    return unwrap(await supabase.from('recurring_expenses').delete().eq('id', id));
  },
  async latestRates() {
    try {
      const rows = unwrap(await supabase.from('latest_rates').select('*'));
      return Object.fromEntries((rows || []).map((r) => [r.rate_type, Number(r.rate)]));
    } catch {
      return {};
    }
  },
  async latestRateRows() {
    try {
      return unwrap(await supabase.from('latest_rates').select('*')) || [];
    } catch {
      return [];
    }
  },
};

// ---------- Demo en memoria ----------
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
const demoState = {
  profile: { id: 'demo', display_name: '', region: 'VE', preferred_currency: 'USD', valuation_rate: 'BCV_USD' },
  rates: [
    { rate_type: 'BCV_USD', rate: 180.25, rate_date: today, source: 'demo' },
    { rate_type: 'BCV_EUR', rate: 205.1, rate_date: today, source: 'demo' },
    { rate_type: 'PARALELO', rate: 252.4, rate_date: today, source: 'demo' },
    { rate_type: 'USDT', rate: 249.9, rate_date: today, source: 'demo' },
  ],
  // El modo demo arranca vacío: sin cuentas, movimientos, presupuestos ni pagos de ejemplo.
  accounts: [],
  txs: [],
  budgets: [],
  recurring: [],
};
const uid = () => Math.random().toString(36).slice(2);
const accById = (id) => demoState.accounts.find((a) => a.id === id);

const demo = {
  async getProfile() { return normalizeProfile(demoState.profile); },
  async updateProfile(patch) {
    Object.assign(demoState.profile, patch);
    return normalizeProfile(demoState.profile);
  },
  async listBalances() {
    return demoState.accounts.map((a) => ({ ...a, balance: computeBalance(a, demoState.txs) }));
  },
  async createAccount(acc) { const a = { id: uid(), sort_order: 99, ...acc }; demoState.accounts.push(a); return a; },
  async updateAccount(id, patch) {
    const a = demoState.accounts.find((x) => x.id === id);
    if (!a) throw new Error('Cuenta no encontrada');
    Object.assign(a, patch);
    return { ...a };
  },
  async listTransactions({ from, to, accountId } = {}) {
    return filterTxs(
      demoState.txs.map((t) => ({ ...t, account: accById(t.account_id), to_account: t.to_account_id ? accById(t.to_account_id) : null })),
      { from, to, accountId }
    );
  },
  async createTransaction(tx) {
    const t = { id: uid(), created_at: new Date().toISOString(), ...tx };
    demoState.txs.push(t);
    return t;
  },
  async listBudgets() { return demoState.budgets.map((b) => ({ ...b })); },
  async upsertBudget(row) {
    const found = demoState.budgets.find((b) => b.category === row.category && b.currency === row.currency);
    if (found) { Object.assign(found, row); return { ...found }; }
    const b = { id: uid(), ...row };
    demoState.budgets.push(b);
    return b;
  },
  async deleteBudget(id) { demoState.budgets = demoState.budgets.filter((b) => b.id !== id); },
  async listRecurring() { return demoState.recurring.map((r) => ({ ...r })); },
  async createRecurring(row) {
    const r = { id: uid(), is_active: true, ...row };
    demoState.recurring.push(r);
    return r;
  },
  async updateRecurring(id, patch) {
    const r = demoState.recurring.find((x) => x.id === id);
    if (!r) throw new Error('Recurrente no encontrado');
    Object.assign(r, patch);
    return { ...r };
  },
  async deleteRecurring(id) { demoState.recurring = demoState.recurring.filter((r) => r.id !== id); },
  async latestRates() { return Object.fromEntries(demoState.rates.map((r) => [r.rate_type, r.rate])); },
  async latestRateRows() { return demoState.rates; },
};

const persist = isDemo ? demo : real;
let liveRates = null;

export async function refreshRates() {
  liveRates = await fetchLiveMarketRates();
  return liveRates;
}

export const api = {
  ...persist,
  async latestRates() {
    if (liveRates) return liveRates.rates;
    try {
      liveRates = await fetchLiveMarketRates();
      return liveRates.rates;
    } catch {
      return persist.latestRates();
    }
  },
  async latestRateRows() {
    if (liveRates) return liveRates.rows;
    try {
      liveRates = await fetchLiveMarketRates();
      return liveRates.rows;
    } catch {
      return persist.latestRateRows();
    }
  },
  async refreshRates() {
    return refreshRates();
  },
};
