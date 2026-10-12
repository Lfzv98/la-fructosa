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

test('cada país tiene su experiencia propia (v27)', async () => {
  const { categoriesFor, categoryMeta, setTimeZoneFor, REGIONS: R } = await import('../js/money.js');
  // España: euros, bancos españoles y Bizum; sin tasas.
  assert.equal(R.ES.base, 'EUR');
  assert.equal(regionFor('ES', []).rates, false);
  assert.ok(BANK_GROUPS.ES[0].banks.includes('CaixaBank'));
  assert.ok(bankGroupsFor('ES', 'EUR').flatMap((g) => g.banks).includes('Bizum'));
  assert.ok(ACCOUNT_TEMPLATES.ES.some((t) => t.name === 'Bizum' && t.currency === 'EUR'));
  // Estados Unidos: dólares, Chase/BofA y apps locales; sin tasas.
  assert.equal(R.US.base, 'USD');
  const us = bankGroupsFor('US', 'USD').flatMap((g) => g.banks);
  for (const b of ['Chase', 'Bank of America (BOFA)', 'Wells Fargo', 'Venmo', 'Cash App', 'Apple Pay', 'PayPal']) assert.ok(us.includes(b), b);
  // Categorías por país: comunes + propias, "Otros" al final.
  const es = categoriesFor('ES', 'expense').map((c) => c.name);
  assert.ok(es.includes('Comunidad') && es.includes('Impuestos') && es.at(-1) === 'Otros');
  assert.ok(!categoriesFor('VE', 'expense').some((c) => c.name === 'Comunidad'));
  assert.ok(categoriesFor(regionFor('US'), 'income').some((c) => c.name === 'Reembolso de impuestos'));
  assert.equal(categoryMeta('Devolución de Hacienda', 'income').emoji, '🧾');
  // Consejos de impuestos solo en su país.
  const tipES = FINANCE_GUIDE.tips.find((t) => t.only?.[0] === 'ES');
  assert.ok(applies(tipES, regionFor('ES')) && !applies(tipES, regionFor('VE')) && !applies(tipES, regionFor('US')));
  // Zona horaria: Venezuela siempre Caracas.
  assert.equal(setTimeZoneFor('VE'), 'America/Caracas');
  assert.ok(setTimeZoneFor('ES'));
  setTimeZoneFor('VE');
});
