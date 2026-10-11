// Pruebas del manual y de países/bancos. Correr con:  node --test tests/*.test.mjs
// Regenerar docs/howToUseIt.md:  node tests/howToUseIt.test.mjs --write
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { CORE, MORE, FINANCE_GUIDE, BY_REGION, INSTALL_IPHONE, applies, toMarkdown } from '../js/howToUseIt.js';
import { REGIONS, regionFor, bankGroupsFor, BANK_GROUPS, BANK_PICK_TEMPLATES, ACCOUNT_TEMPLATES, CURRENCIES } from '../js/money.js';

if (process.argv.includes('--write')) {
  writeFileSync(new URL('../docs/howToUseIt.md', import.meta.url), toMarkdown());
}

test('el manual cubre las cinco funciones principales', () => {
  assert.deepEqual(CORE.map((s) => s.id), ['cuentas', 'registros', 'copiloto', 'conciliacion', 'exportar']);
  for (const s of [...CORE]) assert.ok(s.title && s.intro && s.steps.length >= 3 && s.tips.length >= 1, s.id);
  for (const m of MORE) assert.ok(m.title && m.body.length, m.title);
  assert.match(FINANCE_GUIDE.motto, /no se mide/);
  assert.equal(INSTALL_IPHONE.length, 5);
});

test('cada país tiene textos, plantillas y bancos', () => {
  for (const k of Object.keys(REGIONS)) {
    assert.ok(BY_REGION[k], `BY_REGION.${k}`);
    assert.ok(ACCOUNT_TEMPLATES[k]?.length && BANK_PICK_TEMPLATES[k]?.length && BANK_GROUPS[k]?.length, k);
    for (const c of REGIONS[k].currencies) assert.ok(CURRENCIES[c], c);
    assert.ok(REGIONS[k].currencies.includes('VES'), `${k} ofrece bolívares`);
  }
});

test('las tasas se activan fuera de Venezuela solo con cuentas en bolívares', () => {
  assert.equal(regionFor('US', []).rates, false);
  assert.equal(regionFor('US', [{ currency: 'VES' }]).rates, true);
  assert.equal(regionFor('INT', [{ currency: 'VES', archived: true }]).rates, false);
  assert.equal(regionFor('VE', []).rates, true);
  assert.equal(regionFor('XX').label, 'Venezuela');
  assert.equal(applies({ only: 'rates' }, regionFor('ES')), false);
  assert.equal(applies({ only: 'rates' }, regionFor('VE')), true);
});

test('bancos según la moneda, en cualquier país', () => {
  for (const k of Object.keys(REGIONS)) {
    const ves = bankGroupsFor(k, 'VES');
    assert.equal(ves.length, 1);
    assert.ok(ves[0].banks.includes('Banco de Venezuela (BDV)'));
    const usd = bankGroupsFor(k, 'USD').flatMap((g) => g.banks);
    assert.ok(usd.includes('Zelle') && !usd.includes('Banesco'), k);
    assert.equal(bankGroupsFor(k, 'USDT')[0].title, 'Cripto (USDT)');
  }
});
