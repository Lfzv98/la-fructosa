// Pruebas de las preguntas frecuentes por país y permiso. Correr con:  node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAQ, faqFor, searchFaq } from '../js/faq.js';
import { regionFor } from '../js/money.js';

const text = (groups) => groups.flatMap((g) => [g.title, ...g.items.flatMap((it) => [it.q, ...it.a])]).join('\n');
const ctx = (code, extra = {}) => ({ region: regionFor(code, extra.accounts || []), investmentsOn: Boolean(extra.inv) });

test('todas las preguntas tienen pregunta y respuesta', () => {
  for (const g of FAQ) {
    assert.ok(g.id && g.title && g.items.length, g.id);
    for (const it of g.items) assert.ok(it.q && it.a.length, it.q);
  }
  for (const c of ['VE', 'ES', 'US', 'INT']) {
    for (const g of faqFor(ctx(c))) for (const it of g.items) {
      assert.equal(typeof it.q, 'string');
      for (const p of it.a) assert.ok(typeof p === 'string' && p.length > 10, `${c}: ${it.q}`);
    }
  }
});

test('España no ve nada de Venezuela', () => {
  const t = text(faqFor(ctx('ES', { accounts: [{ currency: 'VES' }] })));
  assert.doesNotMatch(t, /venezuel|bol[ií]var|\bBs\.|BCV|paralelo|brecha|Banesco|Pago M[óo]vil|c[ée]dula/i);
  assert.match(t, /euro/i);
});

test('Estados Unidos no ve nada de Venezuela ni de Europa', () => {
  const t = text(faqFor(ctx('US', { accounts: [{ currency: 'VES' }] })));
  assert.doesNotMatch(t, /venezuel|bol[ií]var|\bBs\.|BCV|paralelo|brecha|Banesco|Pago M[óo]vil|c[ée]dula/i);
  assert.doesNotMatch(t, /euro|EUR\b|espa[ñn]a|europ|BBVA|Bizum|Revolut/i);
});

test('Venezuela ve las tasas; "Otro país" solo con cuentas en bolívares', () => {
  const ids = (c) => faqFor(c).map((g) => g.id);
  assert.ok(ids(ctx('VE')).includes('tasas'));
  assert.ok(!ids(ctx('INT')).includes('tasas'));
  assert.ok(ids(ctx('INT', { accounts: [{ currency: 'VES' }] })).includes('tasas'));
  assert.ok(!ids(ctx('ES')).includes('tasas') && !ids(ctx('US')).includes('tasas'));
  // La pregunta "vivo fuera de Venezuela" es solo para "Otro país".
  const ve = faqFor(ctx('VE')).find((g) => g.id === 'tasas');
  assert.ok(!ve.items.some((it) => /fuera de Venezuela/.test(it.q)));
});

test('Inversiones solo con el permiso del perfil', () => {
  for (const c of ['VE', 'ES', 'US', 'INT']) {
    assert.ok(!faqFor(ctx(c)).some((g) => g.id === 'inversiones'), c);
    assert.doesNotMatch(text(faqFor(ctx(c))), /inversi[oó]n/i, c);
    assert.ok(faqFor(ctx(c, { inv: true })).some((g) => g.id === 'inversiones'), c);
  }
});

test('la búsqueda ignora tildes y mayúsculas', () => {
  const all = faqFor(ctx('VE'));
  const r = searchFaq(all, 'CONTRASENA olvide');
  assert.ok(r.length && r.every((g) => g.items.length));
  assert.ok(r.some((g) => g.items.some((it) => /Olvidé mi contraseña/.test(it.q))));
  assert.deepEqual(searchFaq(all, 'zzzz'), []);
  assert.equal(searchFaq(all, '  '), all);
});
