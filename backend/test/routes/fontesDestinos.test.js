import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { subirServidor, chamar, criarSessao } from '../ajudantes/api.js';

let api;
let tokenA;
let tokenB;

const cartao = (extra = {}) => ({
  nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000, ...extra,
});

before(async () => {
  await executarSql('database/schema.sql');
  api = subirServidor();
  tokenA = await criarSessao(api.base);
  tokenB = await criarSessao(api.base);
});

after(async () => {
  api.fechar();
  await pool.end();
});

test('sem token → 401', async () => {
  assert.equal((await chamar(api.base, 'GET', '/fontes-destinos')).status, 401);
});

test('lista as fontes padrão do cadastro', async () => {
  const r = await chamar(api.base, 'GET', '/fontes-destinos', { token: tokenA });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.map((f) => f.nome), ['Conta corrente', 'Salário']);
});

test('cartão sem dias e limite → 400 apontando os três campos', async () => {
  const r = await chamar(api.base, 'POST', '/fontes-destinos', {
    token: tokenA, corpo: { nome: 'Inter', tipo: 'cartao_credito' },
  });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.corpo.campos).sort(), ['diaFechamento', 'diaVencimento', 'limite']);
});

test('dia 32 e limite com 3 casas → 400', async () => {
  const r = await chamar(api.base, 'POST', '/fontes-destinos', {
    token: tokenA, corpo: cartao({ diaFechamento: 32, limite: 10.555 }),
  });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.corpo.campos).sort(), ['diaFechamento', 'limite']);
});

test('conta ignora campos de cartão enviados', async () => {
  const r = await chamar(api.base, 'POST', '/fontes-destinos', {
    token: tokenA, corpo: { nome: 'Poupança', tipo: 'conta', limite: 'qualquer', reserva: true },
  });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.limite, null);
  assert.equal(r.corpo.reserva, true);
});

test('criar cartão → editar → excluir', async () => {
  const criado = await chamar(api.base, 'POST', '/fontes-destinos', { token: tokenA, corpo: cartao() });
  assert.equal(criado.status, 201);
  assert.equal(criado.corpo.limite, 5000);

  const editado = await chamar(api.base, 'PUT', `/fontes-destinos/${criado.corpo.id}`, {
    token: tokenA, corpo: cartao({ limite: '6500.50' }),
  });
  assert.equal(editado.status, 200);
  assert.equal(editado.corpo.limite, 6500.5);

  assert.equal((await chamar(api.base, 'DELETE', `/fontes-destinos/${criado.corpo.id}`, { token: tokenA })).status, 204);
});

test('nome repetido → 409 no campo nome', async () => {
  const r = await chamar(api.base, 'POST', '/fontes-destinos', {
    token: tokenA, corpo: { nome: 'Conta corrente', tipo: 'conta' },
  });
  assert.equal(r.status, 409);
  assert.ok(r.corpo.campos.nome);
});

test('usuário B não vê, edita nem exclui fonte de A', async () => {
  const deA = await chamar(api.base, 'POST', '/fontes-destinos', { token: tokenA, corpo: cartao({ nome: 'Da A' }) });
  const listaB = await chamar(api.base, 'GET', '/fontes-destinos', { token: tokenB });
  assert.equal(listaB.corpo.some((f) => f.id === deA.corpo.id), false);
  const editar = await chamar(api.base, 'PUT', `/fontes-destinos/${deA.corpo.id}`, {
    token: tokenB, corpo: cartao({ nome: 'Invasão' }),
  });
  assert.equal(editar.status, 404);
  assert.equal((await chamar(api.base, 'DELETE', `/fontes-destinos/${deA.corpo.id}`, { token: tokenB })).status, 404);
});
