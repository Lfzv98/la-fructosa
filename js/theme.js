// Tema de la app: 'dark' (predeterminado), 'light' o 'auto' (sigue al teléfono).
// index.html aplica el guardado antes de pintar; aquí se cambia en vivo desde Ajustes.
const mq = matchMedia('(prefers-color-scheme: light)');
let current = 'dark';

export function applyTheme(t = 'dark') {
  current = t;
  const light = t === 'light' || (t === 'auto' && mq.matches);
  const root = document.documentElement;
  if (light) root.dataset.theme = 'light'; else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#F3F6FB' : '#0E1422');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', light ? 'light' : 'dark');
}
mq.addEventListener?.('change', () => { if (current === 'auto') applyTheme('auto'); });
try { current = JSON.parse(localStorage.getItem('fructosa-pref-theme') || '"dark"'); } catch { /* nada */ }
