// Exporta movimientos a CSV (se abre en Excel, Numbers o Google Sheets).
import { toast } from './ui.js';
import { todayISO } from './money.js';

const TYPE = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };

export async function exportCSV(txs, accById, name = 'movimientos') {
  const head = ['Fecha', 'Tipo', 'Cuenta', 'Moneda', 'Monto', 'Categoría', 'Descripción', 'Cuenta destino', 'Monto destino', 'Pagado en Bs.', 'Tasa usada', 'Tasa BCV'];
  const num = (n) => (n == null || n === '' ? '' : String(Number(n)).replace('.', ','));
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = txs.map((t) => {
    const a = accById[t.account_id] || {};
    const to = accById[t.to_account_id] || {};
    return [t.date, TYPE[t.type], a.name, a.currency, num(t.type === 'expense' || t.type === 'transfer' ? -t.amount : t.amount),
      t.category, t.description, to.name, num(t.to_amount), num(t.original_amount), num(t.rate_applied), num(t.rate_bcv)];
  });
  // Punto y coma + BOM: Excel en español lo abre en columnas y con acentos correctos.
  const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const filename = `la-fructosa-${name}-${todayISO()}.csv`;
  const file = new File([csv], filename, { type: 'text/csv' });

  if (!(await saveFile(file))) return;
  toast(txs.length === 1 ? 'Se exportó 1 movimiento' : `Se exportaron ${txs.length} movimientos`);
}

// Guarda un archivo en el dispositivo. En el iPhone instalado como app, compartir es más fiable
// que descargar (desde ahí: "Guardar en Archivos"). Devuelve false si la persona canceló.
export async function saveFile(file) {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); return true; } catch (e) {
      if (e?.name === 'AbortError') return false;
      /* si compartir falla, se descarga */
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
