// Manual de uso (Más › Manual de uso): el contenido vive en ../howToUseIt.js.
import { html, Icon, SectionTitle } from '../ui.js';
import { useData, usePref } from '../store.js';
import { GLOSSARY } from '../learn.js';
import { PageHeader, go } from './common.js';
import { REGIONS } from '../money.js';
import { CORE, MORE, FINANCE_GUIDE, BY_REGION, INSTALL_IPHONE, INSTALL_ANDROID, APP_URL, MANUAL_VERSION, applies } from '../howToUseIt.js';

const Steps = ({ items }) => html`<ol class="manual-steps">${items.map((t, i) => html`<li key=${i}>${t}</li>`)}</ol>`;

export function LearnPage() {
  const { profile, region } = useData();
  const [, setTourDone] = usePref('tour-done', false);
  const mine = REGIONS[profile?.region] ? profile.region : 'VE';
  const more = MORE.filter((m) => applies(m, region));
  const tips = FINANCE_GUIDE.tips.filter((t) => applies(t, region));
  const regions = [mine, ...Object.keys(BY_REGION).filter((k) => k !== mine)];
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  const replayTour = () => { setTourDone(false); go('#/'); window.scrollTo(0, 0); };

  return html`<div class="page">
    <${PageHeader} title="Manual de uso" sub=${`Todo lo que puedes hacer en La Fructosa · ${MANUAL_VERSION}`} back="#/mas" />

    <button class="card pad tour-cta" onClick=${replayTour}>
      <span class="tile-ico" style=${{ '--tc': '#FFADAD' }}><${Icon} name="sparkle" /></span>
      <span><b>Ver el tour otra vez</b><small>Te lo enseñamos paso a paso, en 1 minuto</small></span>
      <${Icon} name="right" class="muted" />
    </button>

    <${SectionTitle}>Paso a paso<//>
    <div class="stack sm">${CORE.map((s, i) => html`<details key=${s.id} class="card pad glossary" open=${i === 0}>
      <summary><b>${s.emoji} ${s.title}</b><${Icon} name="down" size=${18} /></summary>
      <div class="prose">
        <p>${s.intro}</p>
        <${Steps} items=${s.steps} />
        ${s.tips.map((t, k) => html`<p key=${k} class="manual-tip">💡 ${t}</p>`)}
      </div>
    </details>`)}</div>

    <${SectionTitle}>Guía de finanzas personales<//>
    <div class="card pad prose manual-guide">
      <p class="manual-motto">“${FINANCE_GUIDE.motto}”</p>
      <p>${FINANCE_GUIDE.intro}</p>
    </div>
    <div class="stack sm">${tips.map((t) => html`<details key=${t.title} class="card pad glossary">
      <summary><b>${t.emoji} ${t.title}</b><${Icon} name="down" size=${18} /></summary>
      <div class="prose"><p>${t.body}</p></div>
    </details>`)}</div>
    <div class="card pad prose">
      <p><b>Tu rutina con La Fructosa</b></p>
      <${Steps} items=${FINANCE_GUIDE.weekly} />
    </div>

    <${SectionTitle}>Más funciones<//>
    <div class="stack sm">${more.map((m) => html`<details key=${m.title} class="card pad glossary">
      <summary><b>${m.emoji} ${m.title}</b><${Icon} name="down" size=${18} /></summary>
      <div class="prose">${m.body.map((p, i) => html`<p key=${i}>${p}</p>`)}</div>
    </details>`)}</div>

    <${SectionTitle}>Instalar en tu teléfono<//>
    <details class="card pad glossary" open=${!installed && isIos}>
      <summary><b>📱 iPhone (Safari)</b><${Icon} name="down" size=${18} /></summary>
      <div class="prose"><${Steps} items=${INSTALL_IPHONE} /></div>
    </details>
    <details class="card pad glossary" open=${!installed && !isIos}>
      <summary><b>🤖 Android (Chrome)</b><${Icon} name="down" size=${18} /></summary>
      <div class="prose"><${Steps} items=${INSTALL_ANDROID} /></div>
    </details>
    <p class="hint">Enlace de la app: <a href=${APP_URL}>${APP_URL.replace('https://', '')}</a></p>

    <${SectionTitle}>Según tu país<//>
    <div class="stack sm">${regions.map((k) => html`<div key=${k} class=${'card pad prose' + (k === mine ? ' region-mine' : '')}>
      <p><b>${REGIONS[k].flag} ${BY_REGION[k].title}${k === mine ? ' · tu país' : ''}</b></p>
      <p>${BY_REGION[k].text}</p>
    </div>`)}</div>
    <p class="hint">¿Cambiaste de país? Lo ajustas en Ajustes y las sugerencias se actualizan solas.</p>

    <${SectionTitle}>Palabras que te pueden sonar raras<//>
    <div class="stack sm">${Object.entries(GLOSSARY).map(([k, g]) => html`<details key=${k} class="card pad glossary">
      <summary><b>${g.title}</b><${Icon} name="down" size=${18} /></summary>
      <div class="prose">${g.body.map((p, i) => html`<p key=${i}>${p}</p>`)}</div>
    </details>`)}</div>
  </div>`;
}
