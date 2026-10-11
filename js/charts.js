// Gráficos SVG ligeros, sin librerías.
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

export function Sparkline({ points, width = 300, height = 64, color = 'var(--blue)' }) {
  if (points.length < 2) return html`<div class="spark-empty">Sin historial suficiente</div>`;
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
