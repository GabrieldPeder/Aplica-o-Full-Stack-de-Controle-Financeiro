import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { ErroApi } from '../../src/middlewares/erros.js';
import * as categoria from '../../src/models/categoria.js';
import * as fonteDestino from '../../src/models/fonteDestino.js';
import { criarUsuario, criarLancamento } from '../ajudantes/cenario.js';

async function rejeitaApi(promessa, status, campo) {
  await assert.rejects(promessa, (erro) => {
    assert.ok(erro instanceof ErroApi, `esperava ErroApi, veio ${erro}`);
    assert.equal(erro.status, status);
    if (campo) assert.ok(erro.campos?.[campo], `esperava erro no campo ${campo}`);
    return true;
  });
}

before(async () => {
  await executarSql('database/schema.sql');
});

after(async () => {
  await pool.end();
});

test('criar devolve a categoria em camelCase', async () => {
  const u = await criarUsuario();
  const c = await categoria.criar(u, { nome: 'Mercado', tipo: 'saida' });
  assert.deepEqual(Object.keys(c).sort(), ['id', 'nome', 'quantidadeLancamentos', 'tipo']);
  assert.equal(c.quantidadeLancamentos, 0);
});

test('listar traz só as do usuário, por tipo e nome, com quantidade de lançamentos', async () => {
  const a = await criarUsuario();
  const b = await criarUsuario();
  const mercado = await categoria.criar(a, { nome: 'Mercado', tipo: 'saida' });
  await categoria.criar(a, { nome: 'Aluguel', tipo: 'saida' });
  await categoria.criar(a, { nome: 'Salário', tipo: 'entrada' });
  await categoria.criar(b, { nome: 'Da Bia', tipo: 'saida' });
  const conta = await fonteDestino.criar(a, { nome: 'Conta', tipo: 'conta' });
  await criarLancamento(a, mercado.id, conta.id);

  const lista = await categoria.listar(a);
  assert.deepEqual(lista.map((c) => `${c.tipo}:${c.nome}`), ['entrada:Salário', 'saida:Aluguel', 'saida:Mercado']);
  assert.equal(lista.find((c) => c.nome === 'Mercado').quantidadeLancamentos, 1);
});

test('mesmo nome com tipos diferentes pode; mesmo nome e tipo → 23505', async () => {
  const u = await criarUsuario();
  await categoria.criar(u, { nome: 'Outros', tipo: 'saida' });
  await categoria.criar(u, { nome: 'Outros', tipo: 'entrada' });
  await assert.rejects(categoria.criar(u, { nome: 'Outros', tipo: 'saida' }), {
    code: '23505', constraint: 'categorias_nome_unico',
  });
});

test('atualizar muda o nome', async () => {
  const u = await criarUsuario();
  const c = await categoria.criar(u, { nome: 'Mercadu', tipo: 'saida' });
  const atualizada = await categoria.atualizar(u, c.id, { nome: 'Mercado', tipo: 'saida' });
  assert.equal(atualizada.nome, 'Mercado');
});

test('mudar o tipo de categoria com lançamentos → 409 no campo tipo', async () => {
  const u = await criarUsuario();
  const c = await categoria.criar(u, { nome: 'Mercado', tipo: 'saida' });
  const conta = await fonteDestino.criar(u, { nome: 'Conta', tipo: 'conta' });
  await criarLancamento(u, c.id, conta.id);
  await rejeitaApi(categoria.atualizar(u, c.id, { nome: 'Mercado', tipo: 'entrada' }), 409, 'tipo');
  assert.equal((await categoria.atualizar(u, c.id, { nome: 'Supermercado', tipo: 'saida' })).nome, 'Supermercado');
});

test('categoria de outro usuário → 404 ao atualizar e excluir', async () => {
  const a = await criarUsuario();
  const b = await criarUsuario();
  const c = await categoria.criar(a, { nome: 'Mercado', tipo: 'saida' });
  await rejeitaApi(categoria.atualizar(b, c.id, { nome: 'Invasão', tipo: 'saida' }), 404);
  await rejeitaApi(categoria.excluir(b, c.id), 404);
  assert.equal((await categoria.listar(a)).length, 1);
});

test('excluir apaga; com lançamento o banco barra (23503)', async () => {
  const u = await criarUsuario();
  const livre = await categoria.criar(u, { nome: 'Livre', tipo: 'saida' });
  await categoria.excluir(u, livre.id);
  assert.equal((await categoria.listar(u)).length, 0);

  const usada = await categoria.criar(u, { nome: 'Usada', tipo: 'saida' });
  const conta = await fonteDestino.criar(u, { nome: 'Conta', tipo: 'conta' });
  await criarLancamento(u, usada.id, conta.id);
  await assert.rejects(categoria.excluir(u, usada.id), { code: '23503' });
});

test('nome repetido ignora maiúsculas/minúsculas → 23505', async () => {
  const u = await criarUsuario();
  await categoria.criar(u, { nome: 'Lazer', tipo: 'saida' });
  await assert.rejects(categoria.criar(u, { nome: 'LAZER', tipo: 'saida' }), {
    code: '23505', constraint: 'categorias_nome_unico',
  });
});

test('mudar o tipo espera um lançamento em andamento e então recusa (sem corrida)', async () => {
  const u = await criarUsuario();
  const c = await categoria.criar(u, { nome: 'Mercado', tipo: 'saida' });
  const conta = await fonteDestino.criar(u, { nome: 'Conta', tipo: 'conta' });
  // Outra conexão insere um lançamento e ainda não confirmou.
  const outra = await pool.connect();
  await outra.query('BEGIN');
  await outra.query(
    `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, 'saida', 'Em andamento', 10, '2026-11-03', $2, $3)`,
    [u, c.id, conta.id],
  );
  const mudanca = categoria.atualizar(u, c.id, { nome: 'Mercado', tipo: 'entrada' });
  mudanca.catch(() => {}); // a rejeição é conferida abaixo
  await new Promise((r) => setTimeout(r, 300));
  await outra.query('COMMIT');
  outra.release();
  await rejeitaApi(mudanca, 409, 'tipo');
});
