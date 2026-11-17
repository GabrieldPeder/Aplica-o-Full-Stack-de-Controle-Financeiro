import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, consultar } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { subirServidor, chamar, criarSessao } from '../ajudantes/api.js';

let api;
let tokenA;
let tokenB;

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
  assert.equal((await chamar(api.base, 'GET', '/categorias')).status, 401);
});

test('lista as 9 categorias padrão do cadastro', async () => {
  const r = await chamar(api.base, 'GET', '/categorias', { token: tokenA });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.length, 9);
});

test('corpo inválido → 400 com os campos', async () => {
  const r = await chamar(api.base, 'POST', '/categorias', { token: tokenA, corpo: { nome: ' ', tipo: 'gasto' } });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.corpo.campos).sort(), ['nome', 'tipo']);
});

test('id inválido na URL → 400', async () => {
  const r = await chamar(api.base, 'DELETE', '/categorias/abc', { token: tokenA });
  assert.equal(r.status, 400);
});

test('criar → editar → excluir', async () => {
  const criada = await chamar(api.base, 'POST', '/categorias', { token: tokenA, corpo: { nome: ' Pets ', tipo: 'saida' } });
  assert.equal(criada.status, 201);
  assert.equal(criada.corpo.nome, 'Pets');

  const editada = await chamar(api.base, 'PUT', `/categorias/${criada.corpo.id}`, {
    token: tokenA, corpo: { nome: 'Animais', tipo: 'saida' },
  });
  assert.equal(editada.status, 200);
  assert.equal(editada.corpo.nome, 'Animais');

  const excluida = await chamar(api.base, 'DELETE', `/categorias/${criada.corpo.id}`, { token: tokenA });
  assert.equal(excluida.status, 204);
});

test('nome e tipo repetidos → 409 no campo nome', async () => {
  const r = await chamar(api.base, 'POST', '/categorias', { token: tokenA, corpo: { nome: 'Lazer', tipo: 'saida' } });
  assert.equal(r.status, 409);
  assert.ok(r.corpo.campos.nome);
});

test('usuário B não vê, edita nem exclui categoria de A', async () => {
  const deA = await chamar(api.base, 'POST', '/categorias', { token: tokenA, corpo: { nome: 'Só da A', tipo: 'saida' } });
  const listaB = await chamar(api.base, 'GET', '/categorias', { token: tokenB });
  assert.equal(listaB.corpo.some((c) => c.id === deA.corpo.id), false);
  const editar = await chamar(api.base, 'PUT', `/categorias/${deA.corpo.id}`, {
    token: tokenB, corpo: { nome: 'Invasão', tipo: 'saida' },
  });
  assert.equal(editar.status, 404);
  assert.equal((await chamar(api.base, 'DELETE', `/categorias/${deA.corpo.id}`, { token: tokenB })).status, 404);
});

test('excluir categoria com lançamento → 409', async () => {
  const cats = (await chamar(api.base, 'GET', '/categorias', { token: tokenA })).corpo;
  const fontes = (await chamar(api.base, 'GET', '/fontes-destinos', { token: tokenA })).corpo;
  const lazer = cats.find((c) => c.nome === 'Lazer');
  const conta = fontes.find((f) => f.tipo === 'conta');
  const { rows: [{ usuario_id: usuarioId }] } = await consultar('SELECT usuario_id FROM categorias WHERE id = $1', [lazer.id]);
  await consultar(
    `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, 'saida', 'Cinema', 30, '2026-11-03', $2, $3)`,
    [usuarioId, lazer.id, conta.id],
  );
  const r = await chamar(api.base, 'DELETE', `/categorias/${lazer.id}`, { token: tokenA });
  assert.equal(r.status, 409);
  assert.equal(r.corpo.erro, 'Não é possível excluir: existem lançamentos vinculados.');
});

test('renomear para um nome já existente (outra caixa) → 409 no campo nome', async () => {
  const nova = await chamar(api.base, 'POST', '/categorias', { token: tokenA, corpo: { nome: 'Viagens', tipo: 'saida' } });
  const r = await chamar(api.base, 'PUT', `/categorias/${nova.corpo.id}`, {
    token: tokenA, corpo: { nome: 'educação', tipo: 'saida' },
  });
  assert.equal(r.status, 409);
  assert.ok(r.corpo.campos.nome);
});
