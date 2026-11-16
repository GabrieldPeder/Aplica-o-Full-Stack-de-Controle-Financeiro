import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { ErroApi } from '../../src/middlewares/erros.js';
import * as categoria from '../../src/models/categoria.js';
import * as fonteDestino from '../../src/models/fonteDestino.js';
import { criarUsuario, criarLancamento } from '../ajudantes/cenario.js';

const cartao = (extra = {}) => ({
  nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000, ...extra,
});

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

test('criar conta: campos de cartão ficam null e reserva é respeitada', async () => {
  const u = await criarUsuario();
  const f = await fonteDestino.criar(u, {
    nome: 'Poupança', tipo: 'conta', diaFechamento: 5, diaVencimento: 9, limite: 100, reserva: true,
  });
  assert.deepEqual(
    { ...f, id: undefined },
    {
      id: undefined, nome: 'Poupança', tipo: 'conta', diaFechamento: null, diaVencimento: null,
      limite: null, reserva: true, quantidadeLancamentos: 0,
    },
  );
});

test('criar cartão: dias e limite numérico; reserva sempre false', async () => {
  const u = await criarUsuario();
  const f = await fonteDestino.criar(u, cartao({ reserva: true }));
  assert.equal(f.diaFechamento, 3);
  assert.equal(f.diaVencimento, 10);
  assert.equal(f.limite, 5000);
  assert.equal(f.reserva, false);
});

test('renda nunca é reserva', async () => {
  const u = await criarUsuario();
  const f = await fonteDestino.criar(u, { nome: 'Salário', tipo: 'renda', reserva: true });
  assert.equal(f.reserva, false);
});

test('nome repetido → 23505', async () => {
  const u = await criarUsuario();
  await fonteDestino.criar(u, cartao());
  await assert.rejects(fonteDestino.criar(u, { nome: 'Nubank', tipo: 'conta' }), {
    code: '23505', constraint: 'fontes_destinos_nome_unico',
  });
});

test('listar traz só as do usuário, ordenadas por nome', async () => {
  const a = await criarUsuario();
  const b = await criarUsuario();
  await fonteDestino.criar(a, cartao());
  await fonteDestino.criar(a, { nome: 'Conta corrente', tipo: 'conta' });
  await fonteDestino.criar(b, { nome: 'Da Bia', tipo: 'conta' });
  assert.deepEqual((await fonteDestino.listar(a)).map((f) => f.nome), ['Conta corrente', 'Nubank']);
});

test('cartão sem lançamentos virando conta zera os campos de cartão', async () => {
  const u = await criarUsuario();
  const f = await fonteDestino.criar(u, cartao());
  const atualizada = await fonteDestino.atualizar(u, f.id, { nome: 'Nubank conta', tipo: 'conta', reserva: false });
  assert.equal(atualizada.tipo, 'conta');
  assert.equal(atualizada.limite, null);
  assert.equal(atualizada.diaFechamento, null);
});

test('mudar o tipo com lançamentos → 409 no campo tipo; mudar dados do cartão pode', async () => {
  const u = await criarUsuario();
  const f = await fonteDestino.criar(u, cartao());
  const c = await categoria.criar(u, { nome: 'Mercado', tipo: 'saida' });
  await criarLancamento(u, c.id, f.id);
  await rejeitaApi(fonteDestino.atualizar(u, f.id, { nome: 'Nubank', tipo: 'conta' }), 409, 'tipo');
  const ajustado = await fonteDestino.atualizar(u, f.id, cartao({ diaFechamento: 28, limite: 7000.5 }));
  assert.equal(ajustado.diaFechamento, 28);
  assert.equal(ajustado.limite, 7000.5);
  assert.equal(ajustado.quantidadeLancamentos, 1);
});

test('fonte de outro usuário → 404 ao atualizar e excluir', async () => {
  const a = await criarUsuario();
  const b = await criarUsuario();
  const f = await fonteDestino.criar(a, cartao());
  await rejeitaApi(fonteDestino.atualizar(b, f.id, cartao({ nome: 'Invasão' })), 404);
  await rejeitaApi(fonteDestino.excluir(b, f.id), 404);
});

test('excluir apaga; com lançamento o banco barra (23503)', async () => {
  const u = await criarUsuario();
  const livre = await fonteDestino.criar(u, { nome: 'Livre', tipo: 'conta' });
  await fonteDestino.excluir(u, livre.id);
  assert.equal((await fonteDestino.listar(u)).length, 0);

  const usada = await fonteDestino.criar(u, cartao());
  const c = await categoria.criar(u, { nome: 'Mercado', tipo: 'saida' });
  await criarLancamento(u, c.id, usada.id);
  await assert.rejects(fonteDestino.excluir(u, usada.id), { code: '23503' });
});
