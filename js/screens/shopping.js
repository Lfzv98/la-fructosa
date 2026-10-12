// Lista de compras: lo que hay que comprar, con precio opcional para saber cuánto vas a gastar.
// No mueve dinero: al terminar, "Registrar gasto" abre el formulario con el total de lo marcado.
import { useMemo, useRef, useState } from 'react';
import { html, Icon, Money, Sheet, Field, Segmented, Chips, Empty, toast, confirmDialog, errorText, vibrate } from '../ui.js';
import { useData, usePref } from '../store.js';
import { PageHeader, openTx } from './common.js';
import { CURRENCIES, categoriesFor, convert, fmt, parseAmount } from '../money.js';

const n = (v) => Number(v) || 0;
const DEFAULT_LIST = 'Mercado';

export function Shopping() {
  const d = useData();
  const { shopping, missing, region, actions, active, rates, val } = d;
  const [list, setList] = usePref('shop-list', DEFAULT_LIST);
  const [newList, setNewList] = useState(false);
  const [extraLists, setExtraLists] = usePref('shop-lists', []);
  const currencies = region.currencies.filter((c) => c !== 'USDT');
  const [curPref, setCurPref] = usePref('shop-cur-' + list, region.base);
  const cur = currencies.includes(curPref) ? curPref : region.base;
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  const lists = useMemo(() => {
    const names = [...new Set([DEFAULT_LIST, ...shopping.map((i) => i.list_name), ...(Array.isArray(extraLists) ? extraLists : [])])];
    return names.includes(list) ? names : [...names, list];
  }, [shopping, extraLists, list]);

  if (missing.includes('shopping_items')) {
    return html`<div class="page"><${PageHeader} title="Lista de compras" back="#/mas" />
      <${Empty} art="database" title="Falta activar la lista de compras" text="Ejecuta supabase/migrations/013_comprobantes_compras.sql en el SQL Editor de Supabase y recarga." /></div>`;
  }

  const items = shopping.filter((i) => i.list_name === list)
    .sort((a, b) => Number(a.done) - Number(b.done) || String(a.created_at).localeCompare(String(b.created_at)));
  const todo = items.filter((i) => !i.done);
  const inCart = items.filter((i) => i.done);
  // Todo se suma en la moneda de la lista (si un producto se anotó en otra, se convierte).
  const sub = (i) => (i.price == null ? 0 : convert(n(i.price) * n(i.qty), i.currency, cur, rates, val) ?? 0);
  const total = items.reduce((s, i) => s + sub(i), 0);
  const cartTotal = inCart.reduce((s, i) => s + sub(i), 0);
  const noPrice = items.filter((i) => i.price == null).length;

  async function add(e) {
    e?.preventDefault();
    const nm = name.trim();
    if (!nm || busy) return;
    const p = price.trim() ? parseAmount(price) : null;
    const q = qty.trim() ? parseAmount(qty) : 1;
    if (p != null && !(p >= 0)) return toast('Revisa el precio.', { tone: 'bad' });
    if (!(q > 0)) return toast('La cantidad debe ser mayor que cero.', { tone: 'bad' });
    setBusy(true);
    try {
      await actions.save('shopping_items', { list_name: list, name: nm.slice(0, 80), qty: q, price: p, currency: cur, done: false });
      setName(''); setQty(''); setPrice('');
      nameRef.current?.focus();
    } catch (err) { toast(errorText(err), { tone: 'bad' }); }
    setBusy(false);
  }

  const toggle = (i) => { vibrate(); actions.save('shopping_items', { done: !i.done }, i.id).catch((e) => toast(errorText(e), { tone: 'bad' })); };
  const remove = (i) => actions.remove('shopping_items', i.id).catch((e) => toast(errorText(e), { tone: 'bad' }));

  async function clearDone() {
    if (!inCart.length) return;
    const ok = await confirmDialog({ title: `¿Quitar ${inCart.length} producto${inCart.length === 1 ? '' : 's'} marcado${inCart.length === 1 ? '' : 's'}?`,
      body: 'Se borran de la lista. Lo que no marcaste se queda para la próxima compra.', confirm: 'Quitar' });
    if (!ok) return;
    try { for (const i of inCart) await actions.remove('shopping_items', i.id); toast('Lista lista para la próxima compra'); } catch (e) { toast(errorText(e), { tone: 'bad' }); }
  }

  function registerExpense() {
    const cats = categoriesFor(region, 'expense').map((c) => c.name);
    const category = cats.includes('Mercado') ? 'Mercado' : cats[0];
    const amount = Number(cartTotal.toFixed(2));
    const acc = active.find((a) => a.currency === cur);
    // En Venezuela, una lista en bolívares pagada desde una cuenta en divisas usa "Pagué en bolívares".
    const preset = { type: 'expense', category, description: list, ...(acc ? { account_id: acc.id } : {}) };
    if (amount > 0) {
      if (!acc && cur === 'VES' && region.rates) Object.assign(preset, { original_amount: amount, original_currency: 'VES' });
      else preset.amount = amount;
    }
    openTx({ preset });
  }

  async function deleteList() {
    if (list === DEFAULT_LIST) return;
    const ok = await confirmDialog({ title: `¿Borrar la lista "${list}"?`, body: items.length ? `Se borran sus ${items.length} productos.` : 'La lista está vacía.', confirm: 'Borrar', tone: 'danger' });
    if (!ok) return;
    try {
      for (const i of items) await actions.remove('shopping_items', i.id);
      setExtraLists((old) => (Array.isArray(old) ? old : []).filter((x) => x !== list));
      setList(DEFAULT_LIST);
    } catch (e) { toast(errorText(e), { tone: 'bad' }); }
  }

  const row = (i) => html`<div key=${i.id} class=${'shop-row' + (i.done ? ' done' : '')}>
    <button class="shop-check" role="checkbox" aria-checked=${i.done} onClick=${() => toggle(i)} aria-label=${(i.done ? 'Desmarcar ' : 'Marcar ') + i.name}>
      ${i.done && html`<${Icon} name="check" size=${16} stroke=${3} />`}
    </button>
    <span class="tx-main" onClick=${() => toggle(i)}>
      <b>${i.name}</b>
      <small>${n(i.qty) !== 1 ? `${String(n(i.qty)).replace('.', ',')} × ` : ''}${i.price != null ? fmt(n(i.price), i.currency) : 'sin precio'}</small>
    </span>
    ${i.price != null && html`<span class="num shop-sub">${fmt(n(i.price) * n(i.qty), i.currency)}</span>`}
    <button class="icon-btn sm" onClick=${() => remove(i)} aria-label=${'Quitar ' + i.name}><${Icon} name="x" size=${16} /></button>
  </div>`;

  return html`<div class="page">
    <${PageHeader} title="Lista de compras" back="#/mas" actions=${list !== DEFAULT_LIST && html`
      <button class="icon-btn" onClick=${deleteList} aria-label="Borrar esta lista"><${Icon} name="trash" /></button>`} />

    <div class="shop-lists">
      <${Chips} value=${list} onChange=${setList} options=${lists.map((l) => ({ value: l, label: l }))} />
      <button class="chip add" onClick=${() => setNewList(true)}><${Icon} name="plus" size=${14} /> Lista</button>
    </div>

    <form class="card pad stack sm shop-add" onSubmit=${add}>
      <input ref=${nameRef} class="input" placeholder="¿Qué hay que comprar?" maxlength="80" value=${name} onInput=${(e) => setName(e.target.value)} aria-label="Producto" />
      <div class="shop-add-row">
        <input class="input num" inputmode="decimal" placeholder="Cant." value=${qty} onInput=${(e) => setQty(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Cantidad" />
        <div class="input-affix"><span>${CURRENCIES[cur]?.symbol}</span>
          <input class="input num" inputmode="decimal" placeholder="Precio (opcional)" value=${price} onInput=${(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Precio por unidad" /></div>
        <button class="btn primary" type="submit" disabled=${!name.trim() || busy} aria-label="Agregar"><${Icon} name="plus" size=${18} /></button>
      </div>
      ${currencies.length > 1 && html`<${Segmented} value=${cur} onChange=${setCurPref} options=${currencies.map((c) => [c, c])} />`}
    </form>

    ${items.length === 0
      ? html`<${Empty} art="receipt" title="Lista vacía" text="Anota lo que necesitas. Si le pones precio, te digo cuánto vas a gastar antes de llegar a la caja." />`
      : html`
        ${todo.length > 0 && html`<div class="card list">${todo.map(row)}</div>`}
        ${inCart.length > 0 && html`<p class="shop-label">En el carrito (${inCart.length})</p><div class="card list">${inCart.map(row)}</div>`}
        <section class="card pad stack sm shop-total">
          <div class="row-between"><span class="muted">Total estimado</span><b class="num"><${Money} v=${total} c=${cur} /></b></div>
          <div class="row-between"><span class="muted">En el carrito</span><b class="num"><${Money} v=${cartTotal} c=${cur} /></b></div>
          ${noPrice > 0 && html`<small class="muted">${noPrice} producto${noPrice === 1 ? '' : 's'} sin precio no se suma${noPrice === 1 ? '' : 'n'}.</small>`}
          <button class="btn primary block" onClick=${registerExpense} disabled=${!inCart.length}><${Icon} name="check" size=${18} /> Registrar gasto${cartTotal > 0 ? ' de ' + fmt(cartTotal, cur) : ''}</button>
          ${inCart.length > 0 && html`<button class="btn ghost block" onClick=${clearDone}>Quitar lo marcado de la lista</button>`}
        </section>`}

    <p class="hint center">La lista no cambia tus saldos. Cuando pagues, toca "Registrar gasto" para anotarlo en una cuenta.</p>
    ${newList && html`<${NewList} lists=${lists} onClose=${() => setNewList(false)} onCreate=${(nm) => {
      setExtraLists((old) => [...new Set([...(Array.isArray(old) ? old : []), nm])]);
      setList(nm);
    }} />`}
  </div>`;
}

function NewList({ lists, onClose, onCreate }) {
  const [nm, setNm] = useState('');
  const clean = nm.trim().slice(0, 40);
  const dup = lists.some((l) => l.toLowerCase() === clean.toLowerCase());
  return html`<${Sheet} title="Nueva lista" onClose=${onClose}
    footer=${(close) => html`<button class="btn primary block" disabled=${!clean || dup} onClick=${() => { onCreate(clean); close(); }}>Crear lista</button>`}>
    <${Field} label="Nombre" hint=${dup ? 'Ya tienes una lista con ese nombre.' : 'Ej. Farmacia, Ferretería, Cumpleaños'}>
      <input class="input" autofocus maxlength="40" value=${nm} onInput=${(e) => setNm(e.target.value)} />
    <//>
  <//>`;
}
