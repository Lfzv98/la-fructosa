// Gráficos SVG ligeros, sin librerías.
import { useState } from 'react';
import { html } from './ui.js';

export function Donut({ data, size = 168, stroke = 22, center }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const gap = data.length > 1 ? 2 : 0;
  return html`<div class="donut" style=${{ width: size, height: size }}>
    <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`} role="img" aria-label="Distribución">
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="var(--surface-2)" stroke-width=${stroke} />
      ${data.map((d, i) => {
        const len = (d.value / total) * C;
        const el = html`<circle key=${i} cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${d.color}
          stroke-width=${stroke} stroke-dasharray=${`${Math.max(0, len - gap)} ${C}`} stroke-dashoffset=${-acc}
          transform=${`rotate(-90 ${size / 2} ${size / 2})`} />`;
        acc += len;
        return el;
      })}
    </svg>
    ${center && html`<div class="donut-center">${center}</div>`}
  </div>`;
}

// Barras agrupadas: ingresos vs gastos por mes.
export function Bars({ data, height = 150, onPick, picked }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  return html`<div class="bars" style=${{ height }}>
    ${data.map((d) => html`<button key=${d.key} type="button" class=${'bar-col' + (picked === d.key ? ' on' : '')} onClick=${() => onPick?.(d.key)}>
      <div class="bar-pair">
        <i class="bar inc" style=${{ height: `${(d.income / max) * 100}%` }}></i>
        <i class="bar exp" style=${{ height: `${(d.expense / max) * 100}%` }}></i>
      </div>
      <span>${d.label}</span>
    </button>`)}
  </div>`;
}

export function Sparkline({ points, width = 300, height = 64, color = 'var(--blue)', empty = 'Sin historial suficiente' }) {
  if (points.length < 2) return empty ? html`<div class="spark-empty">${empty}</div>` : null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * width, height - 4 - ((p - min) / span) * (height - 8)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  return html`<svg class="spark" viewBox=${`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height=${height}>
    <defs><linearGradient id=${id} x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color=${color} stop-opacity=".35" /><stop offset="1" stop-color=${color} stop-opacity="0" />
    </linearGradient></defs>
    <path d=${`${d} L${width},${height} L0,${height} Z`} fill=${`url(#${id})`} />
    <path d=${d} fill="none" stroke=${color} stroke-width="2" vector-effect="non-scaling-stroke" />
  </svg>`;
}

// Línea con ejes: historial de una tasa. Toca o arrastra para leer el valor de cada día.
// points: [{ date: 'AAAA-MM-DD', value }], ordenados por fecha.
export function LineChart({ points, height = 180, color = 'var(--blue)', format = (v) => String(v), empty = 'Sin historial suficiente' }) {
  const [pick, setPick] = useState(null);
  if (points.length < 2) return html`<div class="spark-empty lc-empty">${empty}</div>`;
  const W = 320, H = height, L = 4, R = 4, T = 10, B = 22;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min) * 0.08 || max * 0.01 || 1;
  const lo = min - pad, hi = max + pad;
  const x = (i) => L + (i / (points.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const id = 'lc' + Math.random().toString(36).slice(2, 7);
  const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const ticks = [0, Math.round((points.length - 1) / 2), points.length - 1];
  const sel = pick != null ? points[pick] : null;
  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - box.left;
    const i = Math.round(((cx / box.width) * W - L) / (W - L - R) * (points.length - 1));
    setPick(Math.max(0, Math.min(points.length - 1, i)));
  };
  return html`<div class="linechart">
    <div class="linechart-read">${sel
      ? html`<span class="muted">${dm(sel.date)}/${sel.date.slice(0, 4)}</span> <b class="num">${format(sel.value)}</b>`
      : html`<span class="muted">Toca la línea para ver cada día</span>`}</div>
    <svg viewBox=${`0 0 ${W} ${H}`} width="100%" height=${H} role="img" aria-label="Historial"
      onPointerDown=${onMove} onPointerMove=${(e) => (e.buttons || e.pointerType === 'touch') && onMove(e)}
      onPointerLeave=${() => setPick(null)}>
      <defs><linearGradient id=${id} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color=${color} stop-opacity=".3" /><stop offset="1" stop-color=${color} stop-opacity="0" />
      </linearGradient></defs>
      ${[max, (max + min) / 2, min].map((v, i) => html`<g key=${i}>
        <line x1=${L} x2=${W - R} y1=${y(v)} y2=${y(v)} class="lc-grid" />
        <text x=${W - R} y=${y(v) - 3} text-anchor="end" class="lc-label">${format(v)}</text>
      </g>`)}
      <path d=${`${d} L${x(points.length - 1)},${H - B} L${x(0)},${H - B} Z`} fill=${`url(#${id})`} />
      <path d=${d} fill="none" stroke=${color} stroke-width="2.2" stroke-linejoin="round" />
      ${ticks.map((i, k) => html`<text key=${k} x=${x(i)} y=${H - 6} text-anchor=${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} class="lc-label">${dm(points[i].date)}</text>`)}
      ${sel && html`<g>
        <line x1=${x(pick)} x2=${x(pick)} y1=${T} y2=${H - B} class="lc-cursor" />
        <circle cx=${x(pick)} cy=${y(sel.value)} r="4.5" fill=${color} stroke="var(--bg)" stroke-width="2" />
      </g>`}
    </svg>
  </div>`;
}
