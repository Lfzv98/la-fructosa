// La Fructosa · Motor del libro digital: páginas que se doblan como papel de verdad.
// Sin librerías. Geometría del doblez: la esquina de la hoja va hacia el dedo (P); el pliegue es la
// mediatriz entre la esquina (C) y P. Lo que queda del lado de la esquina se refleja sobre el pliegue
// (la "solapa", que muestra el reverso) y deja ver la página de abajo, con sombras que siguen al pliegue.
//
// Coordenadas: origen en el lomo (x = 0), x hacia la derecha, y hacia abajo. Una página derecha ocupa
// [0, W] × [0, H]; una izquierda (modo libro abierto) ocupa [-W, 0] × [0, H].

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Recorta un polígono con el semiplano (X − M)·n ≤ 0 (keep = -1) o > 0 (keep = 1).
function clipPoly(pts, M, n, keep) {
  const f = (p) => keep * ((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
const polyCSS = (pts, dx = 0) => (pts.length < 3 ? 'polygon(0 0,0 0,0 0)'
  : `polygon(${pts.map((p) => `${(p[0] + dx).toFixed(2)}px ${p[1].toFixed(2)}px`).join(',')})`);

// Degradado lineal perpendicular al pliegue, para una caja que empieza en x = ox (coordenadas del lomo).
function foldGradient(bw, bh, ox, M, g, stops) {
  const theta = Math.atan2(g[0], -g[1]);
  const L = Math.abs(bw * Math.sin(theta)) + Math.abs(bh * Math.cos(theta));
  const cx = ox + bw / 2, cy = bh / 2;
  const sx = cx - (g[0] * L) / 2, sy = cy - (g[1] * L) / 2;
  const t0 = (M[0] - sx) * g[0] + (M[1] - sy) * g[1];
  return `linear-gradient(${(theta * 180 / Math.PI).toFixed(2)}deg, ${stops.map(([d, c]) => `${c} ${(t0 + d).toFixed(1)}px`).join(', ')})`;
}

// Sonido de hoja (ruido filtrado, sin archivos).
let audio = null;
function rustle() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const dur = 0.42, sr = audio.sampleRate, buf = audio.createBuffer(1, Math.floor(sr * dur), sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const t = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25)), 1.6) * (0.55 + 0.45 * Math.random()); }
    const src = audio.createBufferSource(); src.buffer = buf;
    const bp = audio.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(4200, audio.currentTime); bp.frequency.exponentialRampToValueAtTime(1300, audio.currentTime + dur);
    const gain = audio.createGain(); gain.gain.value = 0.16;
    src.connect(bp).connect(gain).connect(audio.destination); src.start();
  } catch { /* sin sonido */ }
}

export class FlipBook {
  // root: contenedor vacío. opts.onChange(view), opts.sound() → boolean
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.pages = [];
    this.view = 0;           // modo hoja: índice de página; modo libro abierto: derecha = 2·view
    this.flip = null;
    this.mode = 'single';
    this.W = 300; this.H = 500;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    root.classList.add('fb');
    root.innerHTML = `<div class="fb-spine">
      <div class="fb-slot fb-l"></div><div class="fb-slot fb-r"></div>
      <div class="fb-shade-r"></div>
      <div class="fb-front"></div>
      <div class="fb-flap"><div class="fb-back"></div><div class="fb-gloss"></div></div>
    </div><div class="fb-gutter"></div>`;
    const $ = (s) => root.querySelector(s);
    this.el = { spine: $('.fb-spine'), L: $('.fb-l'), R: $('.fb-r'), shade: $('.fb-shade-r'), front: $('.fb-front'), flap: $('.fb-flap'), back: $('.fb-back'), gloss: $('.fb-gloss') };
    this.bindInput();
  }

  get spread() { return this.mode === 'spread'; }
  get count() { return this.pages.length; }
  // Páginas visibles de una vista: [izquierda, derecha]
  pair(v) { return this.spread ? [2 * v - 1, 2 * v] : [-1, v]; }
  get lastView() { return this.spread ? Math.ceil((this.count - 1) / 2) : this.count - 1; }
  viewOf(i) { return this.spread ? Math.ceil(i / 2) : i; }
  page(i) { return i >= 0 && i < this.count ? this.pages[i] : null; }
  visiblePages() { return this.pair(this.view).filter((i) => this.page(i)); }

  setPages(pages, pageIndex = 0) {
    this.cancel();
    this.pages = pages;
    this.view = clamp(this.viewOf(pageIndex), 0, Math.max(0, this.lastView));
    this.render();
  }

  layout({ mode, W, H }) {
    this.cancel();
    const first = this.visiblePages()[0] ?? 0;
    this.mode = mode; this.W = W; this.H = H;
    this.root.style.setProperty('--W', `${W}px`);
    this.root.style.setProperty('--H', `${H}px`);
    this.root.style.width = `${mode === 'spread' ? 2 * W : W}px`;
    this.root.style.height = `${H}px`;
    this.root.classList.toggle('fb-spread', mode === 'spread');
    this.el.spine.style.left = `${mode === 'spread' ? W : 0}px`;
    if (this.count) this.view = clamp(this.viewOf(first), 0, this.lastView);
  }

  // Coloca una página en un hueco (mueve el nodo; un nodo vive en un solo lugar).
  put(slot, i) {
    const node = this.page(i);
    if (slot.firstChild !== node || slot.childNodes.length !== 1) slot.replaceChildren(...(node ? [node] : []));
  }

  render() {
    const [l, r] = this.pair(this.view);
    this.put(this.el.L, this.spread ? l : -1);
    this.put(this.el.R, r);
    this.el.front.replaceChildren(); this.el.back.replaceChildren();
    this.root.classList.remove('fb-flipping');
    this.el.shade.style.background = 'none';
    this.el.flap.style.visibility = 'hidden';
    this.el.front.style.visibility = 'hidden';
    // Grosor de las hojas a cada lado (se ve el canto del libro).
    const done = this.visiblePages().length ? this.visiblePages()[0] : 0;
    this.root.style.setProperty('--lt', `${Math.min(10, Math.round((done / Math.max(1, this.count)) * 10))}px`);
    this.root.style.setProperty('--rt', `${Math.min(10, Math.round(((this.count - done) / Math.max(1, this.count)) * 10))}px`);
    this.closed(this.view);
    this.opts.onChange?.(this.view);
  }

  // Libro cerrado (tapa o contraportada sola): se centra en la pantalla.
  closed(v) {
    const r = this.pair(v)[1];
    this.root.classList.toggle('fb-closed-front', this.spread && v === 0);
    this.root.classList.toggle('fb-closed-back', this.spread && !this.page(r) && v > 0);
  }

  // ---------- Vuelta de página ----------
  canGo(dir) { return dir > 0 ? this.view < this.lastView : this.view > 0; }

  // Prepara una vuelta hacia la vista `to` (dir = ±1). cy = esquina (0 arriba, H abajo).
  begin(dir, to, cy) {
    const W = this.W, H = this.H, s = this.spread;
    const [l0, r0] = this.pair(this.view), [l1, r1] = this.pair(to);
    let L, R, F, B;
    if (dir > 0) { L = l0; R = r1; F = r0; B = s ? l1 : r0; } else { L = l1; R = r0; F = r1; B = s ? l0 : r1; }
    this.put(this.el.L, s ? L : -1);
    this.put(this.el.R, R);
    const front = this.page(F);
    this.el.front.replaceChildren(...(front ? [front] : []));
    if (s) {
      const back = this.page(B);
      this.el.back.replaceChildren(...(back ? [back] : []));
    } else if (front) {
      // En el teléfono el reverso es la misma hoja vista al trasluz.
      const c = front.cloneNode(true);
      c.removeAttribute('id'); c.setAttribute('aria-hidden', 'true');
      const paper = document.createElement('div'); paper.className = 'fb-backpaper';
      c.appendChild(paper);
      this.el.back.replaceChildren(c);
    }
    this.el.front.style.visibility = front ? 'visible' : 'hidden';
    this.el.flap.style.visibility = 'visible';
    this.root.classList.add('fb-flipping');
    const C = [W, cy];
    const start = dir > 0 ? [W - 0.5, cy] : [-W + 0.5, cy];
    this.flip = { dir, to, C, P: start, cy };
    this.draw(start);
  }

  constrain(P) {
    const { W, H } = this, cy = this.flip.cy;
    let [x, y] = P;
    // La hoja no se rasga: la esquina no se aleja del lomo más que el ancho (o la diagonal).
    const s1 = [0, cy], d1 = Math.hypot(x - s1[0], y - s1[1]);
    if (d1 > W) { x = s1[0] + ((x - s1[0]) * W) / d1; y = s1[1] + ((y - s1[1]) * W) / d1; }
    const s2 = [0, H - cy], D = Math.hypot(W, H), d2 = Math.hypot(x - s2[0], y - s2[1]);
    if (d2 > D) { x = s2[0] + ((x - s2[0]) * D) / d2; y = s2[1] + ((y - s2[1]) * D) / d2; }
    return [x, y];
  }

  draw(Pin) {
    const f = this.flip; if (!f) return;
    const { W, H } = this, s = this.spread;
    const P = this.constrain(Pin);
    f.P = P;
    const C = f.C;
    const dx = C[0] - P[0], dy = C[1] - P[1], dist = Math.hypot(dx, dy);
    const { front, back, flap, gloss, shade } = this.el;
    if (dist < 0.5) {
      front.style.clipPath = 'none'; flap.style.visibility = 'hidden'; shade.style.background = 'none';
      return;
    }
    flap.style.visibility = 'visible';
    const n = [dx / dist, dy / dist];
    const M = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2];
    const rect = [[0, 0], [W, 0], [W, H], [0, H]];
    const frontPoly = clipPoly(rect, M, n, -1);
    const beyond = clipPoly(rect, M, n, 1);
    front.style.clipPath = polyCSS(frontPoly);

    // Reflejo sobre el pliegue: X' = A·X + b
    const a = 1 - 2 * n[0] * n[0], bb = -2 * n[0] * n[1], d = 1 - 2 * n[1] * n[1];
    const k = 2 * (M[0] * n[0] + M[1] * n[1]);
    const e = k * n[0], fy = k * n[1];
    if (s) {
      // Reverso = página izquierda (coordenadas u ∈ [0, W]), sin espejo: T = Reflejo ∘ Lomo.
      back.style.transform = `matrix(${-a},${-bb},${bb},${d},${a * W + e},${bb * W + fy})`;
      back.style.clipPath = polyCSS(beyond.map(([x, y]) => [W - x, y]));
    } else {
      back.style.transform = `matrix(${a},${bb},${bb},${d},${e},${fy})`;
      back.style.clipPath = polyCSS(beyond);
    }
    const flapPoly = beyond.map(([x, y]) => [a * x + bb * y + e, bb * x + d * y + fy]);

    const progress = clamp(dist / (2 * W), 0, 1);
    const life = Math.sin(Math.PI * progress) * 0.85 + 0.15 * (1 - progress);
    const depth = Math.max(24, dist / 2);
    // Sombra sobre la página de abajo, que nace en el pliegue.
    shade.style.background = foldGradient(W, H, 0, M, n, [
      [0, `rgba(0,0,0,${(0.5 * life).toFixed(3)})`],
      [Math.min(depth, W) * 0.22, `rgba(0,0,0,${(0.2 * life).toFixed(3)})`],
      [Math.min(depth * 1.1, W) * 0.6 + 12, 'rgba(0,0,0,0)'],
    ]);
    // Brillo y curva del papel sobre la solapa.
    gloss.style.clipPath = polyCSS(flapPoly, W);
    gloss.style.background = foldGradient(2 * W, H, -W, M, [-n[0], -n[1]], [
      [0, `rgba(0,0,0,${(0.22 * life).toFixed(3)})`],
      [Math.max(4, depth * 0.06), `rgba(255,255,255,${(0.28 * life).toFixed(3)})`],
      [depth * 0.45, 'rgba(255,255,255,0)'],
      [depth, `rgba(0,0,0,${(0.08 * life).toFixed(3)})`],
    ]);
  }

  animate(to, ms, lift, done) {
    const f = this.flip; if (!f) return;
    cancelAnimationFrame(this.raf);
    const from = f.P.slice(), t0 = performance.now(), dur = this.reduced ? 1 : ms;
    const up = f.cy > this.H / 2 ? -1 : 1;
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1), k = ease(t);
      this.draw([from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k + up * lift * Math.sin(Math.PI * t)]);
      if (t < 1) this.raf = requestAnimationFrame(step); else done?.();
    };
    this.raf = requestAnimationFrame(step);
  }

  // Termina (true) o devuelve (false) la vuelta en curso.
  settle(complete) {
    const f = this.flip; if (!f) return;
    const W = this.W;
    const remaining = Math.abs((complete === (f.dir > 0) ? -W : W) - f.P[0]) / (2 * W);
    const ms = 260 + 520 * remaining;
    if (complete && !f.sounded && this.opts.sound?.()) rustle();
    f.busy = true;
    if (complete) this.closed(f.to);
    const target = complete === (f.dir > 0) ? [-W, f.cy] : [W, f.cy];
    this.animate(target, ms, Math.min(this.H * 0.12, 90) * remaining, () => {
      if (complete) this.view = f.to;
      this.flip = null;
      this.render();
      const q = this.queued; this.queued = null;
      if (q) q();
    });
  }

  cancel() {
    cancelAnimationFrame(this.raf);
    if (this.flip) { this.flip = null; this.render(); }
  }

  turn(dir, to = this.view + dir) {
    if (this.flip?.busy) { this.queued = () => this.turn(dir, to); return; }
    if (this.flip) this.cancel();
    to = clamp(to, 0, this.lastView);
    if (to === this.view) return;
    this.begin(dir, to, this.H);
    if (this.opts.sound?.()) { rustle(); this.flip.sounded = true; }
    this.flip.busy = true;
    this.closed(to);
    const W = this.W;
    this.animate(dir > 0 ? [-W, this.H] : [W, this.H], 820, this.H * 0.2, () => {
      this.view = to; this.flip = null; this.render();
      const q = this.queued; this.queued = null;
      if (q) q();
    });
  }
  // Invitación: la esquina se levanta sola un momento para que se note que es un libro.
  teaser() {
    if (this.flip || !this.canGo(1) || this.reduced) return;
    const W = this.W, H = this.H;
    this.begin(1, this.view + 1, H);
    this.flip.busy = true;
    this.animate([W - Math.min(170, W * 0.32), H - Math.min(120, H * 0.14)], 700, 0, () => setTimeout(() => {
      if (!this.flip) return;
      this.animate([W - 0.5, H], 520, 0, () => { this.flip = null; this.render(); });
    }, 320));
  }

  next() { if (this.canGo(1)) this.turn(1); }
  prev() { if (this.canGo(-1)) this.turn(-1); }
  goToPage(i) {
    const v = clamp(this.viewOf(i), 0, this.lastView);
    if (v !== this.view) this.turn(v > this.view ? 1 : -1, v);
  }

  // ---------- Dedo, mouse y teclado ----------
  local(e) {
    const r = this.el.spine.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  bindInput() {
    const root = this.root;
    let drag = null;
    const isUI = (t) => t.closest && t.closest('a, button, input, select, label, [data-noflip]');

    root.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || isUI(e.target) || this.flip?.busy) return;
      const [x, y] = this.local(e);
      drag = { id: e.pointerId, x0: x, y0: y, t: performance.now(), x, y, vx: 0, moved: false, side: x >= 0 ? 1 : -1 };
      root.setPointerCapture?.(e.pointerId);
    });

    root.addEventListener('pointermove', (e) => {
      const [x, y] = this.local(e);
      if (!drag) { this.hover(x, y, e.pointerType); return; }
      if (e.pointerId !== drag.id) return;
      const now = performance.now(), dt = Math.max(1, now - drag.t);
      drag.vx = 0.7 * drag.vx + 0.3 * ((x - drag.x) / dt);
      drag.x = x; drag.y = y; drag.t = now;
      const dx = x - drag.x0, dy = y - drag.y0;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 7) return;
        if (Math.abs(dy) > Math.abs(dx) * 1.6) { drag = null; return; } // movimiento vertical: no es pasar página
        if (this.flip?.peek) {
          // La esquina ya estaba levantada: se sigue desde ahí.
          this.flip.peek = false; cancelAnimationFrame(this.peekLoop); this.peekLoop = 0;
          drag.dir = this.flip.dir; drag.moved = true; drag.P0 = this.flip.P.slice(); drag.k = 1;
        } else {
          const dir = this.spread ? (drag.side > 0 ? 1 : -1) : (dx < 0 ? 1 : -1);
          if (this.spread && Math.sign(dx) === dir) { drag = null; return; }
          if (!this.canGo(dir)) { drag = null; return; }
          this.cancel();
          const cy = drag.y0 > this.H / 2 ? this.H : 0;
          this.begin(dir, this.view + dir, cy);
          drag.dir = dir; drag.moved = true; drag.P0 = this.flip.P.slice();
          // Si agarras cerca de la esquina, la esquina sigue al dedo; si no, la hoja avanza más rápido.
          const corner = dir > 0 ? [this.W, cy] : [-this.W, cy];
          drag.k = this.spread && Math.hypot(drag.x0 - corner[0], drag.y0 - corner[1]) < 140 ? 1 : (this.spread ? 1.6 : 2);
        }
      }
      if (this.flip) {
        this.flip.peek = false;
        const k = drag.k || 1.4;
        this.draw([drag.P0[0] + dx * k, drag.P0[1] + dy * (this.spread ? 1 : 0.6)]);
      }
      e.preventDefault();
    });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.moved) { this.tap(d.x0, d.y0); return; }
      if (!this.flip) return;
      const W = this.W, P = this.flip.P;
      const p = this.flip.dir > 0 ? (W - P[0]) / (2 * W) : (P[0] + W) / (2 * W);
      const fling = this.flip.dir > 0 ? d.vx < -0.35 : d.vx > 0.35;
      const back = this.flip.dir > 0 ? d.vx > 0.35 : d.vx < -0.35;
      this.settle(!back && (p > 0.3 || fling));
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { drag = null; if (this.flip && !this.flip.busy) this.settle(false); } });
    root.addEventListener('pointerleave', (e) => { if (!drag && this.flip?.peek) this.unpeek(); });

    // Trackpad: deslizar con dos dedos hacia los lados.
    let wheelLock = 0;
    root.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 18) return;
      e.preventDefault();
      const now = performance.now(); if (now < wheelLock) return;
      wheelLock = now + 700;
      if (e.deltaX > 0) this.next(); else this.prev();
    }, { passive: false });
  }

  tap(x, y) {
    if (this.flip?.peek) { this.flip.peek = false; cancelAnimationFrame(this.peekLoop); this.peekLoop = 0; this.settle(true); return; }
    const W = this.W;
    if (this.spread) { if (x >= 0) this.next(); else this.prev(); return; }
    if (x > W * 0.58) this.next(); else if (x < W * 0.42) this.prev();
  }

  // En computadora: al acercar el mouse a una esquina, la hoja se levanta un poquito.
  hover(x, y, type) {
    if (type !== 'mouse' || this.reduced) return;
    if (this.flip && !this.flip.peek) return;
    const W = this.W, H = this.H, R = 90;
    let dir = 0, cy = H;
    for (const c of [0, H]) {
      if (Math.hypot(x - W, y - c) < R && this.canGo(1)) { dir = 1; cy = c; }
      if (this.spread && Math.hypot(x + W, y - c) < R && this.canGo(-1)) { dir = -1; cy = c; }
    }
    if (!dir) { if (this.flip?.peek) this.unpeek(); return; }
    if (this.flip && (this.flip.dir !== dir || this.flip.cy !== cy)) return;
    if (!this.flip) { this.begin(dir, this.view + dir, cy); this.flip.peek = true; }
    const base = dir > 0 ? W : -W;
    const pull = clamp(75 - Math.hypot(x - base, y - cy) * 0.45, 22, 75);
    this.flip.target = [base - dir * pull, cy + (cy ? -pull : pull)];
    if (!this.peekLoop) {
      const loop = () => {
        const f = this.flip;
        if (!f || !f.peek) { this.peekLoop = 0; return; }
        const P = f.P, T = f.target;
        if (Math.hypot(T[0] - P[0], T[1] - P[1]) < 0.4) { this.peekLoop = 0; return; }
        this.draw([P[0] + (T[0] - P[0]) * 0.22, P[1] + (T[1] - P[1]) * 0.22]);
        this.peekLoop = requestAnimationFrame(loop);
      };
      this.peekLoop = requestAnimationFrame(loop);
    }
  }

  unpeek() {
    const f = this.flip; if (!f) return;
    f.peek = false; f.busy = true; cancelAnimationFrame(this.peekLoop); this.peekLoop = 0;
    const W = this.W;
    this.animate(f.dir > 0 ? [W, f.cy] : [-W, f.cy], 220, 0, () => { this.flip = null; this.render(); });
  }
}
