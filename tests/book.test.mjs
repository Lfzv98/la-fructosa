// Pruebas del libro digital (manual.html): 30 tips en cada país y privacidad por país.
// Correr con:  node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookFor, bookText, bookRegion } from '../js/book.js';
import { TIPS, tipsFor } from '../js/tips.js';

// (La Parte I es el manual de la app tal cual: su aviso de "cédulas" es genérico y no se cuenta aquí.)
const VE_WORDS = /venezuel|bol[ií]var|\bBs\.|BCV|paralelo|brecha|Banesco|Pago M[óo]vil|condominio|utilidades|aguinaldo/i;
const noVES = (t) => assert.doesNotMatch(t, /\bVES\b/);
const EU_WORDS = /euro|\bEUR\b|€|espa[ñn]a|europ|BBVA|Bizum|Revolut|IBAN|Hacienda|IRPF|IBI\b|gestor/i;

test('hay 30 tips completos en cada país', () => {
  assert.equal(TIPS.length, 30);
  for (const c of ['VE', 'ES', 'US', 'INT']) {
    const t = tipsFor(bookRegion(c));
    assert.equal(t.length, 30, c);
    for (const x of t) for (const k of ['emoji', 'title', 'why', 'how', 'result']) assert.ok(typeof x[k] === 'string' && x[k].length > 0, `${c} ${x.title} ${k}`);
  }
});

test('España no ve nada de Venezuela en todo el libro', () => {
  const t = bookText(bookFor(bookRegion('ES')));
  assert.doesNotMatch(t, VE_WORDS);
  noVES(t);
});

test('Estados Unidos no ve nada de Venezuela ni de Europa en todo el libro', () => {
  const t = bookText(bookFor(bookRegion('US')));
  assert.doesNotMatch(t, VE_WORDS);
  noVES(t);
  assert.doesNotMatch(t, EU_WORDS);
});

test('Venezuela ve tasas y brecha; Inversiones solo con permiso', () => {
  const ve = bookText(bookFor(bookRegion('VE')));
  assert.match(ve, /brecha/i);
  assert.doesNotMatch(ve, /inversi[oó]n/i);
  assert.match(bookText(bookFor(bookRegion('VE'), { investmentsOn: true })), /Inversiones/);
});

test('el libro tiene las tres partes en orden', () => {
  const parts = bookFor(bookRegion('VE')).filter((b) => b.t === 'part').map((b) => b.n);
  assert.deepEqual(parts, ['I', 'II', 'III']);
});
