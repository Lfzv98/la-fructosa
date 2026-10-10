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
  async listTransactions(limit = 100) {
    return unwrap(await supabase.from('transactions')
      .select('*, account:accounts!transactions_account_id_user_id_fkey(name,currency), to_account:accounts!transactions_to_account_id_user_id_fkey(name,currency)')
      .order('occurred_on', { ascending: false }).order('created_at', { ascending: false })
      .limit(limit));
  },
  async createTransaction(tx) {
    return unwrap(await supabase.from('transactions').insert(tx).select().single());
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
  async listTransactions() {
    return [...demoState.txs]
      .sort((x, y) => (y.occurred_on + y.created_at).localeCompare(x.occurred_on + x.created_at))
      .map((t) => ({ ...t, account: accById(t.account_id), to_account: t.to_account_id ? accById(t.to_account_id) : null }));
  },
  async createTransaction(tx) {
    const t = { id: uid(), created_at: new Date().toISOString(), ...tx };
    demoState.txs.push(t);
    return t;
  },
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
