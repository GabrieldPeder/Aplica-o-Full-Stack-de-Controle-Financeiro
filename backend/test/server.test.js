import './ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp } from '../src/server.js';

let servidor;
let base;

before(() => {
  servidor = criarApp().listen(0);
  base = `http://localhost:${servidor.address().port}`;
});

after(() => {
  servidor.close();
});

test('GET /api/status responde 200', async () => {
  const resposta = await fetch(`${base}/api/status`);
  assert.equal(resposta.status, 200);
  assert.deepEqual(await resposta.json(), { status: 'ok' });
});

test('rota inexistente responde 404 padrão', async () => {
  const resposta = await fetch(`${base}/api/nao-existe`);
  assert.equal(resposta.status, 404);
  assert.deepEqual(await resposta.json(), { erro: 'Rota não encontrada.' });
});

test('JSON malformado responde 400', async () => {
  const resposta = await fetch(`${base}/api/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(resposta.status, 400);
  assert.deepEqual(await resposta.json(), { erro: 'JSON inválido no corpo da requisição.' });
});

test('CORS libera só a origem configurada', async () => {
  const permitida = await fetch(`${base}/api/status`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(permitida.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const bloqueada = await fetch(`${base}/api/status`, { headers: { Origin: 'http://malicioso.com' } });
  assert.equal(bloqueada.headers.get('access-control-allow-origin'), null);
});

test('corpo acima de 100 kB responde 413', async () => {
  const resposta = await fetch(`${base}/api/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto: 'x'.repeat(200 * 1024) }),
  });
  assert.equal(resposta.status, 413);
  assert.deepEqual(await resposta.json(), { erro: 'Corpo da requisição muito grande.' });
});
