// Prueba del registro en PDF: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfReport } from '../js/pdf.js';

test('el PDF se arma con acentos, montos y todas las páginas', () => {
  const accounts = [{ id: 'a', name: 'Pago Móvil', currency: 'VES', kind: 'bank', balance: 1500 }, { id: 'b', name: 'Binance', currency: 'USDT', kind: 'crypto', balance: 20 }];
  const txs = Array.from({ length: 120 }, (_, i) => ({ id: String(i), type: i % 3 ? 'expense' : 'income', account_id: 'a', amount: 10 + i, value: 1, category: 'Comida', description: 'Panadería 🍞', date: '2026-10-01' }));
  const bytes = buildPdfReport({ target: 'USD', profile: { username: 'luis', region: 'VE' }, accounts, accById: { a: accounts[0], b: accounts[1] }, txs, rates: { BCV_USD: 180 }, val: 'BCV_USD', total: { total: 30 } });
  const s = Buffer.from(bytes).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF'));
  assert.match(s, /\/Count [3-9]/); // 120 movimientos ocupan varias páginas
  assert.ok(s.includes('Pago M\xf3vil') && s.includes('Panader\xeda') && !s.includes('🍞'));
  assert.ok(s.includes('USDT 20,00'));
});
