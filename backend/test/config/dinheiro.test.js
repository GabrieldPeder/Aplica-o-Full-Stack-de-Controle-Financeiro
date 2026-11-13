import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paraCentavos, deCentavos, dividirEmParcelas } from '../../src/config/dinheiro.js';

test('paraCentavos converte número e texto sem erro de ponto flutuante', () => {
  assert.equal(paraCentavos(33.34), 3334);
  assert.equal(paraCentavos('100.00'), 10000);
  assert.equal(paraCentavos(0.1 + 0.2), 30);
  assert.equal(paraCentavos(19.99), 1999);
  assert.equal(paraCentavos(0.01), 1);
});

test('deCentavos devolve número com 2 casas', () => {
  assert.equal(deCentavos(3334), 33.34);
  assert.equal(deCentavos(10000), 100);
  assert.equal(deCentavos(1), 0.01);
});

test('dividirEmParcelas: R$ 100,00 em 3x → 33,34 + 33,33 + 33,33', () => {
  assert.deepEqual(dividirEmParcelas(10000, 3), [3334, 3333, 3333]);
});

test('dividirEmParcelas: R$ 0,01 em 1x', () => {
  assert.deepEqual(dividirEmParcelas(1, 1), [1]);
});

test('dividirEmParcelas: R$ 10,00 em 48x soma exatamente 10,00', () => {
  const parcelas = dividirEmParcelas(1000, 48);
  assert.equal(parcelas.length, 48);
  assert.equal(parcelas.reduce((a, b) => a + b, 0), 1000);
  assert.ok(parcelas.every((p) => p > 0));
});

test('dividirEmParcelas: soma sempre exata', () => {
  for (const [centavos, n] of [[999, 7], [12345, 12], [100, 3], [4800, 48]]) {
    const soma = dividirEmParcelas(centavos, n).reduce((a, b) => a + b, 0);
    assert.equal(soma, centavos);
  }
});

test('dividirEmParcelas rejeita entradas inválidas', () => {
  assert.throws(() => dividirEmParcelas(10.5, 2), RangeError);
  assert.throws(() => dividirEmParcelas(1000, 0), RangeError);
  assert.throws(() => dividirEmParcelas(1000, 49), RangeError);
  assert.throws(() => dividirEmParcelas(2, 3), RangeError); // parcela de 0 centavos
});
