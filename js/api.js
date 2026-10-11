// Capa de datos. La interfaz solo habla con este módulo.
// - Modo real: Supabase. RLS (auth.uid() = user_id) garantiza que cada quien vea solo lo suyo.
// - Modo demo (?demo o sin configurar): datos ficticios guardados en este navegador.
import { todayISO } from './money.js';

// config.js tiene tus claves y NO viene en las actualizaciones: si falta, la app abre en demo.
let config = {};
try { config = await import('./config.js'); } catch { /* sin config: demo */ }

export const isConfigured = Boolean(config.SUPABASE_URL) && !config.SUPABASE_URL.includes('TU-PROYECTO');
export const isDemo = !isConfigured || new URLSearchParams(location.search).has('demo');

export const TABLES = ['accounts', 'transactions', 'budgets', 'recurring_expenses'];

let sbPromise;
const sb = () => (sbPromise ??= import('./supabase.js').then((m) => m.supabase));

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Si la BD aún no tiene una columna nueva (migración pendiente), la quitamos y reintentamos.
async function tolerant(run, row) {
  let payload = { ...row };
  for (let i = 0; i < 6; i++) {
    const res = await run(payload);
    const miss = res.error?.message?.match(/Could not find the '([^']+)' column/);
    if (!miss) return unwrap(res);
    delete payload[miss[1]];
  }
  throw new Error('La base de datos rechazó el registro. Revisa la migración.');
}

// --- Perfil con plan B ---------------------------------------------------
// Si guardar usuario y país en la tabla `profiles` falla o tarda, se guardan en
// user_metadata de Supabase Auth y en localStorage para que nadie se quede en
// "Guardando…". Al siguiente arranque se intenta sincronizar con la tabla.
const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
]);
const isDuplicate = (e) => e?.code === '23505' || /duplicate|unique/i.test(e?.message || '');
const FB_KEY = (id) => 'fructosa-profile-fallback-' + id;
const readFallback = (id) => { try { return JSON.parse(localStorage.getItem(FB_KEY(id))) || {}; } catch { return {}; } };
const writeFallback = (id, patch) => { try { localStorage.setItem(FB_KEY(id), JSON.stringify({ ...readFallback(id), ...patch })); } catch { /* nada */ } };
const clearFallback = (id) => { try { localStorage.removeItem(FB_KEY(id)); } catch { /* nada */ } };
const PROFILE_KEYS = ['username', 'region', 'preferred_currency'];
const pickProfile = (o = {}) => Object.fromEntries(PROFILE_KEYS.filter((k) => o[k]).map((k) => [k, o[k]]));

const daysAgo = (n) => { const d = new Date(todayISO() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

function ratesFromRows(rows) {
  const out = {}; const meta = {};
  for (const r of rows) {
    if (!out[r.rate_type] || r.rate_date > meta[r.rate_type].rate_date) {
      out[r.rate_type] = Number(r.rate);
      meta[r.rate_type] = r;
    }
  }
  // Garantizar tasa USDT P2P para evitar mostrar '—'
  if (!out.USDT && out.PARALELO) {
    out.USDT = Number((out.PARALELO * 0.995).toFixed(2));
    meta.USDT = { rate_type: 'USDT', rate: out.USDT, rate_date: meta.PARALELO?.rate_date || todayISO(), source: 'Mercado P2P (aprox.)' };
  }
  return { rates: out, meta };
}

// ---------------------------------------------------------------------
// Supabase real
// ---------------------------------------------------------------------
const real = {
  auth: {
    async session() { const c = await sb(); return (await c.auth.getSession()).data.session; },
    async onChange(cb) { const c = await sb(); return c.auth.onAuthStateChange((e, s) => cb(s, e)).data.subscription; },
    // JWT de la sesión actual (el copiloto lo usa para identificarse ante el proxy de IA).
    async accessToken() { const c = await sb(); return (await c.auth.getSession()).data.session?.access_token || null; },
    // Acepta usuario o correo. El usuario se traduce a su correo con una función de la BD.
    async signIn(login, password) {
      const c = await sb();
      let email = login.trim();
      if (!email.includes('@')) {
        const { data, error } = await c.rpc('email_for_login', { p_username: email.toLowerCase() });
        if (error) throw error;
        if (!data) throw new Error('Invalid login credentials');
        email = data;
      }
      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { session: data.session };
    },
    async usernameAvailable(username) {
      const c = await sb();
      const { data, error } = await c.rpc('username_available', { p_username: username.toLowerCase() });
      if (error) return true; // si la función no existe aún, la BD validará al guardar
      return data;
    },
    async signUp(email, password, meta) {
      const c = await sb();
      const { data, error } = await c.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      // Con sesión válida la app entra de inmediato. Usuario y país (ya van en user_metadata)
      // se copian a `profiles` en segundo plano, sin bloquear la interfaz.
      if (data.session) {
        const { username, region } = meta || {};
        if (username && region) {
          setTimeout(() => real.updateProfile({ username, region, preferred_currency: region === 'ES' ? 'EUR' : 'USD' }).catch(() => {}), 0);
        }
      }
      return { session: data.session, needsConfirm: !data.session };
    },
    async reset(email) {
      const c = await sb();
      const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
    },
    async updatePassword(password) {
      const c = await sb(); const { error } = await c.auth.updateUser({ password });
      if (error) throw error;
    },
    async signOut() { const c = await sb(); await c.auth.signOut(); },
  },

  async loadAll() {
    const c = await sb();
    const { data: { user } } = await c.auth.getUser();
    const missing = [];
    const optional = async (table, q) => {
      const res = await q;
      if (res.error) { missing.push(table); return []; }
      return res.data;
    };

    const [profileRes, accounts, transactions, budgets, recurring, rateRows] = await Promise.all([
      c.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      c.from('accounts').select('*').order('created_at').then(unwrap),
      c.from('transactions').select('*').order('created_at', { ascending: false }).limit(5000).then(unwrap),
      optional('budgets', c.from('budgets').select('*')),
      optional('recurring_expenses', c.from('recurring_expenses').select('*').order('due_day')),
      c.from('exchange_rates').select('rate_type, rate, rate_date, source, fetched_at')
        .gte('rate_date', daysAgo(120)).order('rate_date').then((r) => (r.error ? [] : r.data)),
    ]);

    const meta = user.user_metadata || {};
    const fallback = { ...readFallback('last'), ...readFallback(user.id) };
    const dbProfile = profileRes.data || {};
    const uName = dbProfile.username || meta.username || fallback.username || (user.email ? user.email.split('@')[0] : '');
    const reg = dbProfile.region || meta.region || fallback.region || 'VE';
    const profile = {
      id: user.id,
      username: uName,
      display_name: dbProfile.display_name || meta.display_name || fallback.display_name || uName,
      region: reg,
      preferred_currency: dbProfile.preferred_currency || (reg === 'ES' ? 'EUR' : 'USD'),
      valuation_rate: dbProfile.valuation_rate || 'BCV_USD',
      ...dbProfile,
    };
    if (uName) profile.username = uName;
    if (reg) profile.region = reg;
    // Un display_name vacío en la tabla no debe tapar el nombre guardado al registrarse ni el usuario.
    if (!String(profile.display_name || '').trim()) profile.display_name = meta.display_name || fallback.display_name || uName;
    profile.email = user.email;

    // Usuario y país guardados por el plan B (o elegidos en el registro) que la tabla aún no tiene:
    // se aplican ya, para no volver a pedirlos, y se intenta sincronizarlos en segundo plano.
    if (!profile.username) {
      const pending = { ...pickProfile(meta), ...pickProfile(fallback) };
      if (pending.username) {
        Object.assign(profile, pending);
        c.from('profiles').update(pending).eq('id', user.id).then((r) => { if (!r.error) clearFallback(user.id); }, () => {});
      }
    }
    if (!profile.region) {
      profile.region = reg;
    }
    const { rates, meta: rateMeta } = ratesFromRows(rateRows);
    return { profile, accounts, transactions, budgets, recurring, rates, rateMeta, rateHistory: rateRows, missing };
  },

  async updateProfile(patch) {
    const c = await sb();
    const { data: { session } } = await c.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Tu sesión expiró. Vuelve a entrar.');
    const critical = 'username' in patch || 'region' in patch; // lo que decide si entras a la app

    // Respaldo inmediato local y en auth user_metadata para que no se pierda
    const fb = pickProfile(patch);
    if (Object.keys(fb).length) {
      writeFallback(user.id, fb);
      writeFallback('last', fb);
      c.auth.updateUser({ data: fb }).catch(() => {});
    }

    const save = async () => {
      try {
        const res = await tolerant((p) => c.from('profiles').update(p).eq('id', user.id).select().single(), patch);
        return res;
      } catch (e) {
        if (isDuplicate(e)) throw e;
        // Sin fila de perfil (cuenta antigua o trigger caído): la creamos.
        const display_name = user.user_metadata?.display_name || user.email.split('@')[0];
        return tolerant((p) => c.from('profiles').upsert({ id: user.id, display_name, ...p }).select().single(), patch);
      }
    };
    try {
      const saved = await withTimeout(save(), 8000);
      return { ...fb, ...saved };
    } catch (e) {
      if (!critical || isDuplicate(e)) throw e; // usuario repetido: se avisa y se puede corregir
      console.warn('[perfil] la tabla no respondió; se guarda en user_metadata y en este dispositivo', e);
      return { ...fb };
    }
  },
  async insert(table, row) {
    const c = await sb();
    // user_id = auth.uid() de la sesión actual, siempre explícito: la política RLS de insert
    // exige (auth.uid() = user_id) y no dependemos solo del default de la columna.
    const { data: { session } } = await c.auth.getSession();
    if (!session?.user) throw new Error('Tu sesión expiró. Vuelve a entrar.');
    return tolerant((p) => c.from(table).insert(p).select().single(), { ...row, user_id: session.user.id });
  },
  async update(table, id, patch) {
    const c = await sb();
    return tolerant((p) => c.from(table).update(p).eq('id', id).select().single(), patch);
  },
  async remove(table, id) {
    const c = await sb();
    unwrap(await c.from(table).delete().eq('id', id));
  },
};

// ---------------------------------------------------------------------
// Demo: datos de ejemplo realistas, guardados en localStorage
// ---------------------------------------------------------------------
const DEMO_KEY = 'fructosa-demo-v3';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

function seedDemo() {
  const today = todayISO();
  const now = Date.now();
  const iso = (n) => new Date(now - n * 864e5).toISOString();
  const rateHistory = [];
  for (let n = 189; n >= 0; n--) {
    const d = daysAgo(n);
    const t = 189 - n;
    const bcv = +(134 + t * 0.25 + Math.sin(t / 6) * 0.6).toFixed(2);
    const par = +(bcv * (1.36 + Math.sin(t / 11) * 0.03 + t * 0.0004)).toFixed(2);
    rateHistory.push(
      { rate_type: 'BCV_USD', rate: bcv, rate_date: d, source: 'demo' },
      { rate_type: 'BCV_EUR', rate: +(bcv * 1.138).toFixed(2), rate_date: d, source: 'demo' },
      { rate_type: 'PARALELO', rate: par, rate_date: d, source: 'demo' },
      { rate_type: 'USDT', rate: +(par * 0.992).toFixed(2), rate_date: d, source: 'demo' },
    );
  }
  const { rates } = ratesFromRows(rateHistory);
  const A = { efe: uid(), zel: uid(), bam: uid(), bin: uid(), pm: uid() };
  const accounts = [
    { id: A.efe, name: 'Efectivo', currency: 'USD', kind: 'cash', initial_balance: 120, color: '#CAFFBF', icon: '💵', archived: false, sort_order: 0, created_at: iso(195) },
    { id: A.zel, name: 'Zelle', currency: 'USD', kind: 'digital', initial_balance: 380, color: '#A0C4FF', icon: '📱', archived: false, sort_order: 1, created_at: iso(195) },
    { id: A.bam, name: 'Bancamiga', currency: 'VES', kind: 'bank', initial_balance: 25000, color: '#FFADAD', icon: '🏦', archived: false, sort_order: 2, created_at: iso(195) },
    { id: A.pm, name: 'Pago Móvil', currency: 'VES', kind: 'bank', initial_balance: 4000, color: '#FFD6A5', icon: '📲', archived: false, sort_order: 3, created_at: iso(195) },
    { id: A.bin, name: 'Binance', currency: 'USDT', kind: 'crypto', initial_balance: 350, color: '#FDFFB6', icon: '🪙', archived: false, sort_order: 4, created_at: iso(195) },
  ];
  const txs = [];
  const rateOn = (d, k) => rateHistory.find((r) => r.rate_date === d && r.rate_type === k)?.rate ?? rates[k];
  const add = (n, t) => { const d = daysAgo(n); txs.push({ id: uid(), occurred_on: d, created_at: iso(n), ...t(d) }); };
  const vesPay = (n, ves, acc, cat, desc) => add(n, (d) => {
    const used = rateOn(d, acc === A.bin ? 'USDT' : 'PARALELO');
    return { type: 'expense', account_id: acc, amount: +(ves / used).toFixed(2), category: cat, description: desc,
      original_amount: ves, original_currency: 'VES', rate_applied: used, rate_bcv: rateOn(d, 'BCV_USD'), rate_paralelo: used };
  });

  for (const m of [0, 1, 2, 3, 4, 5]) {
    const base = m * 30;
    const k = 1 + ((m * 7) % 5) / 20; // variación entre meses
    add(base + 1, () => ({ type: 'income', account_id: A.zel, amount: 900, category: 'Sueldo', description: 'Sueldo quincena' }));
    add(base + 15, () => ({ type: 'income', account_id: A.zel, amount: 900, category: 'Sueldo', description: 'Sueldo quincena' }));
    if (m % 2 === 0) add(base + 9, () => ({ type: 'income', account_id: A.bin, amount: 180 + m * 20, category: 'Freelance', description: 'Diseño de logo' }));
    if (m > 0) add(base + 3, () => ({ type: 'expense', account_id: A.zel, amount: 300, category: 'Hogar', description: 'Alquiler' }));
    if (m > 0) add(base + 5, () => ({ type: 'expense', account_id: A.zel, amount: 15.99, category: 'Suscripciones', description: 'Netflix' }));
    add(base + 6, () => ({ type: 'expense', account_id: A.bam, amount: Math.round(4200 * k), category: 'Servicios', description: 'Luz y agua' }));
    add(base + 4, () => ({ type: 'transfer', account_id: A.zel, amount: 150, to_account_id: A.bam, to_amount: +(150 * rateOn(daysAgo(base + 4), 'PARALELO')).toFixed(2), category: 'Cambio de divisa', description: 'Cambio a bolívares' }));
    add(base + 12, () => ({ type: 'transfer', account_id: A.zel, amount: 60, to_account_id: A.pm, to_amount: +(60 * rateOn(daysAgo(base + 12), 'PARALELO')).toFixed(2), category: 'Cambio de divisa', description: 'Recarga Pago Móvil' }));
    add(base + 2, () => ({ type: 'transfer', account_id: A.zel, amount: 550, to_account_id: A.efe, to_amount: 550, category: 'Transferencia interna', description: 'Retiro a efectivo' }));
    add(base + 11, () => ({ type: 'expense', account_id: A.efe, amount: Math.round(70 * k), category: 'Mercado', description: 'Mercado semanal' }));
    add(base + 18, () => ({ type: 'expense', account_id: A.efe, amount: Math.round(58 * k), category: 'Mercado', description: 'Mercado semanal' }));
    add(base + 25, () => ({ type: 'expense', account_id: A.efe, amount: 64, category: 'Mercado', description: 'Mercado semanal' }));
    add(base + 13, () => ({ type: 'expense', account_id: A.pm, amount: Math.round(9000 * k), category: 'Transporte', description: 'Gasolina' }));
    add(base + 21, () => ({ type: 'expense', account_id: A.efe, amount: Math.round(40 * k), category: 'Salidas', description: 'Cine con la familia' }));
    add(base + 16, () => ({ type: 'expense', account_id: A.bin, amount: 50, category: 'Remesas', description: 'Ayuda a la abuela' }));
    add(base + 23, () => ({ type: 'expense', account_id: A.bam, amount: Math.round(6500 * k), category: 'Salud', description: 'Farmacia' }));
    add(base + 20, () => ({ type: 'expense', account_id: A.zel, amount: Math.round(85 * k), category: m % 2 ? 'Ropa' : 'Educación', description: m % 2 ? 'Zapatos' : 'Curso online' }));
    add(base + 7, () => ({ type: 'expense', account_id: A.bam, amount: Math.round(22000 * k), category: 'Mercado', description: 'Supermercado' }));
    add(base + 17, () => ({ type: 'expense', account_id: A.zel, amount: 150, category: 'Remesas', description: 'Ayuda a mamá' }));
    add(base + 26, () => ({ type: 'expense', account_id: A.efe, amount: Math.round(35 * k), category: 'Comida', description: 'Almuerzo' }));
    add(base + 27, () => ({ type: 'expense', account_id: A.efe, amount: 45, category: 'Salidas', description: 'Cumpleaños de la prima' }));
    vesPay(base + 2, 3600, A.efe, 'Comida', 'Arepera');
    vesPay(base + 8, 5200, A.zel, 'Comida', 'Pizza');
    vesPay(base + 14, 4400, A.efe, 'Comida', 'Hamburguesas');
    vesPay(base + 22, 3900, A.efe, 'Comida', 'Panadería');
    vesPay(base + 19, 2900, A.bin, 'Transporte', 'Taxi');
  }
  vesPay(0, 4100, A.efe, 'Comida', 'Panadería');
  for (const t of txs) t.occurred_on > today && (t.occurred_on = today);

  const budgets = [
    { id: uid(), category: 'Comida', monthly_limit: 90, currency: 'USD' },
    { id: uid(), category: 'Mercado', monthly_limit: 220, currency: 'USD' },
    { id: uid(), category: 'Salidas', monthly_limit: 60, currency: 'USD' },
    { id: uid(), category: 'Transporte', monthly_limit: 60, currency: 'USD' },
  ];
  const day = Number(today.slice(8));
  const recurring = [
    { id: uid(), name: 'Alquiler', amount: 300, currency: 'USD', category: 'Hogar', due_day: Math.min(28, day + 2), account_id: A.zel, is_active: true },
    { id: uid(), name: 'Netflix', amount: 15.99, currency: 'USD', category: 'Suscripciones', due_day: Math.min(28, day + 5), account_id: A.zel, is_active: true },
    { id: uid(), name: 'Internet', amount: 4800, currency: 'VES', category: 'Servicios', due_day: Math.max(1, day - 3), account_id: A.bam, is_active: true },
  ];
  // El internet de este mes ya se pagó: queda enlazado al gasto fijo.
  txs.push({ id: uid(), type: 'expense', account_id: A.bam, amount: 4800, category: 'Servicios', description: 'Internet',
    occurred_on: daysAgo(Math.min(3, day - 1)), created_at: iso(2), recurring_id: recurring[2].id });

  return {
    profile: { id: 'demo', display_name: 'Luis', username: 'luis', email: 'demo@lafructosa.app', region: 'VE', preferred_currency: 'USD', valuation_rate: 'BCV_USD' },
    accounts, transactions: txs, budgets, recurring_expenses: recurring, rateHistory,
  };
}

function demoLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(DEMO_KEY));
    if (s?.accounts) return s;
  } catch { /* almacenamiento bloqueado */ }
  const s = seedDemo();
  demoSave(s);
  return s;
}
let demoState;
function demoSave(s = demoState) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ } }
const state = () => (demoState ??= demoLoad());
const wait = (v) => new Promise((r) => setTimeout(() => r(v), 120));
const clone = (v) => JSON.parse(JSON.stringify(v));

const demo = {
  auth: {
    async session() { return { user: { id: 'demo', email: 'demo@lafructosa.app' } }; },
    async onChange() { return { unsubscribe() {} }; },
    async accessToken() { return null; }, // el demo no tiene sesión de Supabase
    async signIn() {}, async signUp() { return { needsConfirm: false }; }, async usernameAvailable(u) { return u !== 'luis'; }, async reset() {}, async updatePassword() {},
    async signOut() { localStorage.removeItem(DEMO_KEY); demoState = null; location.href = location.pathname + '?demo'; },
  },
  async loadAll() {
    const s = state();
    const { rates, meta } = ratesFromRows(s.rateHistory);
    return wait(clone({ profile: s.profile, accounts: s.accounts, transactions: s.transactions, budgets: s.budgets,
      recurring: s.recurring_expenses, rates, rateMeta: meta, rateHistory: s.rateHistory, missing: [] }));
  },
  async updateProfile(patch) { Object.assign(state().profile, patch); demoSave(); return wait(clone(state().profile)); },
  async insert(table, row) {
    const r = { id: uid(), created_at: new Date().toISOString(), ...row };
    state()[table].push(r); demoSave(); return wait(clone(r));
  },
  async update(table, id, patch) {
    const r = state()[table].find((x) => x.id === id);
    if (!r) throw new Error('No encontrado');
    Object.assign(r, patch); demoSave(); return wait(clone(r));
  },
  async remove(table, id) {
    const s = state();
    s[table] = s[table].filter((x) => x.id !== id);
    if (table === 'accounts') s.transactions = s.transactions.filter((t) => t.account_id !== id && t.to_account_id !== id);
    demoSave(); return wait();
  },
  reset() { localStorage.removeItem(DEMO_KEY); demoState = null; },
};

export const api = isDemo ? demo : real;
