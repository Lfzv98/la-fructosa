// Cuentas: lista, distribución por moneda, detalle, crear/editar/archivar/eliminar y ajuste de saldo.
import { useMemo, useState } from 'react';
import { html, Icon, Money, Sheet, Field, Segmented, Empty, SectionTitle, toast, confirmDialog, errorText, vibrate } from '../ui.js';
import { useData } from '../store.js';
import { Learn } from '../learn.js';
import { AccountRow, TxRow, PageHeader, openTx, go } from './common.js';
import {
  ACCOUNT_COLORS, ACCOUNT_TEMPLATES, ADJUST_CATEGORY, bankGroupsFor, CURRENCIES, KINDS, VE_BANKS, convert, fmt, parseAmount, todayISO, monthKey,
} from '../money.js';

const ICONS = ['💵', '🏦', '📱', '📲', '🪙', '💳', '🐷', '💼', '🏠', '✈️', '🎓', '💰'];

export function Accounts({ query }) {
  const { accounts, active, target, rates, val, total, region } = useData();
  const [form, setForm] = useState(query.get('nueva') ? {} : null);
  const [showArchived, setShowArchived] = useState(false);
  const archived = accounts.filter((a) => a.archived);

  // Distribución del patrimonio por moneda (diversificación).
  const byCur = useMemo(() => {
    const m = {};
    for (const a of active) {
      const v = convert(a.balance, a.currency, target, rates, val);
      if (v != null && v > 0) m[a.currency] = (m[a.currency] || 0) + v;
    }
    const sum = Object.values(m).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ c, v, pct: (v / sum) * 100 }));
  }, [active, rates, target, val]);
  const curColor = { USD: '#CAFFBF', VES: '#FFADAD', USDT: '#FDFFB6', EUR: '#A0C4FF' };

  return html`<div class="page">
    <${PageHeader} title="Cuentas" sub=${`${active.length} activa${active.length === 1 ? '' : 's'}`} actions=${html`
      <button class="btn sm primary" onClick=${() => setForm({})}><${Icon} name="plus" size=${16} /> Nueva</button>`} />

    ${active.length > 0 && html`<section class="card pad stack sm">
      <div class="row-between"><span class="muted">Total consolidado</span><b class="num big"><${Money} v=${total.total} c=${target} /></b></div>
      <div class="stackbar">${byCur.map((x) => html`<i key=${x.c} style=${{ width: x.pct + '%', background: curColor[x.c] }}></i>`)}</div>
      <div class="legend">${byCur.map((x) => html`<span key=${x.c}><i style=${{ background: curColor[x.c] }}></i>${x.c} ${x.pct.toFixed(0)}%</span>`)}</div>
      ${byCur.length === 1 && byCur[0].c === 'VES' && html`<p class="hint">💡 Todo tu dinero está en bolívares. Tener parte en divisas te protege de la inflación.</p>`}
    </section>`}

    ${active.length === 0
      ? html`<${Empty} art="bank" title="Sin cuentas todavía" text=${`Crea una cuenta por cada lugar donde guardas dinero: ${region.examples}`}
          action=${html`<button class="btn primary" onClick=${() => setForm({})}>Crear cuenta</button>`} />`
      : html`<div class="card list">${active.map((a) => html`<${AccountRow} key=${a.id} a=${a} target=${target}
          converted=${convert(a.balance, a.currency, target, rates, val)} onClick=${() => go('#/cuenta/' + a.id)} />`)}</div>`}

    ${archived.length > 0 && html`<section>
      <button class="link" onClick=${() => setShowArchived(!showArchived)}>${showArchived ? 'Ocultar' : 'Ver'} archivadas (${archived.length})</button>
      ${showArchived && html`<div class="card list">${archived.map((a) => html`<${AccountRow} key=${a.id} a=${a} target=${target} onClick=${() => go('#/cuenta/' + a.id)} />`)}</div>`}
    </section>`}

    ${form && html`<${AccountForm} account=${form.id ? form : null} onClose=${() => { setForm(null); if (query.get('nueva')) history.replaceState(null, '', '#/cuentas'); }} />`}
  </div>`;
}

export function AccountForm({ account, onClose }) {
  const { region, actions, profile, txs, accounts } = useData();
  const editing = Boolean(account);
  const [f, setF] = useState(account ? { ...account, initial_balance: String(account.initial_balance ?? 0).replace('.', ',') }
    : { name: '', currency: region.base, kind: 'bank', initial_balance: '', color: ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length], icon: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr({}); };
  const userRegion = profile?.region || 'VE';
  const templates = ACCOUNT_TEMPLATES[userRegion] || ACCOUNT_TEMPLATES.VE;
  // Sugerencias según la moneda: en Venezuela, Bs. → bancos venezolanos; divisas → internacionales.
  const bankList = [...new Set(bankGroupsFor(userRegion, f.currency).flatMap((g) => g.banks))];
  const namePlaceholder = userRegion === 'US'
    ? 'Ej. Checking Account, Venmo, Zelle…'
    : userRegion === 'ES'
      ? 'Ej. Bizum, Cuenta BBVA, Tarjeta…'
      : userRegion === 'INT'
        ? 'Ej. Bancolombia, Wise, Binance…'
        : 'Ej. Pago Móvil, Banesco, Zelle…';
  const used = txs.filter((t) => account && (t.account_id === account.id || t.to_account_id === account.id)).length;

  async function submit(close) {
    const e = {};
    if (!f.name.trim()) e.name = 'Escribe un nombre para la cuenta (por ejemplo, Zelle o Efectivo).';
    const ib = f.initial_balance === '' ? 0 : parseAmount(f.initial_balance);
    if (!isFinite(ib)) e.initial_balance = 'Monto no válido.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const row = { name: f.name.trim(), currency: f.currency, kind: f.kind, initial_balance: ib, color: f.color, icon: f.icon || KINDS[f.kind].emoji };
    if (!editing) row.sort_order = accounts.length;
    try {
      await actions.save('accounts', row, account?.id);
      vibrate(); close();
      toast(editing ? 'Cuenta actualizada' : `Cuenta "${row.name}" creada`);
    } catch (x) { setErr({ form: errorText(x) }); setBusy(false); }
  }

  async function archive(close) {
    await actions.save('accounts', { archived: !account.archived }, account.id);
    close(); toast(account.archived ? 'Cuenta restaurada' : 'Cuenta archivada. Su historial se conserva.');
  }
  async function remove(close) {
    const ok = await confirmDialog({
      title: `¿Eliminar "${account.name}"?`,
      body: used ? `Se ${used === 1 ? 'borrará también su único movimiento' : `borrarán también sus ${used} movimientos`}. Si ya no la usas, es mejor archivarla.` : 'Esta cuenta no tiene movimientos.',
      confirm: 'Eliminar', tone: 'danger',
    });
    if (!ok) return;
    try { await actions.remove('accounts', account.id); close(); setTimeout(() => go('#/cuentas'), 400); toast('Cuenta eliminada'); } catch (x) { setErr({ form: errorText(x) }); }
  }

  return html`<${Sheet} title=${editing ? 'Editar cuenta' : 'Nueva cuenta'} onClose=${onClose}
    footer=${(close) => html`<button class="btn primary block" disabled=${busy} onClick=${() => submit(close)}>${busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cuenta'}</button>`}>
    ${(close) => html`<div class="stack">
      ${!editing && html`<div>
        <p class="field-label">Plantillas rápidas según tu país</p>
        <div class="chips">${templates.map((t) => html`<button key=${t.name + t.currency} type="button" class=${'chip' + (f.name === t.name && f.currency === t.currency ? ' on' : '')}
          onClick=${() => setF((x) => ({ ...x, name: t.name, currency: t.currency, kind: t.kind, icon: t.icon || KINDS[t.kind].emoji }))}>${t.icon || KINDS[t.kind].emoji} ${t.name} · ${t.currency}</button>`)}</div>
      </div>`}
      <${Field} label="Nombre" error=${err.name}>
        <input class="input" maxlength="60" placeholder=${namePlaceholder} value=${f.name} onInput=${(e) => set('name', e.target.value)}
          list=${f.kind !== 'cash' ? 'banks-regional-form' : undefined} />
        <datalist id="banks-regional-form">${bankList.map((b) => html`<option key=${b} value=${b}></option>`)}</datalist>
        ${f.kind !== 'cash' && html`<span class="field-hint">Elige uno de la lista o escribe el tuyo: puedes agregar cualquier banco o app.</span>`}
      <//>
      <${Field} label="Moneda" hint=${editing && used ? 'Cambiar la moneda no convierte los movimientos ya registrados.' : ''}>
        <${Segmented} value=${f.currency} onChange=${(v) => set('currency', v)} options=${[...new Set([...region.currencies, ...(editing ? [account.currency] : [])])].map((c) => [c, c])} />
      <//>
      <${Field} label="Tipo">
        <${Segmented} value=${f.kind} onChange=${(v) => set('kind', v)} options=${Object.entries(KINDS).map(([k, v]) => [k, v.label])} />
      <//>
      <${Field} label=${editing ? 'Saldo inicial' : 'Saldo actual'} error=${err.initial_balance}
        hint=${editing ? 'Es el saldo con el que empezó la cuenta. Para corregir el saldo de hoy, usa "Ajustar saldo".' : 'Lo que tienes hoy en esta cuenta. Puede ser 0.'}>
        <div class="input-affix"><span>${CURRENCIES[f.currency].symbol}</span>
          <input class="input num" inputmode="decimal" placeholder="0,00" value=${f.initial_balance} onInput=${(e) => set('initial_balance', e.target.value.replace(/[^\d.,-]/g, ''))} /></div>
      <//>
      <${Field} label="Ícono y color">
        <div class="icon-pick">${ICONS.map((i) => html`<button key=${i} type="button" class=${(f.icon || KINDS[f.kind].emoji) === i ? 'on' : ''} onClick=${() => set('icon', i)}>${i}</button>`)}</div>
        <div class="color-pick">${ACCOUNT_COLORS.map((c) => html`<button key=${c} type="button" aria-label=${'Color ' + c} class=${f.color === c ? 'on' : ''} style=${{ background: c }} onClick=${() => set('color', c)}></button>`)}</div>
      <//>
      ${err.form && html`<p class="form-error">${err.form}</p>`}
      ${editing && html`<div class="danger-zone">
        <button type="button" class="btn ghost" onClick=${() => archive(close)}><${Icon} name="archive" size=${18} /> ${account.archived ? 'Restaurar' : 'Archivar'}</button>
        <button type="button" class="btn ghost danger-text" onClick=${() => remove(close)}><${Icon} name="trash" size=${18} /> Eliminar</button>
      </div>`}
    </div>`}
  <//>`;
}

export function AccountDetail({ id }) {
  const { accById, txs, target, rates, val, actions } = useData();
  const a = accById[id];
  const [edit, setEdit] = useState(false);
  const [adjust, setAdjust] = useState(false);
  if (!a) return html`<div class="page"><${PageHeader} title="Cuenta" back="#/cuentas" /><${Empty} art="search" title="Esta cuenta ya no existe" /></div>`;
  const list = txs.filter((t) => t.account_id === id || t.to_account_id === id);
  const ym = monthKey(todayISO());
  let inc = 0, out = 0;
  for (const t of list) {
    if (monthKey(t.date) !== ym) continue;
    const incoming = t.type === 'income' || (t.type === 'transfer' && t.to_account_id === id);
    const amt = t.type === 'transfer' && t.to_account_id === id ? Number(t.to_amount) : Number(t.amount);
    if (incoming) inc += amt; else out += amt;
  }
  const conv = a.currency !== target ? convert(a.balance, a.currency, target, rates, val) : null;

  return html`<div class="page">
    <${PageHeader} title=${a.name} sub=${`${KINDS[a.kind]?.label} · ${a.currency}${a.archived ? ' · archivada' : ''}`} back="#/cuentas"
      actions=${html`<button class="icon-btn" onClick=${() => setEdit(true)} aria-label="Editar cuenta"><${Icon} name="edit" /></button>`} />
    <section class="hero acc-hero" style=${{ '--acc': a.color || 'var(--blue)' }}>
      <span class="hero-label">${a.icon || KINDS[a.kind]?.emoji} Saldo actual</span>
      <p class="hero-amount"><${Money} v=${a.balance} c=${a.currency} /></p>
      ${conv != null && html`<p class="hero-val">≈ <${Money} v=${conv} c=${target} /></p>`}
      <div class="hero-month">
        <div><small>Entró este mes</small><b class="inc"><${Money} v=${inc} c=${a.currency} /></b></div>
        <div><small>Salió este mes</small><b class="exp"><${Money} v=${out} c=${a.currency} /></b></div>
      </div>
    </section>
    <div class="action-row">
      <button class="btn soft" onClick=${() => openTx({ preset: { type: 'expense', account_id: id } })}><${Icon} name="up" size=${18} /> Gasto</button>
      <button class="btn soft" onClick=${() => openTx({ preset: { type: 'income', account_id: id } })}><${Icon} name="dn" size=${18} /> Ingreso</button>
      <button class="btn soft" onClick=${() => openTx({ preset: { type: 'transfer', account_id: id } })}><${Icon} name="swap" size=${18} /> Mover</button>
      <button class="btn soft" onClick=${() => setAdjust(true)}><${Icon} name="scale" size=${18} /> Ajustar</button>
    </div>
    <${SectionTitle}>Historial<//>
    ${list.length === 0
      ? html`<${Empty} art="receipt" title="Sin movimientos" text="Los gastos, ingresos y transferencias de esta cuenta aparecerán aquí." />`
      : html`<div class="card list">${list.slice(0, 200).map((t) => html`<${TxRow} key=${t.id} t=${t} accById=${accById} showDate />`)}</div>`}
    ${edit && html`<${AccountForm} account=${a} onClose=${() => setEdit(false)} />`}
    ${adjust && html`<${AdjustSheet} a=${a} onClose=${() => setAdjust(false)} save=${actions.save} />`}
  </div>`;
}

function AdjustSheet({ a, onClose, save }) {
  const [real, setReal] = useState('');
  const [busy, setBusy] = useState(false);
  const n = parseAmount(real);
  const diff = isFinite(n) ? n - a.balance : null;
  async function submit(close) {
    if (diff == null || Math.abs(diff) < 0.005) { close(); return; }
    setBusy(true);
    try {
      await save('transactions', {
        type: diff > 0 ? 'income' : 'expense', account_id: a.id, amount: Number(Math.abs(diff).toFixed(2)),
        category: ADJUST_CATEGORY, description: 'Ajuste para cuadrar con el saldo real', occurred_on: todayISO(),
      });
      close(); toast(`Saldo ajustado a ${fmt(n, a.currency)}`);
    } catch (e) { toast(errorText(e), { tone: 'bad' }); setBusy(false); }
  }
  return html`<${Sheet} title="Ajustar saldo" onClose=${onClose}
    footer=${(close) => html`<button class="btn primary block" disabled=${busy || diff == null} onClick=${() => submit(close)}>Ajustar</button>`}>
    <div class="stack">
      <p class="hint">Saldo en la app: <b class="num">${fmt(a.balance, a.currency)}</b>. Escribe el saldo que ves en tu banco o en tu billetera. <${Learn} term="ajuste" /></p>
      <${Field} label="Saldo real">
        <div class="input-affix"><span>${CURRENCIES[a.currency].symbol}</span>
          <input class="input num" autofocus inputmode="decimal" placeholder="0,00" value=${real} onInput=${(e) => setReal(e.target.value.replace(/[^\d.,-]/g, ''))} /></div>
      <//>
      ${diff != null && Math.abs(diff) >= 0.005 && html`<p class=${'callout ' + (diff > 0 ? 'good' : 'bad')}>
        Se registrará un ${diff > 0 ? 'ingreso' : 'gasto'} de <b class="num">${fmt(Math.abs(diff), a.currency)}</b> como "${ADJUST_CATEGORY}".</p>`}
    </div>
  <//>`;
}
