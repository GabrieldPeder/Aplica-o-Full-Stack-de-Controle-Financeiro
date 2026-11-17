import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpfValido, somenteDigitos } from '../../src/config/cpf.js';

test('somenteDigitos remove pontos, traço e espaços', () => {
  assert.equal(somenteDigitos(' 529.982.247-25 '), '52998224725');
});

test('CPF válido com e sem máscara', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('52998224725'), true);
});

test('CPF com dígito verificador errado', () => {
  assert.equal(cpfValido('529.982.247-24'), false);
});

test('CPF com todos os dígitos iguais', () => {
  assert.equal(cpfValido('111.111.111-11'), false);
});

test('CPF com tamanho errado ou vazio', () => {
  assert.equal(cpfValido('5299822472'), false);
  assert.equal(cpfValido(''), false);
  assert.equal(cpfValido(undefined), false);
});
