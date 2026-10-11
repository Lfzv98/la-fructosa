// Recorrido de bienvenida + configuración rápida de cuentas.
import { useState } from 'react';
import { html, Icon, Art, toast, errorText } from '../ui.js';
import { useData, usePref } from '../store.js';
import { ACCOUNT_TEMPLATES, BANK_SUGGESTIONS, CURRENCIES, KINDS, ACCOUNT_COLORS, VE_BANKS, parseAmount } from '../money.js';

const SLIDES = [
  { art: 'coins', title: 'Bienvenido a La Fructosa', text: 'Todo tu dinero en un solo lugar: efectivo, bancos, Zelle, Pago Móvil y criptomonedas. Cada familiar tiene su cuenta y nadie ve la de los demás.' },
  { art: 'currencies', title: 'Varias monedas, un solo total', text: 'Cada cuenta lleva su moneda (USD, Bs., USDT o EUR). La app las convierte con la tasa del día y te dice cuánto tienes en total.' },
  { art: 'growth', title: 'Registra en segundos', text: 'Toca +, escribe el monto y elige la categoría. Si pagas en bolívares desde una cuenta en dólares, la app calcula el costo real y la brecha.' },
  { art: 'target', title: 'Planifica y aprende', text: 'Pon topes por categoría, programa tus pagos fijos y revisa el Análisis del mes. Toca cualquier ⓘ para entender un concepto.' },
];

export function Onboarding() {
  const { active, profile, actions } = useData();
  const [, setDone] = usePref('onboarded', false);
  const [i, setI] = useState(0);
  const needsSetup = active.length === 0;
  const last = SLIDES.length - 1 + (needsSetup ? 1 : 0);
  const finish = () => setDone(true);

  return html`<div class="onboard" role="dialog" aria-modal="true" aria-label="Bienvenida">
    <button class="onboard-skip" onClick=${finish}>Saltar</button>
    ${i < SLIDES.length
      ? html`<div class="onboard-slide" key=${i}>
          <div class="onboard-art"><${Art} name=${SLIDES[i].art} size=${92} /></div>
          <h1>${SLIDES[i].title}</h1>
          <p>${SLIDES[i].text}</p>
        </div>`
      : html`<${QuickSetup} region=${profile.region || 'VE'} onDone=${finish} save=${actions.save} />`}
    <div class="onboard-foot">
      <div class="dots">${Array.from({ length: last + 1 }, (_, k) => html`<i key=${k} class=${k === i ? 'on' : ''}></i>`)}</div>
      ${i < SLIDES.length && html`<button class="btn primary lg" onClick=${() => (i < last ? setI(i + 1) : finish())}>
        ${i < last ? 'Siguiente' : 'Empezar'} <${Icon} name="right" size=${18} /></button>`}
    </div>
  </div>`;
}

function QuickSetup({ region, onDone, save }) {
  const templates = ACCOUNT_TEMPLATES[region] || ACCOUNT_TEMPLATES.VE;
  const bankSuggestions = BANK_SUGGESTIONS[region] || BANK_SUGGESTIONS.VE;
  // picked[k] = { bal: saldo escrito, bank: nombre del banco (solo plantillas con bank: true) }
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);
  const keys = Object.keys(picked);
  const toggle = (k) => setPicked((p) => { const n = { ...p }; if (k in n) delete n[k]; else n[k] = { bal: '', bank: '' }; return n; });
  const patch = (k, v) => setPicked((p) => ({ ...p, [k]: { ...p[k], ...v } }));

  async function create() {
    const missing = keys.find((k) => templates[Number(k)].bank && !picked[k].bank.trim());
    if (missing) { toast('Elige o escribe el nombre de tu banco.', { tone: 'bad' }); return; }
    setBusy(true);
    try {
      let n = 0;
      for (const k of keys) {
        const t = templates[Number(k)];
        const ib = parseAmount(picked[k].bal);
        // user_id se envía explícito en api.insert (= auth.uid()), como exige la política RLS.
        await save('accounts', {
          name: t.bank ? picked[k].bank.trim().slice(0, 60) : t.name,
          currency: t.currency,
          kind: t.kind,
          initial_balance: isFinite(ib) ? ib : 0,
          icon: t.icon || KINDS[t.kind].emoji,
          color: ACCOUNT_COLORS[n % ACCOUNT_COLORS.length],
          sort_order: n,
        });
        n++;
      }
      toast(`${n} cuenta${n === 1 ? '' : 's'} creada${n === 1 ? '' : 's'}. ¡Listo!`);
      onDone();
    } catch (e) { toast(errorText(e), { tone: 'bad' }); setBusy(false); }
  }

  return html`<div class="onboard-slide setup">
    <h1>¿Dónde tienes tu dinero?</h1>
    <p>Marca tus cuentas y escribe cuánto hay hoy en cada una. Podrás cambiarlo después.</p>
    <div class="setup-list">${templates.map((t, k) => {
      const on = String(k) in picked;
      return html`<div key=${k} class=${'setup-row' + (on ? ' on' : '')}>
        <button type="button" class="setup-pick" onClick=${() => toggle(String(k))} aria-pressed=${on}>
          <span class="check">${on && html`<${Icon} name="check" size=${14} stroke=${3} />`}</span>
          <span>${t.icon || KINDS[t.kind].emoji} <b>${t.bank && picked[k]?.bank.trim() ? picked[k].bank.trim() : t.name}</b> <small>${t.currency}</small></span>
        </button>
        ${on && t.bank && html`<input class="input" list="banks-regional" maxlength="60" autocomplete="off" aria-label="Banco"
          placeholder="Elige tu banco o escríbelo" value=${picked[k].bank} onInput=${(e) => patch(k, { bank: e.target.value })} />`}
        ${on && html`<div class="input-affix"><span>${CURRENCIES[t.currency].symbol}</span>
          <input class="input num" inputmode="decimal" placeholder="Saldo hoy" value=${picked[k].bal} onInput=${(e) => patch(k, { bal: e.target.value.replace(/[^\d.,]/g, '') })} /></div>`}
      </div>`;
    })}</div>
    <datalist id="banks-regional">${bankSuggestions.map((b) => html`<option key=${b} value=${b}></option>`)}</datalist>
    <button class="btn primary lg block" disabled=${!keys.length || busy} onClick=${create}>${busy ? 'Creando…' : keys.length ? `Crear ${keys.length} cuenta${keys.length === 1 ? '' : 's'}` : 'Elige al menos una'}</button>
    <button class="btn ghost block" onClick=${onDone}>Lo haré después</button>
  </div>`;
}
