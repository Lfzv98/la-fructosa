// Capa de datos. La app habla solo con este módulo.
// - Modo real: Supabase (RLS garantiza que cada quien vea solo lo suyo).
// - Modo demo (?demo o sin config): datos en memoria para ver la UI.
import { supabase, isConfigured } from './supabase.js';
import { fetchLiveMarketRates } from './money.js';

export const isDemo = !isConfigured || new URLSearchParams(location.search).has('demo');

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

const real = {
  async getProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    return unwrap(await supabase.from('profiles').select('*').eq('id', user.id).single());
  },
  async updateProfile(patch) {
    const { data: { user } } = await supabase.auth.getUser();
    return unwrap(await supabase.from('profiles').update(patch).eq('id', user.id).select().single());
  },
  async listBalances() {
    return unwrap(await supabase.from('account_balances').select('*')
      .eq('archived', false).order('sort_order').order('name'));
  },
  async createAccount(acc) {
    return unwrap(await supabase.from('accounts').insert(acc).select().single());
  },
  async updateAccount(id, patch) {
    const { data: { user } } = await supabase.auth.getUser();
    return unwrap(await supabase.from('accounts').update(patch).eq('id', id).eq('user_id', user.id).select().single());
  },
  async listTransactions({ limit = 400, from, to, accountId } = {}) {
    let q = supabase.from('transactions')
      .select('*, account:accounts!transactions_account_id_user_id_fkey(name,currency), to_account:accounts!transactions_to_account_id_user_id_fkey(name,currency)')
      .order('occurred_on', { ascending: false }).order('created_at', { ascending: false })
      .limit(limit);
    if (from) q = q.gte('occurred_on', from);
    if (to) q = q.lte('occurred_on', to);
    if (accountId) q = q.or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`);
    return unwrap(await q);
  },
  async createTransaction(tx) {
    return unwrap(await supabase.from('transactions').insert(tx).select().single());
  },
  async listBudgets() {
    return unwrap(await supabase.from('budgets').select('*').order('category'));
  },
  async upsertBudget(row) {
    const { data: { user } } = await supabase.auth.getUser();
    return unwrap(await supabase.from('budgets').upsert({ ...row, user_id: user.id }, { onConflict: 'user_id,category,currency' }).select().single());
  },
  async deleteBudget(id) {
    return unwrap(await supabase.from('budgets').delete().eq('id', id));
  },
  async listRecurring() {
    return unwrap(await supabase.from('recurring_expenses').select('*').order('due_day'));
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
    const rows = unwrap(await supabase.from('latest_rates').select('*'));
    return Object.fromEntries(rows.map((r) => [r.rate_type, Number(r.rate)]));
  },
  async latestRateRows() {
    return unwrap(await supabase.from('latest_rates').select('*'));
  },
};

// ---------- Demo en memoria ----------
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
const demoState = {
  profile: { id: 'demo', display_name: 'Familia', preferred_currency: 'USD', valuation_rate: 'BCV_USD' },
  rates: [
    { rate_type: 'BCV_USD', rate: 180.25, rate_date: today, source: 'demo' },
    { rate_type: 'BCV_EUR', rate: 205.1, rate_date: today, source: 'demo' },
    { rate_type: 'PARALELO', rate: 252.4, rate_date: today, source: 'demo' },
    { rate_type: 'USDT', rate: 249.9, rate_date: today, source: 'demo' },
  ],
  accounts: [
    { id: 'a1', name: 'Efectivo', currency: 'USD', kind: 'cash', icon: '💵', initial_balance: 320, sort_order: 0 },
    { id: 'a2', name: 'Zelle', currency: 'USD', kind: 'digital', icon: '📱', initial_balance: 850, sort_order: 1 },
    { id: 'a3', name: 'Pago Móvil', currency: 'VES', kind: 'bank', icon: '🇻🇪', initial_balance: 18500, sort_order: 2 },
    { id: 'a4', name: 'Binance', currency: 'USDT', kind: 'crypto', icon: '🟡', initial_balance: 410, sort_order: 3 },
  ],
  txs: [
    { id: 't1', type: 'expense', account_id: 'a1', amount: 14.26, category: 'Comida', description: 'Arepera',
      occurred_on: today, original_amount: 3600, original_currency: 'VES', rate_applied: 252.4,
      rate_bcv: 180.25, rate_paralelo: 252.4, created_at: new Date().toISOString() },
    { id: 't2', type: 'income', account_id: 'a2', amount: 600, category: 'Sueldo', description: 'Quincena',
      occurred_on: today, created_at: new Date().toISOString() },
    { id: 't3', type: 'expense', account_id: 'a2', amount: 45, category: 'Servicios', description: 'Electricidad',
      occurred_on: today, created_at: new Date().toISOString() },
    { id: 't4', type: 'expense', account_id: 'a1', amount: 20, category: 'Transporte', description: 'Gasolina',
      occurred_on: today, created_at: new Date().toISOString() },
    { id: 't5', type: 'expense', account_id: 'a1', amount: 8, category: 'Salud', description: 'Farmacia',
      occurred_on: today, created_at: new Date().toISOString() },
  ],
  budgets: [
    { id: 'b1', category: 'Comida', monthly_limit: 80, currency: 'USD' },
    { id: 'b2', category: 'Servicios', monthly_limit: 40, currency: 'USD' },
    { id: 'b3', category: 'Transporte', monthly_limit: 25, currency: 'USD' },
    { id: 'b4', category: 'Salud', monthly_limit: 30, currency: 'USD' },
  ],
  recurring: [
    { id: 'r1', name: 'Internet', amount: 25, currency: 'USD', category: 'Servicios', due_day: 12, account_id: 'a2', is_active: true },
    { id: 'r2', name: 'Netflix', amount: 6.99, currency: 'USD', category: 'Salidas', due_day: 5, account_id: 'a2', is_active: true },
    { id: 'r3', name: 'Gimnasio', amount: 15, currency: 'USD', category: 'Salud', due_day: 10, account_id: 'a1', is_active: true },
  ],
};
const uid = () => Math.random().toString(36).slice(2);
const accById = (id) => demoState.accounts.find((a) => a.id === id);

const demo = {
  async getProfile() { return { ...demoState.profile }; },
  async updateProfile(patch) { Object.assign(demoState.profile, patch); return { ...demoState.profile }; },
  async listBalances() {
    return demoState.accounts.map((a) => {
      let balance = Number(a.initial_balance);
      for (const t of demoState.txs) {
        if (t.account_id === a.id) balance += t.type === 'income' ? t.amount : -t.amount;
        if (t.to_account_id === a.id) balance += t.to_amount;
      }
      return { ...a, archived: false, balance };
    });
  },
  async createAccount(acc) { const a = { id: uid(), sort_order: 99, ...acc }; demoState.accounts.push(a); return a; },
  async updateAccount(id, patch) {
    const a = demoState.accounts.find((x) => x.id === id);
    if (!a) throw new Error('Cuenta no encontrada');
    Object.assign(a, patch);
    return { ...a };
  },
  async listTransactions({ from, to, accountId } = {}) {
    return [...demoState.txs]
      .filter((t) => (!from || t.occurred_on >= from) && (!to || t.occurred_on <= to)
        && (!accountId || t.account_id === accountId || t.to_account_id === accountId))
      .sort((x, y) => (y.occurred_on + y.created_at).localeCompare(x.occurred_on + x.created_at))
      .map((t) => ({ ...t, account: accById(t.account_id), to_account: t.to_account_id ? accById(t.to_account_id) : null }));
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
