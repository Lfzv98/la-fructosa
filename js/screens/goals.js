// Metas de ahorro y préstamos entre familiares/amigos.
// No mueven dinero de tus cuentas: son un registro para saber cuánto llevas y quién te debe.
import { useState } from 'react';
import { html, Icon, Money, Sheet, Field, Segmented, Empty, Progress, SectionTitle, toast, confirmDialog, errorText, vibrate } from '../ui.js';
import { useData } from '../store.js';
import { PageHeader } from './common.js';
import { CURRENCIES, convert, fmt, parseAmount, todayISO } from '../money.js';

const n = (v) => Number(v) || 0;
const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const monthsUntil = (iso) => {
  if (!iso) return null;
  const a = new Date(todayISO() + 'T12:00:00Z'), b = new Date(iso + 'T12:00:00Z');
  return Math.max(0, (b - a) / (30.44 * 864e5));
};
const EMOJIS = ['🎯', '🛟', '✈️', '🏠', '🚗', '🎓', '💻', '📱', '💍', '🎁', '🏔️', '🍼'];

function Missing({ title }) {
  return html`<div class="page"><${PageHeader} title=${title} back="#/mas" />
    <${Empty} art="database" title=${`Falta activar ${title.toLowerCase()}`} text="Ejecuta supabase/migrations/007_metas_prestamos.sql en el SQL Editor de Supabase y recarga." /></div>`;
}

function AmountInput({ currency, value, onChange, placeholder = '0' }) {
  return html`<div class="input-affix"><span>${CURRENCIES[currency]?.symbol || ''}</span>
    <input class="input num" inputmode="decimal" placeholder=${placeholder} value=${value} onInput=${(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} /></div>`;
}

// ---------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------
export function Goals() {
  const { goals, missing, target, rates, val } = useData();
  const [form, setForm] = useState(null);
  const [add, setAdd] = useState(null);
  if (missing.includes('savings_goals')) return html`<${Missing} title="Metas" />`;

  const active = goals.filter((g) => !g.done);
  const done = goals.filter((g) => g.done);
  const tot = (k) => active.reduce((s, g) => s + (convert(n(g[k]), g.currency, target, rates, val) ?? 0), 0);

  return html`<div class="page">
    <${PageHeader} title="Metas de ahorro" back="#/mas" actions=${html`
      <button class="btn sm primary" onClick=${() => setForm({})}><${Icon} name="plus" size=${16} /> Nueva</button>`} />

    ${active.length > 0 && html`<section class="card pad stack sm">
      <div class="row-between"><span class="muted">Ahorrado para tus metas</span>
        <span class="num"><b><${Money} v=${tot('saved_amount')} c=${target} /></b> / <${Money} v=${tot('target_amount')} c=${target} /></span></div>
      <${Progress} value=${tot('saved_amount') / (tot('target_amount') || 1)} />
    </section>`}

    ${goals.length === 0
      ? html`<${Empty} art="target" title="Ponle nombre a tu ahorro" text="Fondo de emergencia, un viaje, un teléfono… Crea una meta y ve sumando lo que apartas."
          action=${html`<button class="btn primary" onClick=${() => setForm({})}>Crear meta</button>`} />`
      : html`<div class="stack sm">${active.map((g) => {
          const ratio = n(g.saved_amount) / n(g.target_amount);
          const left = Math.max(0, n(g.target_amount) - n(g.saved_amount));
          const m = monthsUntil(g.target_date);
          const perMonth = m != null && m > 0.5 ? left / m : null;
          return html`<div key=${g.id} class="card pad goal-card">
            <button class="goal-main" onClick=${() => setForm(g)}>
              <span class="goal-emoji">${g.emoji || '🎯'}</span>
              <span class="grow"><b>${g.name}</b><small class="muted">${g.target_date ? 'Para el ' + dmy(g.target_date) : 'Sin fecha'}</small></span>
              <span class="num goal-pct">${Math.min(100, Math.round(ratio * 100))}%</span>
            </button>
            <${Progress} value=${ratio} />
            <div class="row-between goal-foot">
              <span class="num"><b><${Money} v=${n(g.saved_amount)} c=${g.currency} /></b> <span class="muted">de <${Money} v=${n(g.target_amount)} c=${g.currency} /></span></span>
              <button class="btn sm soft" onClick=${() => setAdd(g)}><${Icon} name="plus" size=${14} /> Abonar</button>
            </div>
            ${left > 0 && html`<p class="hint">${perMonth ? html`Te faltan <b class="num">${fmt(left, g.currency)}</b>: unos <b class="num">${fmt(perMonth, g.currency)}</b> al mes para llegar a tiempo.` : html`Te faltan <b class="num">${fmt(left, g.currency)}</b>.`}</p>`}
          </div>`;
        })}</div>`}

    ${done.length > 0 && html`<section>
      <${SectionTitle}>Cumplidas 🎉<//>
      <div class="card list">${done.map((g) => html`<button key=${g.id} class="tx-row" onClick=${() => setForm(g)}>
        <span class="tx-ico">${g.emoji || '🎯'}</span><span class="tx-main"><b>${g.name}</b><small>${fmt(n(g.target_amount), g.currency)}</small></span>
        <${Icon} name="check" class="muted" /></button>`)}</div>
    </section>`}

    <p class="hint center">Las metas no mueven dinero de tus cuentas: anota aquí lo que vas apartando.</p>
    ${form && html`<${GoalForm} goal=${form.id ? form : null} onClose=${() => setForm(null)} />`}
    ${add && html`<${GoalDeposit} goal=${add} onClose=${() => setAdd(null)} />`}
  </div>`;
}

function GoalForm({ goal, onClose }) {
  const { actions, target, region } = useData();
  const editing = Boolean(goal);
  const [name, setName] = useState(goal?.name || '');
  const [emoji, setEmoji] = useState(goal?.emoji || '🎯');
  const [currency, setCurrency] = useState(goal?.currency || target);
  const [amount, setAmount] = useState(goal ? String(n(goal.target_amount)).replace('.', ',') : '');
  const [saved, setSaved] = useState(goal ? String(n(goal.saved_amount)).replace('.', ',') : '');
  const [date, setDate] = useState(goal?.target_date || '');
  const [err, setErr] = useState('');

  async function submit(close) {
    const t = parseAmount(amount); const s = saved ? parseAmount(saved) : 0;
    if (!name.trim()) return setErr('Ponle un nombre a la meta.');
    if (!(t > 0)) return setErr('Escribe cuánto quieres ahorrar.');
    if (!(s >= 0)) return setErr('Lo ahorrado no es válido.');
    try {
      await actions.save('savings_goals', { name: name.trim(), emoji, currency, target_amount: t, saved_amount: s, target_date: date || null, done: s >= t }, goal?.id);
      close(); toast(editing ? 'Meta actualizada' : 'Meta creada');
    } catch (e) { setErr(errorText(e)); }
  }
  async function remove(close) {
    if (!(await confirmDialog({ title: `¿Eliminar la meta "${goal.name}"?`, confirm: 'Eliminar', tone: 'danger' }))) return;
    await actions.remove('savings_goals', goal.id); close(); toast('Meta eliminada');
  }

  return html`<${Sheet} title=${editing ? 'Editar meta' : 'Nueva meta'} onClose=${onClose}
    footer=${(close) => html`<div class="foot-row">
      ${editing && html`<button class="btn ghost danger-text" onClick=${() => remove(close)} aria-label="Eliminar"><${Icon} name="trash" size=${18} /></button>`}
      <button class="btn primary grow" onClick=${() => submit(close)}>${editing ? 'Guardar' : 'Crear meta'}</button></div>`}>
    <div class="stack">
      <${Field} label="¿Para qué ahorras?"><input class="input" maxLength="60" placeholder="Ej. Fondo de emergencia" value=${name} onInput=${(e) => { setName(e.target.value); setErr(''); }} /><//>
      <div class="emoji-pick">${EMOJIS.map((e) => html`<button key=${e} type="button" class=${'chip' + (emoji === e ? ' on' : '')} onClick=${() => setEmoji(e)}>${e}</button>`)}</div>
      <${Field} label="Moneda"><${Segmented} value=${currency} onChange=${setCurrency} options=${region.currencies.map((c) => [c, c])} /><//>
      <${Field} label="Meta"><${AmountInput} currency=${currency} value=${amount} onChange=${(v) => { setAmount(v); setErr(''); }} /><//>
      <${Field} label="Ya tengo ahorrado" hint="Opcional. Luego vas sumando con Abonar."><${AmountInput} currency=${currency} value=${saved} onChange=${setSaved} /><//>
      <${Field} label="¿Para cuándo?" hint="Opcional. Te diremos cuánto apartar al mes."><input class="input" type="date" min=${todayISO()} value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
      ${err && html`<p class="form-error">${err}</p>`}
    </div>
  <//>`;
}

function GoalDeposit({ goal, onClose }) {
  const { actions } = useData();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('add');
  const [err, setErr] = useState('');
  async function submit(close) {
    const v = parseAmount(amount);
    if (!(v > 0)) return setErr('Escribe un monto mayor que cero.');
    const saved = Math.max(0, n(goal.saved_amount) + (mode === 'add' ? v : -v));
    try {
      await actions.save('savings_goals', { saved_amount: saved, done: saved >= n(goal.target_amount) }, goal.id);
      close(); vibrate();
      toast(saved >= n(goal.target_amount) ? `🎉 ¡Cumpliste tu meta "${goal.name}"!` : `${mode === 'add' ? 'Abonaste' : 'Retiraste'} ${fmt(v, goal.currency)}`);
    } catch (e) { setErr(errorText(e)); }
  }
  return html`<${Sheet} title=${goal.name} onClose=${onClose}
    footer=${(close) => html`<button class="btn primary block" onClick=${() => submit(close)}>${mode === 'add' ? 'Abonar' : 'Retirar'}</button>`}>
    <div class="stack">
      <${Segmented} value=${mode} onChange=${setMode} options=${[['add', 'Abonar'], ['take', 'Retirar']]} />
      <${Field} label="Monto"><${AmountInput} currency=${goal.currency} value=${amount} onChange=${(v) => { setAmount(v); setErr(''); }} /><//>
      ${err && html`<p class="form-error">${err}</p>`}
    </div>
  <//>`;
}

// ---------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------
export function Loans() {
  const { loans, missing, target, rates, val } = useData();
  const [form, setForm] = useState(null);
  const [pay, setPay] = useState(null);
  if (missing.includes('loans')) return html`<${Missing} title="Préstamos" />`;

  const open = loans.filter((l) => !l.settled);
  const closed = loans.filter((l) => l.settled);
  const sum = (dir) => open.filter((l) => l.direction === dir)
    .reduce((s, l) => s + (convert(Math.max(0, n(l.amount) - n(l.paid_amount)), l.currency, target, rates, val) ?? 0), 0);
  const today = todayISO();

  const row = (l) => {
    const left = Math.max(0, n(l.amount) - n(l.paid_amount));
    const late = !l.settled && l.due_on && l.due_on < today;
    return html`<div key=${l.id} class="loan-row">
      <button class="tx-row" onClick=${() => setForm(l)}>
        <span class=${'tx-ico loan-ico ' + l.direction}>${l.direction === 'lent' ? '↗' : '↙'}</span>
        <span class="tx-main"><b>${l.person}</b>
          <small>${l.settled ? (l.direction === 'lent' ? 'Te pagó' : 'Le pagaste') + ' ' + fmt(n(l.amount), l.currency) : l.direction === 'lent' ? 'Te debe' : 'Le debes'}${l.due_on ? ' · vence ' + dmy(l.due_on) : ''}${late ? html` · <span class="neg">vencido</span>` : ''}${l.note ? ' · ' + l.note : ''}</small></span>
        <span class="tx-amt num ${l.direction === 'lent' ? 'pos' : 'neg'}">${l.settled ? '✓' : fmt(left, l.currency)}</span>
      </button>
      ${!l.settled && html`<button class="btn sm soft loan-pay" onClick=${() => setPay(l)}>${l.direction === 'lent' ? 'Me pagó' : 'Pagué'}</button>`}
    </div>`;
  };

  return html`<div class="page">
    <${PageHeader} title="Préstamos" back="#/mas" actions=${html`
      <button class="btn sm primary" onClick=${() => setForm({})}><${Icon} name="plus" size=${16} /> Nuevo</button>`} />

    ${open.length > 0 && html`<section class="loan-sum">
      <div class="card pad"><small class="muted">Te deben</small><b class="num pos"><${Money} v=${sum('lent')} c=${target} /></b></div>
      <div class="card pad"><small class="muted">Debes</small><b class="num neg"><${Money} v=${sum('borrowed')} c=${target} /></b></div>
    </section>`}

    ${loans.length === 0
      ? html`<${Empty} art="coins" title="¿Le prestaste a alguien?" text="Anota lo que prestas y lo que te prestan, con fecha y abonos, para que nadie se olvide."
          action=${html`<button class="btn primary" onClick=${() => setForm({})}>Anotar préstamo</button>`} />`
      : html`${open.length > 0 && html`<div class="card list">${open.map(row)}</div>`}
        ${closed.length > 0 && html`<section><${SectionTitle}>Saldados<//><div class="card list">${closed.map(row)}</div></section>`}`}

    <p class="hint center">Los préstamos no cambian el saldo de tus cuentas. Si el dinero salió o entró de una cuenta, regístralo también como gasto, ingreso o transferencia.</p>
    ${form && html`<${LoanForm} loan=${form.id ? form : null} onClose=${() => setForm(null)} />`}
    ${pay && html`<${LoanPayment} loan=${pay} onClose=${() => setPay(null)} />`}
  </div>`;
}

function LoanForm({ loan, onClose }) {
  const { actions, target, region } = useData();
  const editing = Boolean(loan);
  const [direction, setDirection] = useState(loan?.direction || 'lent');
  const [person, setPerson] = useState(loan?.person || '');
  const [currency, setCurrency] = useState(loan?.currency || target);
  const [amount, setAmount] = useState(loan ? String(n(loan.amount)).replace('.', ',') : '');
  const [date, setDate] = useState(loan?.occurred_on || todayISO());
  const [due, setDue] = useState(loan?.due_on || '');
  const [note, setNote] = useState(loan?.note || '');
  const [err, setErr] = useState('');

  async function submit(close) {
    const v = parseAmount(amount);
    if (!person.trim()) return setErr('¿A quién le prestaste o quién te prestó?');
    if (!(v > 0)) return setErr('Escribe un monto mayor que cero.');
    const paid = n(loan?.paid_amount);
    try {
      await actions.save('loans', { direction, person: person.trim(), currency, amount: v, occurred_on: date || todayISO(), due_on: due || null,
        note: note.trim() || null, settled: paid >= v }, loan?.id);
      close(); toast(editing ? 'Préstamo actualizado' : 'Préstamo anotado');
    } catch (e) { setErr(errorText(e)); }
  }
  async function remove(close) {
    if (!(await confirmDialog({ title: `¿Eliminar el préstamo con ${loan.person}?`, confirm: 'Eliminar', tone: 'danger' }))) return;
    await actions.remove('loans', loan.id); close(); toast('Préstamo eliminado');
  }

  return html`<${Sheet} title=${editing ? 'Editar préstamo' : 'Nuevo préstamo'} onClose=${onClose}
    footer=${(close) => html`<div class="foot-row">
      ${editing && html`<button class="btn ghost danger-text" onClick=${() => remove(close)} aria-label="Eliminar"><${Icon} name="trash" size=${18} /></button>`}
      <button class="btn primary grow" onClick=${() => submit(close)}>${editing ? 'Guardar' : 'Anotar'}</button></div>`}>
    <div class="stack">
      <${Segmented} value=${direction} onChange=${setDirection} options=${[['lent', 'Le presté'], ['borrowed', 'Me prestó']]} />
      <${Field} label="Persona"><input class="input" maxLength="60" placeholder="Ej. Primo Andrés" value=${person} onInput=${(e) => { setPerson(e.target.value); setErr(''); }} /><//>
      <${Field} label="Moneda"><${Segmented} value=${currency} onChange=${setCurrency} options=${region.currencies.map((c) => [c, c])} /><//>
      <${Field} label="Monto"><${AmountInput} currency=${currency} value=${amount} onChange=${(v) => { setAmount(v); setErr(''); }} /><//>
      ${editing && n(loan.paid_amount) > 0 && html`<p class="hint">Abonado hasta ahora: <b class="num">${fmt(n(loan.paid_amount), loan.currency)}</b></p>`}
      <div class="row-btns">
        <${Field} label="Fecha"><input class="input" type="date" max=${todayISO()} value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
        <${Field} label="Vence (opcional)"><input class="input" type="date" value=${due} onInput=${(e) => setDue(e.target.value)} /><//>
      </div>
      <${Field} label="Nota (opcional)"><input class="input" maxLength="200" placeholder="Ej. Para el repuesto del carro" value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
      ${err && html`<p class="form-error">${err}</p>`}
    </div>
  <//>`;
}

function LoanPayment({ loan, onClose }) {
  const { actions } = useData();
  const left = Math.max(0, n(loan.amount) - n(loan.paid_amount));
  const [amount, setAmount] = useState(String(left).replace('.', ','));
  const [err, setErr] = useState('');
  async function submit(close) {
    const v = parseAmount(amount);
    if (!(v > 0)) return setErr('Escribe un monto mayor que cero.');
    const paid = Math.min(n(loan.amount), n(loan.paid_amount) + v);
    try {
      await actions.save('loans', { paid_amount: paid, settled: paid >= n(loan.amount) }, loan.id);
      close(); vibrate();
      toast(paid >= n(loan.amount) ? `✓ Préstamo con ${loan.person} saldado` : `Abono de ${fmt(v, loan.currency)} anotado`);
    } catch (e) { setErr(errorText(e)); }
  }
  return html`<${Sheet} title=${loan.direction === 'lent' ? `${loan.person} te pagó` : `Le pagaste a ${loan.person}`} onClose=${onClose}
    footer=${(close) => html`<button class="btn primary block" onClick=${() => submit(close)}>Anotar abono</button>`}>
    <div class="stack">
      <p class="hint">Queda pendiente <b class="num">${fmt(left, loan.currency)}</b> de ${fmt(n(loan.amount), loan.currency)}.</p>
      <${Field} label="¿Cuánto?"><${AmountInput} currency=${loan.currency} value=${amount} onChange=${(v) => { setAmount(v); setErr(''); }} /><//>
      ${err && html`<p class="form-error">${err}</p>`}
    </div>
  <//>`;
}
