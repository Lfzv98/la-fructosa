// Pruebas de los logos: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { accountLogo, brandId } from '../js/brands.js';
import { BRANDS, ART_IDS } from '../js/brands.data.js';

test('cada logo del catálogo tiene su archivo', () => {
  for (const id of [...BRANDS.map((b) => b[0]), ...ART_IDS]) {
    assert.ok(fs.existsSync(new URL(`../icons/brands/${id}.svg`, import.meta.url)), id);
  }
});

test('cuentas de la captura', () => {
  const acc = (name, currency, kind = 'bank', icon = '🏦') => accountLogo({ name, currency, kind, icon });
  assert.equal(acc('Pago Móvil', 'VES'), 'pagomovil');
  assert.equal(acc('Efectivo USD', 'USD'), 'cash-usd');
  assert.equal(acc('Efectivo VES', 'VES'), 'cash-ves');
  assert.equal(acc('Zelle', 'USD'), 'zelle');
  assert.equal(acc('Binance (USDT)', 'USDT'), 'binance');
  assert.equal(acc('Banco Nacional de Crédito (BNC)', 'VES'), 'bnc');
  assert.equal(acc('Bank of America (BOFA)', 'USD'), 'bankofamerica');
});

test('lo que no es entidad usa un dibujo; lo desconocido, su emoji', () => {
  assert.equal(accountLogo({ name: 'Tarjeta de Crédito', currency: 'USD', kind: 'bank', icon: '💳' }), 'card');
  assert.equal(accountLogo({ name: 'Cuenta de Ahorros (Savings)', currency: 'USD', kind: 'bank', icon: '🐷' }), 'savings');
  assert.equal(accountLogo({ name: 'Efectivo EUR', currency: 'EUR', kind: 'cash', icon: '💶' }), 'cash-eur');
  assert.equal(accountLogo({ name: 'Mi banquito', currency: 'USD', kind: 'bank', icon: '🏦' }), 'bank');
  assert.equal(accountLogo({ name: 'Viaje', currency: 'USD', kind: 'bank', icon: '✈️' }), null);
  assert.equal(accountLogo({ name: 'Cash App', currency: 'USD', kind: 'digital', icon: '📱' }), 'cashapp');
});

test('bancos de toda la lista', () => {
  for (const [n, id] of [['Banco de Venezuela (BDV)', 'bdv'], ['Banco Venezolano de Crédito', 'bvc'], ['BBVA Provincial', 'bbva'],
    ['Banco Digital de los Trabajadores (Bicentenario)', 'bicentenario'], ['R4 Banco Microfinanciero (Mi Banco)', 'r4'],
    ['100% Banco', '100banco'], ['Banco Exterior', 'exterior'], ['Bancoex', 'bancoex'], ['Banesco USA', 'banesco'], ['Folionet', 'folionet']]) {
    assert.equal(brandId(n), id, n);
  }
});

test('en movimientos no se confunden lugares con bancos', () => {
  assert.equal(brandId('Hotel del Sur', { banks: false }), null);
  assert.equal(brandId('Netflix', { banks: false }), 'netflix');
  assert.equal(brandId('Zelle a mamá', { banks: false }), 'zelle');
});
