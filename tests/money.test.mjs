// Pruebas de los cálculos de dinero. Correr con:  node --test tests/*.test.mjs
// (GitHub las corre solas en cada push: .github/workflows/pruebas.yml)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, consolidate, spreadCalc, parseAmount, vesPerUnit, addMonths, daysInMonth } from '../js/money.js';
import { buildXlsx } from '../js/xlsx.js';

const R = { BCV_USD: 200, PARALELO: 280, USDT: 275, BCV_EUR: 230 };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('convertir entre monedas con tasa BCV', () => {
  close(convert(100, 'USD', 'VES', R, 'BCV_USD'), 20000);
  close(convert(20000, 'VES', 'USD', R, 'BCV_USD'), 100);
  close(convert(50, 'USD', 'USD', R), 50);
});

test('valorar dólares a Paralelo cambia el resultado', () => {
  close(convert(28000, 'VES', 'USD', R, 'PARALELO'), 100);
  close(convert(28000, 'VES', 'USD', R, 'BCV_USD'), 140);
});

test('USDT usa su propia tasa', () => {
  close(convert(1, 'USDT', 'VES', R), 275);
  close(vesPerUnit('USDT', { BCV_USD: 200, PARALELO: 280 }), 280); // sin USDT cae al paralelo
});

test('euro se mueve con el dólar elegido', () => {
  close(convert(1, 'EUR', 'VES', R, 'BCV_USD'), 230);
  close(convert(1, 'EUR', 'VES', R, 'PARALELO'), 230 * 280 / 200);
});

test('fuera de Venezuela USD y USDT van 1:1 sin tasas', () => {
  assert.equal(convert(10, 'USDT', 'USD', {}), 10);
  assert.equal(convert(10, 'VES', 'USD', {}), null);
});

test('patrimonio consolidado suma todas las cuentas', () => {
  const r = consolidate([{ balance: 100, currency: 'USD' }, { balance: 20000, currency: 'VES' }, { balance: 10, currency: 'USDT' }], 'USD', R, 'BCV_USD');
  close(r.total, 100 + 100 + 10 * 275 / 200);
  assert.equal(r.missing, false);
  const m = consolidate([{ balance: 5, currency: 'EUR' }], 'USD', { BCV_USD: 200 }, 'BCV_USD');
  assert.equal(m.missing, true);
});

test('brecha al pagar en bolívares desde dólares', () => {
  const s = spreadCalc(2800, R, 280); // 2.800 Bs. pagados vendiendo dólares a 280
  close(s.usdAtBcv, 14);
  close(s.realCost, 10);
  close(s.diff, 4);
  close(s.gapPct, 40);
  assert.equal(spreadCalc(0, R), null);
});

test('leer montos escritos como en Venezuela o EE. UU.', () => {
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('1.234,56'), 1234.56);
  assert.equal(parseAmount('1,234.56'), 1234.56);
  assert.equal(parseAmount(' 7 '), 7);
  assert.ok(Number.isNaN(parseAmount('')));
});

test('meses y días', () => {
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(daysInMonth('2028-02'), 29);
});

test('el Excel de respaldo es un ZIP válido con sus hojas', async () => {
  const blob = buildXlsx([{ name: 'Movimientos', rows: [['Fecha', 'Monto', 'Nota'], ['2026-10-11', 12.5, 'Café & pan <rico>']] }, { name: 'Cuentas', rows: [['Nombre']] }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]); // "PK.."
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes('xl/worksheets/sheet2.xml'));
  assert.ok(text.includes('Café &amp; pan &lt;rico&gt;'));
  assert.ok(text.includes('<v>46306</v>')); // 11/10/2026 como fecha de Excel
});

test('el Excel lleva estilos: colores, formatos, filtros y columnas ocultas', async () => {
  const blob = buildXlsx([{ name: 'Movimientos', filter: true, hidden: [2], rows: [
    ['Fecha', 'Monto', 'ID'],
    { cells: ['2026-10-11', { v: 12.5, s: { color: 'B42318', fmt: 'minus' } }, 'x'], s: { fill: 'FDECEC', border: 'thin' } },
  ] }]);
  const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
  assert.ok(text.includes('<v>46306</v>'));
  assert.ok(text.includes('FFFDECEC') && text.includes('FFB42318')); // relleno rojo claro y texto rojo
  assert.ok(text.includes('formatCode="&quot;-&quot;#,##0.00"'));
  assert.ok(text.includes('<autoFilter ref="A1:C2"/>'));
  assert.ok(text.includes('hidden="1"'));
  assert.ok(text.includes('<pageMargins'));
});
