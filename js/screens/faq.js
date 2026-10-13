// Preguntas frecuentes (Más › Preguntas frecuentes): el contenido vive en ../faq.js.
// Buscador sin tildes, filtro por tema y acordeones. Cada país ve solo sus preguntas.
import { useMemo, useState } from 'react';
import { html, Icon, Empty } from '../ui.js';
import { useData } from '../store.js';
import { PageHeader } from './common.js';
import { faqFor, searchFaq } from '../faq.js';

export function FaqPage() {
  const { region, investmentsOn } = useData();
  const all = useMemo(() => faqFor({ region, investmentsOn }), [region, investmentsOn]);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('todas');
  const searching = q.trim().length > 0;
  // Al buscar se mira en todos los temas; sin búsqueda, en el tema elegido.
  const shown = searching ? searchFaq(all, q) : all.filter((g) => topic === 'todas' || g.id === topic);
  const count = shown.reduce((n, g) => n + g.items.length, 0);

  return html`<div class="page faq">
    <${PageHeader} title="Preguntas frecuentes" sub="Respuestas rápidas sobre cómo funciona La Fructosa" back="#/mas" />

    <div class="search faq-search"><${Icon} name="search" size=${18} />
      <input class="input" type="search" placeholder="Busca: contraseña, respaldo, tasas…" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Buscar en las preguntas frecuentes" />
      ${searching && html`<button class="icon-btn sm" onClick=${() => setQ('')} aria-label="Borrar búsqueda"><${Icon} name="x" size=${16} /></button>`}
    </div>

    ${!searching && html`<div class="chips faq-topics" role="tablist" aria-label="Temas">
      ${[{ id: 'todas', emoji: '', title: 'Todas' }, ...all].map((g) => html`<button key=${g.id} type="button" role="tab" aria-selected=${topic === g.id}
        class=${'chip' + (topic === g.id ? ' on' : '')} onClick=${() => setTopic(g.id)}>${g.emoji && html`<span>${g.emoji}</span>`}${g.title}</button>`)}
    </div>`}

    ${searching && html`<p class="hint" role="status">${count === 1 ? '1 respuesta' : `${count} respuestas`}</p>`}

    ${count === 0 ? html`<${Empty} art="search" title="Sin resultados" text="Prueba con otra palabra o pregúntale a Fructosa." />`
      : shown.map((g) => html`<section key=${g.id} class="faq-group">
        <h2 class="faq-group-title"><span aria-hidden="true">${g.emoji}</span> ${g.title}</h2>
        <div class="stack sm">${g.items.map((it) => html`<details key=${it.q} class="card pad glossary faq-item" open=${searching && count <= 3}>
          <summary><b>${it.q}</b><${Icon} name="down" size=${18} /></summary>
          <div class="prose">${it.a.map((p, i) => html`<p key=${i}>${p}</p>`)}</div>
        </details>`)}</div>
      </section>`)}

    <a class="card pad tour-cta faq-more" href="#/copiloto">
      <span class="tile-ico" style=${{ '--tc': '#FFC6FF' }}><${Icon} name="sparkle" /></span>
      <span><b>¿No encontraste tu respuesta?</b><small>Pregúntale a Fructosa o revisa el Manual de uso</small></span>
      <${Icon} name="right" class="muted" />
    </a>
  </div>`;
}
