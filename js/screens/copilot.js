// Copiloto IA: chat con respuestas en streaming + configuración del proveedor.
import { useEffect, useRef, useState } from 'react';
import { html, Icon, Sheet, Field, Segmented, Switch, toast, errorText, vibrate } from '../ui.js';
import { useData } from '../store.js';
import { go } from './common.js';
import { categoryMeta, fmt, fmtRate } from '../money.js';
import {
  PROVIDERS, loadAiConfig, saveAiConfig, clearAiConfig, aiReady, endpointError, systemPrompt, parseReply,
  runCalc, resolveTx, streamChat, testConnection,
} from '../ai.js';

// La conversación vive en memoria (no se guarda) y se borra si cambia el usuario.
let CHAT = [];
let CHAT_OWNER = null;
let uid = 0;

// ---------------------------------------------------------------------
// Configuración (se usa en Ajustes y dentro del chat)
// ---------------------------------------------------------------------
export function AiSettings({ onSaved }) {
  const [cfg, setCfg] = useState(loadAiConfig);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState({});
  const p = PROVIDERS[cfg.provider];
  const set = (k, v) => { setCfg((c) => ({ ...c, [k]: v })); setErr({}); };

  function validate() {
    const e = {};
    if (!cfg.apiKey.trim()) e.apiKey = 'Pega tu clave de API.';
    if (cfg.provider === 'custom') {
      const be = endpointError(cfg.endpoint.trim());
      if (be) e.endpoint = be;
      if (!cfg.model.trim()) e.model = 'Escribe el nombre del modelo.';
    }
    setErr(e);
    return !Object.keys(e).length;
  }
  function save() {
    if (!validate()) return;
    if (!cfg.consent) { setErr({ consent: 'Acepta el aviso de privacidad para activar el copiloto.' }); return; }
    const saved = saveAiConfig(cfg);
    setCfg(saved);
    toast('Copiloto IA configurado');
    onSaved?.(saved);
  }
  async function test() {
    if (!validate()) return;
    setBusy('test');
    try { await testConnection(cfg); toast('Conexión correcta ✓'); } catch (e) { setErr({ form: errorText(e) }); }
    setBusy('');
  }
  function forget() {
    clearAiConfig();
    setCfg(loadAiConfig());
    toast('Clave eliminada de este dispositivo');
    onSaved?.(loadAiConfig());
  }

  return html`<div class="stack">
    <${Field} label="Proveedor">
      <${Segmented} value=${cfg.provider} onChange=${(v) => set('provider', v)} options=${Object.entries(PROVIDERS).map(([k, v]) => [k, v.label])} />
    <//>
    <${Field} label="Clave de API" error=${err.apiKey} hint=${p.hint}>
      <div class="input-affix right">
        <input class="input" type=${show ? 'text' : 'password'} autocomplete="off" autocapitalize="none" spellcheck="false"
          placeholder="Pega aquí tu clave" value=${cfg.apiKey} onInput=${(e) => set('apiKey', e.target.value)} />
        <button type="button" class="icon-btn sm" onClick=${() => setShow(!show)} aria-label=${show ? 'Ocultar clave' : 'Mostrar clave'}><${Icon} name=${show ? 'eyeOff' : 'eye'} size=${18} /></button>
      </div>
    <//>
    <${Field} label="Modelo" error=${err.model} hint=${p.model ? `Por defecto: ${p.model}` : 'Obligatorio para este proveedor.'}>
      <input class="input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder=${p.model || 'nombre-del-modelo'} value=${cfg.model} onInput=${(e) => set('model', e.target.value)} />
    <//>
    ${cfg.provider === 'custom' && html`<${Field} label="URL base del servicio" error=${err.endpoint} hint="Ej. https://api.openai.com/v1 (se llama a /chat/completions)">
      <input class="input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://…/v1" value=${cfg.endpoint} onInput=${(e) => set('endpoint', e.target.value)} />
    <//>`}
    <div class="callout ai-consent">
      <${Switch} checked=${cfg.consent} onChange=${(v) => set('consent', v)} label="Entiendo y acepto"
        sub=${`Tus preguntas y un resumen de tus cuentas, tasas y últimos movimientos se envían a ${p.label} para responder. La clave se guarda solo en este dispositivo.`} />
      ${err.consent && html`<span class="field-error">${err.consent}</span>`}
    </div>
    ${err.form && html`<p class="form-error">${err.form}</p>`}
    <div class="row-btns">
      <button class="btn primary grow" onClick=${save}>Guardar</button>
      <button class="btn soft" disabled=${busy === 'test'} onClick=${test}>${busy === 'test' ? 'Probando…' : 'Probar'}</button>
    </div>
    ${cfg.apiKey && html`<button class="btn ghost block" onClick=${forget}>Borrar clave de este dispositivo</button>`}
  </div>`;
}

// ---------------------------------------------------------------------
// Texto enriquecido mínimo: **negritas**, viñetas y saltos (sin HTML crudo)
// ---------------------------------------------------------------------
function inline(s) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.length > 4 && p.startsWith('**') && p.endsWith('**') ? html`<b key=${i}>${p.slice(2, -2)}</b>` : p));
}
function Rich({ text }) {
  return html`${text.trim().split('\n').map((raw, i) => {
    const ln = raw.replace(/^#{1,6}\s*/, '');
    if (!ln.trim()) return html`<span key=${i} class="gap"></span>`;
    const li = /^\s*[-*•]\s+/.test(ln);
    return html`<p key=${i} class=${li ? 'li' : ''}>${li ? '• ' : ''}${inline(ln.replace(/^\s*[-*•]\s+/, ''))}</p>`;
  })}`;
}

// ---------------------------------------------------------------------
// Tarjetas de resultado
// ---------------------------------------------------------------------
function CalcCard({ spec, d }) {
  const r = runCalc(spec, d);
  if (r.error) return html`<div class="ai-card warn">⚠️ ${r.error}</div>`;
  return html`<div class="ai-card">
    <small class="muted">🧮 Conversión exacta${r.label ? ' · ' + r.label : ''}</small>
    <div class="ai-calc"><span class="num">${fmt(r.amount, r.from)}</span><${Icon} name="right" size=${16} class="muted" /><b class="num">${fmt(r.result, r.to)}</b></div>
    ${r.from !== r.to && html`<small class="muted num">1 ${r.from} = ${fmtRate(r.unit)} ${r.to}</small>`}
  </div>`;
}

function TxCard({ spec, d, state, onConfirm, onDismiss }) {
  const r = resolveTx(spec, d);
  if (r.error) return html`<div class="ai-card warn">⚠️ ${r.error}</div>`;
  const p = r.preview;
  const meta = categoryMeta(p.category, p.kind);
  return html`<div class="ai-card">
    <small class="muted">${p.kind === 'expense' ? '💸 Gasto propuesto' : '💰 Ingreso propuesto'}</small>
    <div class="ai-tx">
      <span class="tx-ico" style=${{ '--cat': meta.color }}>${meta.emoji}</span>
      <span class="grow"><b>${p.description || p.category}</b><small class="muted">${p.category} · ${p.account}</small></span>
      <b class=${'num ' + (p.kind === 'expense' ? 'neg' : 'pos')}>${p.kind === 'expense' ? '−' : '+'}${fmt(p.amount, p.currency)}</b>
    </div>
    ${p.converted && html`<small class="muted">Equivale a ${fmt(p.fromAmount, p.fromCurrency)} con las tasas activas.</small>`}
    ${state === 'done' ? html`<p class="ai-done">✓ Registrado</p>`
      : state === 'dismissed' ? html`<p class="muted">Descartado</p>`
      : html`<div class="row-btns">
          <button class="btn primary sm grow" disabled=${state === 'saving'} onClick=${() => onConfirm(r.row, p)}>${state === 'saving' ? 'Guardando…' : 'Registrar'}</button>
          <button class="btn ghost sm" disabled=${state === 'saving'} onClick=${onDismiss}>Descartar</button>
        </div>`}
  </div>`;
}

function Bubble({ m, d, onBlock }) {
  if (m.role === 'user') return html`<div class="msg user"><${Rich} text=${m.text} /></div>`;
  const parts = parseReply(m.text || '');
  return html`<div class="msg ai">
    ${!parts.length && !m.error && html`<span class="typing" aria-label="Escribiendo"><i></i><i></i><i></i></span>`}
    ${parts.map((p, i) => (p.kind === 'text'
      ? html`<${Rich} key=${i} text=${p.text} />`
      : p.spec.type === 'calc'
        ? html`<${CalcCard} key=${i} spec=${p.spec} d=${d} />`
        : html`<${TxCard} key=${i} spec=${p.spec} d=${d} state=${m.blocks?.[p.idx]}
            onConfirm=${(row, prev) => onBlock(m.id, p.idx, 'confirm', row, prev)} onDismiss=${() => onBlock(m.id, p.idx, 'dismiss')} />`))}
    ${m.error && html`<div class="ai-card warn">⚠️ ${m.error}</div>`}
  </div>`;
}

// ---------------------------------------------------------------------
// Pantalla del chat
// ---------------------------------------------------------------------
export function Copilot() {
  const d = useData();
  const { profile, region, actions } = d;
  const [msgs, setMsgsRaw] = useState(() => { if (CHAT_OWNER !== profile.id) { CHAT = []; CHAT_OWNER = profile.id; } return CHAT; });
  const setMsgs = (fn) => setMsgsRaw((cur) => { const next = typeof fn === 'function' ? fn(cur) : fn; CHAT = next; return next; });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState(loadAiConfig);
  const [setup, setSetup] = useState(false);
  const ctl = useRef(null);
  const log = useRef(null);
  const box = useRef(null);
  const ready = aiReady(cfg);

  useEffect(() => { const el = log.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs]);
  useEffect(() => () => ctl.current?.abort(), []);

  const base = region.base;
  const sym = base === 'EUR' ? '20 €' : '$20';
  const suggestions = [
    '¿Cómo van mis finanzas hoy?',
    region.rates ? 'Calcúlame 400 EUR a la tasa BCV' : '¿En qué gasto más este mes?',
    `Crea un gasto de ${sym} en comida`,
    region.rates ? '¿Cuánto es mi patrimonio en bolívares?' : 'Dame un consejo para ahorrar más',
  ];

  async function send(text) {
    const q = String(text ?? input).trim();
    if (!q || busy) return;
    if (!ready) { setSetup(true); return; }
    const user = { id: ++uid, role: 'user', text: q };
    const bot = { id: ++uid, role: 'assistant', text: '' };
    const history = [...msgs, user].filter((m) => m.text && !m.error).slice(-14).map((m) => ({ role: m.role, text: m.text }));
    while (history.length && history[0].role !== 'user') history.shift();
    setMsgs([...msgs, user, bot]);
    setInput('');
    setBusy(true);
    const c = new AbortController();
    ctl.current = c;
    try {
      await streamChat({
        config: cfg, system: systemPrompt(d), history, signal: c.signal,
        onDelta: (t) => setMsgs((cur) => cur.map((m) => (m.id === bot.id ? { ...m, text: m.text + t } : m))),
      });
    } catch (e) {
      if (e?.name !== 'AbortError') setMsgs((cur) => cur.map((m) => (m.id === bot.id ? { ...m, error: errorText(e) } : m)));
    } finally { setBusy(false); ctl.current = null; box.current?.focus(); }
  }

  async function onBlock(msgId, idx, what, row, prev) {
    const mark = (s) => setMsgs((cur) => cur.map((m) => (m.id === msgId ? { ...m, blocks: { ...m.blocks, [idx]: s } } : m)));
    if (what === 'dismiss') return mark('dismissed');
    mark('saving');
    try {
      const saved = await actions.save('transactions', row);
      mark('done'); vibrate();
      toast(`${prev.kind === 'expense' ? 'Gasto' : 'Ingreso'} registrado · ${fmt(prev.amount, prev.currency)}`, {
        action: { label: 'Deshacer', fn: () => actions.remove('transactions', saved.id).then(() => { mark(undefined); toast('Movimiento deshecho'); }) },
      });
    } catch (e) { mark(undefined); toast(errorText(e), { tone: 'bad' }); }
  }

  const reset = () => { ctl.current?.abort(); setMsgs([]); setBusy(false); };
  const back = () => (history.length > 1 ? history.back() : go('#/'));

  return html`<div class="chat" role="region" aria-label="Copiloto IA">
    <header class="chat-head">
      <button class="icon-btn" onClick=${back} aria-label="Volver"><${Icon} name="left" /></button>
      <div class="grow"><b>La Fructosa AI</b><small class="muted">Tu copiloto financiero</small></div>
      ${msgs.length > 0 && html`<button class="icon-btn" onClick=${reset} aria-label="Nueva conversación"><${Icon} name="refresh" size=${18} /></button>`}
      <button class="icon-btn" onClick=${() => setSetup(true)} aria-label="Configurar IA"><${Icon} name="sliders" size=${18} /></button>
    </header>

    <div class="chat-log" ref=${log} aria-live="polite">
      ${!msgs.length && html`<div class="chat-empty">
        <div class="chat-spark"><${Icon} name="sparkle" size=${30} /></div>
        <h2>Hola${profile.display_name ? ', ' + profile.display_name : ''} 👋</h2>
        <p>Pregúntame por tus números, pídeme conversiones con las tasas de hoy o dime un gasto para registrarlo.</p>
        ${!ready && html`<button class="btn primary" onClick=${() => setSetup(true)}><${Icon} name="lock" size=${16} /> Conectar mi IA</button>`}
        <div class="chat-sugg">${suggestions.map((s) => html`<button key=${s} class="chip" onClick=${() => send(s)}>${s}</button>`)}</div>
      </div>`}
      ${msgs.map((m) => html`<${Bubble} key=${m.id} m=${m} d=${d} onBlock=${onBlock} />`)}
    </div>

    <form class="chat-input" onSubmit=${(e) => { e.preventDefault(); send(); }}>
      <textarea ref=${box} rows="1" class="input" placeholder="Escribe tu pregunta…" value=${input} maxLength="600"
        onInput=${(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
        onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}></textarea>
      ${busy
        ? html`<button type="button" class="icon-btn send stop" onClick=${() => ctl.current?.abort()} aria-label="Detener"><${Icon} name="x" size=${20} /></button>`
        : html`<button type="submit" class="icon-btn send" disabled=${!input.trim()} aria-label="Enviar"><${Icon} name="send" size=${19} /></button>`}
    </form>

    ${setup && html`<${Sheet} title="Copiloto IA" onClose=${() => setSetup(false)}>
      ${(close) => html`<${AiSettings} onSaved=${(c) => { setCfg(c); if (aiReady(c)) close(); }} />`}
    <//>`}
  </div>`;
}
