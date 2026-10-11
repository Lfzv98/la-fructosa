// Copiloto IA: chat con respuestas en streaming + configuración del proveedor.
import { useEffect, useRef, useState } from 'react';
import { html, Icon, Sheet, Field, toast, errorText, vibrate } from '../ui.js';
import { api } from '../api.js';
import { useData, usePref } from '../store.js';
import { go } from './common.js';
import { categoryMeta, fmt, fmtRate } from '../money.js';
import {
  PROVIDERS, SHARED_AI, loadAiConfig, saveAiConfig, clearAiConfig, aiReady, resolveAi, systemPrompt, withGuard, parseReply,
  runCalc, resolveTx, streamChat, testConnection, normalizeKey, keyLooksOdd,
  getSpeechRecognition, VoiceSession, speakReply, stopSpeech, cleanSpeechText,
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
  const [armed, setArmed] = useState(false); // el campo de clave no acepta autocompletado hasta que lo tocas
  const p = PROVIDERS.gemini;
  const set = (k, v) => { setCfg((c) => ({ ...c, [k]: v })); setErr({}); };

  function validate() {
    const e = {};
    if (!normalizeKey(cfg.apiKey)) e.apiKey = SHARED_AI ? 'Pega tu clave, o cierra esta ventana para usar la IA incluida.' : 'Pega tu clave de API.';
    setErr(e);
    return !Object.keys(e).length;
  }
  function save() {
    if (!validate()) return;
    const saved = saveAiConfig(cfg);
    setCfg(saved);
    toast('Usarás tu propia clave');
    onSaved?.(saved);
  }
  async function test() {
    if (!validate()) return;
    setBusy('test');
    try {
      const model = await testConnection({ apiKey: normalizeKey(cfg.apiKey) });
      toast(`Conexión correcta ✓ (${model})`);
    } catch (e) { setErr({ form: errorText(e) }); }
    setBusy('');
  }
  function forget() {
    clearAiConfig();
    setCfg(loadAiConfig());
    toast('Clave eliminada de este dispositivo');
    onSaved?.(loadAiConfig());
  }

  return html`<div class="stack">
    ${SHARED_AI && html`<div class="callout good">✓ El copiloto ya funciona sin configurar nada. Esto es <b>opcional</b>: úsalo solo si prefieres usar tu propia clave de Google Gemini.</div>`}
    <${Field} label="Clave de API" error=${err.apiKey} hint=${keyLooksOdd(normalizeKey(cfg.apiKey)) ? 'Las claves de Google AI Studio empiezan por AIza… o AQ.…; revisa que la copiaste completa. Igual puedes guardarla y probarla.' : p.hint}>
      <div class="input-affix right">
        <input class="input" type=${show ? 'text' : 'password'} name="fructosa-ai-key" autocomplete="off" autocapitalize="none" spellcheck="false"
          data-lpignore="true" data-1p-ignore="true" data-form-type="other" readOnly=${!armed} onFocus=${() => setArmed(true)}
          placeholder="Pega aquí tu clave" value=${cfg.apiKey} onInput=${(e) => set('apiKey', e.target.value)} />
        <button type="button" class="icon-btn sm" onClick=${() => setShow(!show)} aria-label=${show ? 'Ocultar clave' : 'Mostrar clave'}><${Icon} name=${show ? 'eyeOff' : 'eye'} size=${18} /></button>
      </div>
    <//>
    <p class="hint ai-note">🔒 Al preguntar, un resumen de tus cuentas, tasas y últimos movimientos se envía a ${p.name} para responder. La clave se guarda solo en este dispositivo. No guardamos la conversación.</p>
    ${err.form && html`<p class="form-error">${err.form}</p>`}
    <div class="row-btns">
      <button class="btn primary grow" onClick=${save}>Guardar</button>
      <button class="btn soft" disabled=${busy === 'test'} onClick=${test}>${busy === 'test' ? 'Probando…' : 'Probar'}</button>
    </div>
    ${cfg.apiKey && html`<button class="btn ghost block" onClick=${forget}>${SHARED_AI ? 'Volver a la IA incluida' : 'Borrar clave de este dispositivo'}</button>`}
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

function Bubble({ m, d, onBlock, speaking, onToggleSpeak }) {
  if (m.role === 'user') {
    return html`<div class="msg user">
      ${m.audio && html`<div class="msg-voice-tag"><${Icon} name="mic" size=${13} /> <span>Voz</span></div>`}
      <${Rich} text=${m.text || (m.audio ? '🎤 Mensaje de voz' : '')} />
    </div>`;
  }
  const parts = parseReply(m.text || '');
  return html`<div class="msg ai">
    <div class="msg-ai-header">
      <small class="muted msg-name">Fructuosa</small>
      ${m.text && html`<button type="button" class=${'icon-btn sm speech-btn' + (speaking ? ' speaking' : '')}
        onClick=${() => onToggleSpeak(m)} aria-label=${speaking ? 'Detener voz' : 'Escuchar en voz alta'} title=${speaking ? 'Detener voz' : 'Escuchar respuesta'}>
        <${Icon} name=${speaking ? 'volumeX' : 'volume'} size=${15} />
      </button>`}
    </div>
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
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioVolume, setAudioVolume] = useState(0);
  const [voiceMode, setVoiceMode] = usePref('voice-mode', true);
  const [speakingId, setSpeakingId] = useState(null);
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef(null);
  const initialVoiceTextRef = useRef('');
  const voiceSessionRef = useRef(null);
  const recordTimerRef = useRef(null);
  const ctl = useRef(null);
  const log = useRef(null);
  const box = useRef(null);
  const ready = aiReady(cfg) || SHARED_AI; // con IA incluida el chat funciona sin configurar nada

  useEffect(() => { const el = log.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs]);
  useEffect(() => () => {
    ctl.current?.abort();
    stopSpeech();
    if (recognizerRef.current) {
      try { recognizerRef.current.stop(); } catch {}
      recognizerRef.current = null;
    }
    if (voiceSessionRef.current) {
      voiceSessionRef.current.cancel();
      voiceSessionRef.current = null;
    }
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }, []);

  const base = region.base;
  const sym = base === 'EUR' ? '20 €' : '$20';
  const suggestions = [
    '¿Cómo van mis finanzas hoy?',
    region.rates ? 'Calcúlame 400 EUR a la tasa BCV' : '¿En qué gasto más este mes?',
    `Crea un gasto de ${sym} en comida`,
    region.rates ? '¿Cuánto es mi patrimonio en bolívares?' : 'Dame un consejo para ahorrar más',
  ];

  async function send(payload) {
    const isObj = typeof payload === 'object' && payload !== null;
    const q = isObj ? String(payload.text || '').trim() : String(payload ?? input).trim();
    const audio = isObj ? payload.audio : null;
    const isVoice = Boolean(isObj ? payload.isVoice || payload.audio : false);

    if ((!q && !audio) || busy) return;
    if (recognizerRef.current) {
      try { recognizerRef.current.stop(); } catch {}
      recognizerRef.current = null;
      setListening(false);
    }
    // Fuente de la clave: personal → proxy seguro → clave global. Sin ninguna, se ofrece conectar la propia.
    const { config, source } = await resolveAi(() => api.auth.accessToken());
    if (!source) { setSetup(true); return; }

    stopSpeech();
    setSpeakingId(null);

    const user = { id: ++uid, role: 'user', text: q, audio, isVoice };
    const bot = { id: ++uid, role: 'assistant', text: '', isVoice };
    const history = [...msgs, user].filter((m) => (m.text || m.audio) && !m.error).slice(-14).map((m) => ({ role: m.role, text: m.text, audio: m.audio }));
    while (history.length && history[0].role !== 'user') history.shift();

    setMsgs([...msgs, user, bot]);
    setInput('');
    setBusy(true);

    const c = new AbortController();
    ctl.current = c;
    let fullReply = '';

    try {
      fullReply = await streamChat({
        config, system: systemPrompt(d), history: withGuard(history), signal: c.signal,
        onDelta: (t) => {
          fullReply += t;
          setMsgs((cur) => cur.map((m) => (m.id === bot.id ? { ...m, text: m.text + t } : m)));
        },
      });

      // Si la interacción fue por voz o el modo voz está activo, Fructuosa lee su respuesta en voz alta
      if ((isVoice || voiceMode) && fullReply) {
        setSpeakingId(bot.id);
        speakReply(fullReply, {
          onEnd: () => setSpeakingId((cur) => (cur === bot.id ? null : cur)),
        });
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setMsgs((cur) => cur.map((m) => (m.id === bot.id ? { ...m, error: errorText(e) } : m)));
    } finally { setBusy(false); ctl.current = null; box.current?.focus(); }
  }

  const toggleVoice = () => {
    if (listening) {
      if (recognizerRef.current) {
        try { recognizerRef.current.stop(); } catch {}
        recognizerRef.current = null;
      }
      setListening(false);
      box.current?.focus();
      return;
    }

    const Speech = getSpeechRecognition();
    if (!Speech) {
      toast('Tu navegador no soporta reconocimiento de voz (Web Speech API). Usa Chrome, Safari o Edge.', { tone: 'bad' });
      return;
    }

    stopSpeech();
    setSpeakingId(null);

    try {
      const recog = new Speech();
      recog.lang = 'es-VE';
      recog.continuous = true;
      recog.interimResults = true;

      initialVoiceTextRef.current = input ? input.trim() + ' ' : '';

      recog.onstart = () => {
        setListening(true);
      };

      recog.onresult = (ev) => {
        let transcript = '';
        for (let i = 0; i < ev.results.length; i++) {
          transcript += ev.results[i][0].transcript;
        }
        const full = (initialVoiceTextRef.current + transcript).trimStart();
        setInput(full);
        if (box.current) {
          box.current.style.height = 'auto';
          box.current.style.height = Math.min(box.current.scrollHeight, 120) + 'px';
          box.current.scrollTop = box.current.scrollHeight;
        }
      };

      recog.onerror = (ev) => {
        if (ev.error === 'not-allowed') {
          toast('Permiso de micrófono denegado en el navegador.', { tone: 'bad' });
        } else if (ev.error !== 'no-speech') {
          console.warn('SpeechRecognition error:', ev.error);
        }
      };

      recog.onend = () => {
        setListening(false);
        recognizerRef.current = null;
      };

      recognizerRef.current = recog;
      recog.start();
    } catch (err) {
      console.warn('Error al iniciar micrófono:', err);
      setListening(false);
      recognizerRef.current = null;
      toast('No se pudo acceder al micrófono.', { tone: 'bad' });
    }
  };

  const startVoice = async () => {
    if (recording) return;
    stopSpeech();
    setSpeakingId(null);
    try {
      const session = new VoiceSession({
        onTranscript: (t) => setLiveTranscript(t),
        onVolume: (v) => setAudioVolume(v),
        onError: (err) => toast(err.message, { tone: 'bad' }),
      });
      voiceSessionRef.current = session;
      await session.start();
      setRecording(true);
      setRecordSeconds(0);
      setLiveTranscript('');
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (e) {
      toast(errorText(e), { tone: 'bad' });
    }
  };

  const stopVoice = async (sendNow = true) => {
    if (!voiceSessionRef.current) return;
    clearInterval(recordTimerRef.current);
    const session = voiceSessionRef.current;
    voiceSessionRef.current = null;
    setRecording(false);
    setAudioVolume(0);

    try {
      const res = await session.stop();
      const text = (res.transcript || liveTranscript || '').trim();
      if (sendNow && (text || res.audio)) {
        await send({ text, audio: res.audio, isVoice: true });
      }
    } catch (e) {
      toast('Error al capturar audio', { tone: 'bad' });
    }
  };

  const cancelVoice = () => {
    if (voiceSessionRef.current) {
      clearInterval(recordTimerRef.current);
      voiceSessionRef.current.cancel();
      voiceSessionRef.current = null;
    }
    setRecording(false);
    setAudioVolume(0);
    setLiveTranscript('');
  };

  const onToggleSpeak = (msg) => {
    if (speakingId === msg.id) {
      stopSpeech();
      setSpeakingId(null);
    } else {
      stopSpeech();
      setSpeakingId(msg.id);
      speakReply(msg.text, {
        onEnd: () => setSpeakingId((cur) => (cur === msg.id ? null : cur)),
      });
    }
  };

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

  const reset = () => { ctl.current?.abort(); stopSpeech(); setSpeakingId(null); setMsgs([]); setBusy(false); };
  const back = () => (history.length > 1 ? history.back() : go('#/'));

  return html`<div class="chat" role="region" aria-label="Copiloto IA">
    <header class="chat-head">
      <button class="icon-btn" onClick=${back} aria-label="Volver"><${Icon} name="left" /></button>
      <div class="grow"><b>Fructuosa</b><small class="muted">Tu asistente personal de finanzas</small></div>
      <button class=${'icon-btn' + (voiceMode ? ' on' : '')} onClick=${() => { setVoiceMode(!voiceMode); if (speakingId) { stopSpeech(); setSpeakingId(null); } }} title=${voiceMode ? 'Voz de Fructuosa activada' : 'Voz de Fructuosa silenciada'} aria-label="Modo de voz"><${Icon} name=${voiceMode ? 'volume' : 'volumeX'} size=${18} /></button>
      ${msgs.length > 0 && html`<button class="icon-btn" onClick=${reset} aria-label="Nueva conversación"><${Icon} name="refresh" size=${18} /></button>`}
      <button class="icon-btn" onClick=${() => setSetup(true)} aria-label="Configurar IA"><${Icon} name="sliders" size=${18} /></button>
    </header>

    <div class="chat-log" ref=${log} aria-live="polite">
      ${!msgs.length && html`<div class="chat-empty">
        <div class="chat-spark"><${Icon} name="sparkle" size=${30} /></div>
        <h2>Hola${profile.display_name ? ', ' + profile.display_name : ''} 👋</h2>
        <p>Soy Fructuosa. Puedes escribirme o hablarme por el micrófono. Pídeme conversiones, tus saldos o registrar un movimiento.</p>
        ${!ready && html`<button class="btn primary" onClick=${() => setSetup(true)}><${Icon} name="lock" size=${16} /> Conectar mi IA</button>`}
        <p class="chat-note">🔒 Para responderte se analiza un resumen de tus cuentas, tasas y últimos movimientos. No se guarda la conversación.</p>
        <div class="chat-sugg">${suggestions.map((s) => html`<button key=${s} class="chip" onClick=${() => send(s)}>${s}</button>`)}</div>
      </div>`}
      ${msgs.map((m) => html`<${Bubble} key=${m.id} m=${m} d=${d} onBlock=${onBlock} speaking=${speakingId === m.id} onToggleSpeak=${onToggleSpeak} />`)}
    </div>

    <form class="chat-input" onSubmit=${(e) => { e.preventDefault(); send(); }}>
      <textarea ref=${box} rows="1" class="input"
        placeholder=${listening ? "Escuchando tu voz… habla ahora" : "Pregunta o habla con Fructuosa…"}
        value=${input} maxLength="600"
        onInput=${(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
        onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}></textarea>
      <button type="button" class=${'icon-btn mic' + (listening ? ' listening' : '')} onClick=${toggleVoice}
        aria-label=${listening ? "Detener micrófono" : "Hablar con Fructuosa por micrófono"}
        title=${listening ? "Detener micrófono" : "Hablar con Fructuosa (Micrófono)"}>
        <${Icon} name=${listening ? 'micOff' : 'mic'} size=${19} />
      </button>
      ${busy
        ? html`<button type="button" class="icon-btn send stop" onClick=${() => { ctl.current?.abort(); stopSpeech(); }} aria-label="Detener"><${Icon} name="x" size=${20} /></button>`
        : html`<button type="submit" class="icon-btn send" disabled=${!input.trim()} aria-label="Enviar a Gemini"><${Icon} name="send" size=${19} /></button>`}
    </form>

    ${setup && html`<${Sheet} title=${SHARED_AI ? 'Copiloto IA · opcional' : 'Copiloto IA'} onClose=${() => setSetup(false)}>
      ${(close) => html`<${AiSettings} onSaved=${(c) => { setCfg(c); if (aiReady(c)) close(); }} />`}
    <//>`}
  </div>`;
}
