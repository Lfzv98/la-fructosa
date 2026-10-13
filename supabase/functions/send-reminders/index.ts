// La Fructosa · Edge Function "send-reminders"
// Envía avisos al teléfono (notificaciones push) una vez al día:
//   · Pagos fijos que vencen hoy o mañana y aún no se han pagado este mes
//   · Préstamos que vencen hoy
//   · Tasas del día (opcional, solo Venezuela)
//   · Dólar BCV o USDT que se movió 3% o más desde el día anterior (solo Venezuela)
//   · Presupuesto: cuando una categoría llega al 80% o se pasa del tope del mes
//   · Respaldo semanal en PDF
//   · Si llevas 3 o 7 días sin anotar nada
// Cada persona decide qué avisos recibe en Ajustes → Avisos. Solo se envían los datos de su dueño.
//
// Configurar (una sola vez):
//   1. npx web-push generate-vapid-keys
//   2. supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu-correo CRON_SECRET=una-clave-larga
//   3. supabase functions deploy send-reminders --no-verify-jwt
//   4. Edita y ejecuta supabase/migrations/008_avisos.sql (programa el envío diario).
//
// GET  → devuelve la clave pública VAPID (es pública por diseño; la app la usa para suscribirse).
// POST → envía los avisos del día. Exige el encabezado x-cron-secret = CRON_SECRET.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
const SECRET = Deno.env.get('CRON_SECRET') ?? '';
if (PUBLIC && PRIVATE) webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const SYMBOL: Record<string, string> = { USD: '$', VES: 'Bs.', USDT: 'USDT', EUR: '€' };
const money = (n: number, c: string) =>
  `${SYMBOL[c] ?? c} ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: c === 'VES' ? 0 : 2, maximumFractionDigits: 2 }).format(n)}`;
const rate = (n: number) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function caracasToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
}
const addDays = (iso: string, k: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const daysInMonth = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
// Día de pago real de un fijo en un mes (31 en febrero → 28/29).
export const dueDate = (ym: string, day: number) => `${ym}-${String(Math.min(day, daysInMonth(ym))).padStart(2, '0')}`;

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; prefs: { bills?: boolean; loans?: boolean; rates?: boolean; backup?: boolean; budget?: boolean; moves?: boolean; activity?: boolean } | null; created_at?: string; last_backup_on?: string | null };
type Budget = { category: string; monthly_limit: number; currency: string };
// Gasto por categoría del mes: before = registrado hasta hace 24 h; now = incluye lo de ayer.
type Spend = Record<string, { before: number; now: number }>;
type Rates = Record<string, number>;
// Convierte con las tasas del día (VES por unidad). USD y USDT se toman 1:1 si falta la tasa del USDT.
export function convert(n: number, from: string, to: string, r: Rates): number | null {
  if (from === to) return n;
  const ves = (c: string) => (c === 'VES' ? 1 : c === 'USD' ? r.BCV_USD : c === 'EUR' ? r.BCV_EUR : c === 'USDT' ? (r.USDT || r.BCV_USD) : undefined);
  if ((from === 'USD' && to === 'USDT') || (from === 'USDT' && to === 'USD')) return r.USDT && r.BCV_USD ? n * ves(from)! / ves(to)! : n;
  const a = ves(from), b = ves(to);
  return a && b ? (n * a) / b : null;
}
const pct = (n: number) => new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 }).format(n);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

type Recurring = { id: string; user_id: string; name: string; amount: number; currency: string; due_day: number; is_active: boolean };

// Arma los avisos de una persona. Exportada para probarla sin enviar nada.
export function buildMessages(input: {
  today: string; prefs: Sub['prefs']; region?: string;
  recurring: Recurring[]; paidRecurringIds: Set<string>;
  loans: { person: string; direction: string; amount: number; paid_amount: number; currency: string; due_on: string | null; settled: boolean }[];
  rates?: Record<string, number>;
  lastBackup?: string | null; since?: string | null;
  budgets?: Budget[]; spend?: Spend;
  prevRates?: Rates; lastLogged?: string | null;
}) {
  const { today, recurring, paidRecurringIds, loans } = input;
  const prefs = { bills: true, loans: true, rates: false, backup: true, budget: true, moves: true, activity: true, ...(input.prefs ?? {}) };
  const ve = (input.region ?? 'VE') === 'VE';
  const out: { title: string; body: string; url: string; tag: string }[] = [];
  const ym = today.slice(0, 7);
  const tomorrow = addDays(today, 1);

  if (prefs.bills) {
    const due = recurring.filter((r) => r.is_active !== false && !paidRecurringIds.has(r.id)).map((r) => {
      // El de mañana puede caer en el mes siguiente (p. ej. hoy 31, mañana 1).
      const d = [dueDate(ym, r.due_day), dueDate(tomorrow.slice(0, 7), r.due_day)].find((x) => x === today || x === tomorrow);
      return d ? { r, when: d === today ? 'Hoy' : 'Mañana' } : null;
    }).filter(Boolean) as { r: Recurring; when: string }[];
    if (due.length) {
      out.push({
        title: due.length === 1 ? `${due[0].r.name} vence ${due[0].when.toLowerCase()}` : `${due.length} pagos por vencer`,
        body: due.map(({ r, when }) => `${when}: ${r.name} · ${money(Number(r.amount), r.currency)}`).join('\n'),
        url: './#/fijos', tag: 'bills-' + today,
      });
    }
  }
  if (prefs.loans) {
    const due = loans.filter((l) => !l.settled && l.due_on === today);
    if (due.length) {
      out.push({
        title: due.length === 1 ? 'Hoy vence un préstamo' : `Hoy vencen ${due.length} préstamos`,
        body: due.map((l) => `${l.person} ${l.direction === 'lent' ? 'te debe' : '· le debes'} ${money(Math.max(0, Number(l.amount) - Number(l.paid_amount)), l.currency)}`).join('\n'),
        url: './#/prestamos', tag: 'loans-' + today,
      });
    }
  }
  // Movimiento fuerte del dólar: 3% o más frente a la tasa anterior (BCV o USDT). Solo Venezuela.
  if (prefs.moves && ve && input.rates && input.prevRates) {
    const lines = (['BCV_USD', 'USDT'] as const).map((k) => {
      const a = input.prevRates![k], b = input.rates![k];
      if (!a || !b) return null;
      const ch = ((b - a) / a) * 100;
      return Math.abs(ch) >= 3 ? `${k === 'BCV_USD' ? 'Dólar BCV' : 'USDT'} ${ch > 0 ? 'subió' : 'bajó'} ${pct(Math.abs(ch))}%: ${rate(a)} → ${rate(b)}` : null;
    }).filter(Boolean) as string[];
    if (lines.length) out.push({ title: 'El dólar se movió fuerte', body: lines.join('\n') + '\nSi vas a pagar en bolívares, revisa la brecha antes.', url: './#/tasas', tag: 'moves-' + today });
  }
  if (prefs.rates && ve && input.rates?.BCV_USD) {
    const r = input.rates;
    const gap = r.PARALELO ? ((r.PARALELO - r.BCV_USD) / r.BCV_USD) * 100 : null;
    out.push({
      title: 'Tasas de hoy',
      body: [`BCV ${rate(r.BCV_USD)}`, r.PARALELO && `Paralelo ${rate(r.PARALELO)}`, r.USDT && `USDT ${rate(r.USDT)}`, gap != null && `Brecha ${rate(gap)}%`].filter(Boolean).join(' · '),
      url: './#/tasas', tag: 'rates-' + today,
    });
  }
  // Presupuesto: avisa una sola vez al cruzar el 80% y otra al pasar el 100% (comparado con hace 24 h).
  if (prefs.budget && input.budgets?.length && input.spend) {
    const hits: string[] = [];
    let over = false;
    for (const b of input.budgets) {
      const s = input.spend[b.category + '|' + b.currency];
      if (!s) continue;
      const lim = Number(b.monthly_limit);
      const was = s.before / lim, is = s.now / lim;
      if (is >= 1 && was < 1) { over = true; hits.push(`${b.category}: te pasaste del tope (${money(s.now, b.currency)} de ${money(lim, b.currency)})`); }
      else if (is >= 0.8 && was < 0.8 && is < 1) hits.push(`${b.category}: ya vas en ${Math.round(is * 100)}% (${money(s.now, b.currency)} de ${money(lim, b.currency)})`);
    }
    if (hits.length) out.push({ title: over ? 'Te pasaste de un presupuesto' : 'Cuidado con tu presupuesto', body: hits.join('\n'), url: './#/presupuestos', tag: 'budget-' + today });
  }
  // Constancia: a los 3 y a los 7 días sin anotar nada (un empujón amable, no más).
  const lastLog = input.lastLogged || input.since?.slice(0, 10);
  if (prefs.activity && lastLog) {
    const days = daysBetween(lastLog, today);
    if (days === 3 || days === 7) out.push({
      title: days === 3 ? '¿Anotamos lo de estos días?' : 'Una semana sin anotar',
      body: days === 3 ? 'Llevas 3 días sin registrar movimientos. Un minuto hoy y tus números siguen al día.' : 'Retomarlo es fácil: anota hoy lo que recuerdes y sigue de a poco. La constancia es la que hace la diferencia.',
      url: './#/nuevo', tag: 'activity-' + today,
    });
  }
  // Respaldo: a los 7 días sin descargar el PDF o el Excel, y luego cada 3 días hasta que lo haga.
  const base = input.lastBackup || input.since?.slice(0, 10);
  if (prefs.backup && base) {
    const days = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(base + 'T12:00:00Z')) / 86400000);
    if (days >= 7 && (days - 7) % 3 === 0) {
      out.push({
        title: 'Es hora de tu respaldo semanal',
        body: input.lastBackup ? `Han pasado ${days} días. Descarga tu registro en PDF y guárdalo en tu carpeta "Mis Finanzas".` : 'Aún no tienes respaldo. Descarga tu registro en PDF (Ajustes › Respaldo) y guárdalo en tu carpeta "Mis Finanzas".',
        url: './#/ajustes', tag: 'backup-' + today,
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method === 'GET') return Response.json({ publicKey: PUBLIC || null }, { headers: { ...CORS, 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  if (!SECRET || req.headers.get('x-cron-secret') !== SECRET) return new Response('No autorizado', { status: 401 });
  if (!PUBLIC || !PRIVATE) return Response.json({ ok: false, error: 'Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY' }, { status: 503 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const today = caracasToday();
  const ym = today.slice(0, 7);

  // last_backup_on llega con la migración 009; si aún no se corrió, se sigue sin él.
  let { data: subs, error } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, prefs, created_at, last_backup_on');
  if (error) ({ data: subs, error } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, prefs, created_at'));
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const users = [...new Set((subs ?? []).map((s: Sub) => s.user_id))];
  if (!users.length) return Response.json({ ok: true, sent: 0 });

  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [rec, paid, loans, profiles, rateRows, budgets, accs, monthTx, recentTx] = await Promise.all([
    db.from('recurring_expenses').select('id, user_id, name, amount, currency, due_day, is_active').in('user_id', users).eq('is_active', true),
    db.from('transactions').select('recurring_id').in('user_id', users).not('recurring_id', 'is', null).gte('occurred_on', ym + '-01'),
    db.from('loans').select('user_id, person, direction, amount, paid_amount, currency, due_on, settled').in('user_id', users).eq('settled', false).eq('due_on', today),
    db.from('profiles').select('id, region').in('id', users),
    db.from('exchange_rates').select('rate_type, rate, rate_date').gte('rate_date', addDays(today, -7)).order('rate_date'),
    db.from('budgets').select('user_id, category, monthly_limit, currency').in('user_id', users),
    db.from('accounts').select('id, currency').in('user_id', users),
    db.from('transactions').select('user_id, account_id, amount, category, created_at').in('user_id', users).eq('type', 'expense').gte('occurred_on', ym + '-01'),
    db.from('transactions').select('user_id, created_at').in('user_id', users).gte('created_at', addDays(today, -8) + 'T00:00:00Z'),
  ]);
  const paidIds = new Set((paid.data ?? []).map((t: { recurring_id: string }) => t.recurring_id));
  const rates: Record<string, number> = {};
  const prevRates: Record<string, number> = {};
  const lastDate: Record<string, string> = {};
  for (const r of rateRows.data ?? []) { // en orden de fecha: la más reciente queda al final
    if (lastDate[r.rate_type] && lastDate[r.rate_type] !== r.rate_date) prevRates[r.rate_type] = rates[r.rate_type];
    rates[r.rate_type] = Number(r.rate); lastDate[r.rate_type] = r.rate_date;
  }
  // Solo cuenta como "movimiento fuerte" si la tasa más reciente es de hoy (no repetir el aviso).
  for (const k of Object.keys(prevRates)) if (lastDate[k] !== today) delete prevRates[k];
  const accCur = Object.fromEntries((accs.data ?? []).map((a: { id: string; currency: string }) => [a.id, a.currency]));
  const lastLogged: Record<string, string> = {};
  for (const t of recentTx.data ?? []) {
    const d = new Date(t.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
    if (!lastLogged[t.user_id] || d > lastLogged[t.user_id]) lastLogged[t.user_id] = d;
  }
  // Gasto por categoría en la moneda de cada presupuesto (presupuestos no disponibles: se omite).
  const spendOf = (uid: string): Spend => {
    const out: Spend = {};
    const mine = (budgets.data ?? []).filter((b: { user_id: string }) => b.user_id === uid) as (Budget & { user_id: string })[];
    if (!mine.length) return out;
    for (const t of (monthTx.data ?? []) as { user_id: string; account_id: string; amount: number; category: string; created_at: string }[]) {
      if (t.user_id !== uid) continue;
      for (const b of mine.filter((x) => x.category === t.category)) {
        const v = convert(Number(t.amount), accCur[t.account_id] ?? b.currency, b.currency, rates);
        if (v == null) continue;
        const k = b.category + '|' + b.currency;
        out[k] ??= { before: 0, now: 0 };
        out[k].now += v;
        if (t.created_at < since24) out[k].before += v;
      }
    }
    return out;
  };
  const region = Object.fromEntries((profiles.data ?? []).map((p: { id: string; region: string }) => [p.id, p.region]));

  let sent = 0, removed = 0, failed = 0;
  for (const s of (subs ?? []) as Sub[]) {
    const msgs = buildMessages({
      today, prefs: s.prefs, region: region[s.user_id],
      recurring: (rec.data ?? []).filter((r: Recurring) => r.user_id === s.user_id),
      paidRecurringIds: paidIds,
      loans: (loans.data ?? []).filter((l: { user_id: string }) => l.user_id === s.user_id),
      rates: rateRows.error ? undefined : rates,
      lastBackup: s.last_backup_on ?? null, since: s.created_at ?? null,
      budgets: ((budgets.data ?? []) as (Budget & { user_id: string })[]).filter((b) => b.user_id === s.user_id),
      spend: budgets.error || monthTx.error ? undefined : spendOf(s.user_id),
      prevRates: rateRows.error ? undefined : prevRates,
      lastLogged: recentTx.error ? undefined : lastLogged[s.user_id] ?? null,
    });
    for (const m of msgs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(m), { TTL: 12 * 3600, urgency: 'normal' });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('id', s.id); removed++; break; } // el teléfono ya no existe o canceló
        failed++;
        console.error('send-reminders', code ?? String(e)); // nunca se registra el contenido
      }
    }
  }
  await db.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).in('user_id', users);
  return Response.json({ ok: true, date: today, sent, removed, failed });
});
