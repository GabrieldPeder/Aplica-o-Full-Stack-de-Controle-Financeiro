import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarConfig } from '../../src/config/env.js';

const base = { DATABASE_URL: 'postgres://a', JWT_SECRET: 's', CORS_ORIGEM: 'http://localhost:5173' };

test('aplica valores padrão', () => {
  const c = carregarConfig(base);
  assert.equal(c.porta, 3000);
  assert.equal(c.jwtExpira, '1h');
  assert.equal(c.loginMaxTentativas, 5);
  assert.equal(c.loginJanelaMin, 15);
  assert.equal(c.databaseUrl, 'postgres://a');
});

test('lista todas as variáveis obrigatórias ausentes', () => {
  assert.throws(() => carregarConfig({}), /DATABASE_URL, JWT_SECRET, CORS_ORIGEM.*\.env\.example/s);
});

test('em NODE_ENV=test usa DATABASE_URL_TESTE e a exige', () => {
  assert.equal(
    carregarConfig({ ...base, NODE_ENV: 'test', DATABASE_URL_TESTE: 'postgres://t' }).databaseUrl,
    'postgres://t',
  );
  assert.throws(() => carregarConfig({ ...base, NODE_ENV: 'test' }), /DATABASE_URL_TESTE/);
});
