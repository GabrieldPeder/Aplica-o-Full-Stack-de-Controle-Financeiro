import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import * as categoria from '../../src/models/categoria.js';
import * as fonteDestino from '../../src/models/fonteDestino.js';
import * as lancamento from '../../src/models/lancamento.js';
import * as fatura from '../../src/models/fatura.js';
import { criarUsuario } from '../ajudantes/cenario.js';

const HOJE = '2026-11-18';
let u;
let nubank; // fecha dia 3, vence dia 10
let visa; // fecha dia 25, vence dia 5 (sem lançamentos)
let compraDiaFechamento;

let mercado;
async function comprar(descricao, valor, data, totalParcelas, cartao) {
  return lancamento.criar(u, { tipo: 'saida', descricao, valor, data, categoriaId: mercado.id, fonteDestinoId: cartao.id, totalParcelas });
}

before(async () => {
  await executarSql('database/schema.sql');
  u = await criarUsuario();
  mercado = await categoria.criar(u, { nome: 'Mercado', tipo: 'saida' });
  const estorno = await categoria.criar(u, { nome: 'Estorno', tipo: 'entrada' });
  nubank = await fonteDestino.criar(u, { nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000 });
  visa = await fonteDestino.criar(u, { nome: 'Visa', tipo: 'cartao_credito', diaFechamento: 25, diaVencimento: 5, limite: 2000 });
  await fonteDestino.criar(u, { nome: 'Conta', tipo: 'conta' });
  const criar = (dados) => lancamento.criar(u, { tipo: 'saida', categoriaId: mercado.id, fonteDestinoId: nubank.id, ...dados });

  await criar({ descricao: 'Antes do fechamento', valor: 70, data: '2026-11-02' }); // fatura 11/2026, já vencida
  [compraDiaFechamento] = await criar({ descricao: 'No dia do fechamento', valor: 100, data: '2026-11-03' }); // 12/2026
  await criar({ descricao: 'Notebook', valor: 300, data: '2026-11-15', totalParcelas: 3 }); // 12/2026, 01/2027, 02/2027
  await criar({ descricao: 'Celular', valor: 400, data: '2026-09-20', totalParcelas: 4 }); // 10/2026 … 01/2027
  await lancamento.criar(u, {
    tipo: 'entrada', descricao: 'Estorno', valor: 50, data: '2026-11-16', categoriaId: estorno.id, fonteDestinoId: nubank.id,
  });
});

after(async () => {
  await pool.end();
});

const resumo = (f) => [f.referencia, f.total, f.itens.map((i) => `${i.descricao} ${i.parcela}`)];

test('fatura atual e as próximas 3, inclusive vazias, com os itens e parcelas certos', async () => {
  const { cartoes } = await fatura.previsao(u, { meses: 3, hoje: HOJE });
  const cartao = cartoes.find((c) => c.nome === 'Nubank');
  assert.deepEqual(cartao.faturas.map(resumo), [
    ['2026-12', 300, ['Celular 3/4', 'No dia do fechamento 1/1', 'Notebook 1/3']],
    ['2027-01', 200, ['Celular 4/4', 'Notebook 2/3']],
    ['2027-02', 100, ['Notebook 3/3']],
    ['2027-03', 0, []],
  ]);
  assert.deepEqual(cartao.faturas.map((f) => f.atual), [true, false, false, false]);
  assert.deepEqual(cartao.faturas.map((f) => f.situacao), ['aberta', 'futura', 'futura', 'futura']);
  assert.deepEqual(
    { fechamento: cartao.faturas[0].fechamento, vencimento: cartao.faturas[0].vencimento },
    { fechamento: '2026-12-03', vencimento: '2026-12-10' },
  );
});

test('compra feita no dia do fechamento aparece na fatura do mês seguinte', async () => {
  const { cartoes } = await fatura.previsao(u, { meses: 3, hoje: HOJE });
  const dezembro = cartoes.find((c) => c.nome === 'Nubank').faturas[0];
  const item = dezembro.itens.find((i) => i.id === compraDiaFechamento.id);
  assert.deepEqual(item, {
    id: compraDiaFechamento.id, descricao: 'No dia do fechamento', parcela: '1/1', valor: 100, dataCompra: '2026-11-03',
  });
});

test('limite utilizado soma só parcelas ainda não vencidas; entradas no cartão não contam', async () => {
  const { cartoes } = await fatura.previsao(u, { meses: 3, hoje: HOJE });
  const cartao = cartoes.find((c) => c.nome === 'Nubank');
  assert.equal(cartao.limite, 5000);
  assert.equal(cartao.limiteUtilizado, 600);
  assert.equal(cartao.limiteDisponivel, 4400);
});

test('cartão sem lançamentos: faturas vazias e limite todo disponível', async () => {
  const { cartoes } = await fatura.previsao(u, { meses: 3, hoje: HOJE });
  const cartao = cartoes.find((c) => c.nome === 'Visa');
  assert.deepEqual(cartao.faturas.map((f) => [f.referencia, f.fechamento, f.total]), [
    ['2026-12', '2026-11-25', 0], ['2027-01', '2026-12-25', 0], ['2027-02', '2027-01-25', 0], ['2027-03', '2027-02-25', 0],
  ]);
  assert.equal(cartao.limiteUtilizado, 0);
  assert.equal(cartao.limiteDisponivel, 2000);
});

test('no dia do fechamento, a fatura atual já é a seguinte (a que fechou vira "fechada")', async () => {
  const { cartoes } = await fatura.previsao(u, { meses: 1, hoje: '2026-12-03' });
  const cartao = cartoes.find((c) => c.nome === 'Nubank');
  assert.deepEqual(cartao.faturas.map((f) => [f.referencia, f.situacao]), [
    ['2026-12', 'fechada'], ['2027-01', 'aberta'], ['2027-02', 'futura'],
  ]);
});

test('lista só cartões de crédito, em ordem de nome', async () => {
  const { cartoes } = await fatura.previsao(u, { meses: 3, hoje: HOJE });
  assert.deepEqual(cartoes.map((c) => c.nome), ['Nubank', 'Visa']);
});

test('limite estourado fica negativo', async () => {
  await comprar('Viagem', 1950, '2026-11-17', 1, visa);
  const { cartoes } = await fatura.previsao(u, { meses: 3, hoje: HOJE });
  const cartao = cartoes.find((c) => c.nome === 'Visa');
  await comprar('Hotel', 100, '2026-11-17', 1, visa);
  const depois = (await fatura.previsao(u, { meses: 3, hoje: HOJE })).cartoes.find((c) => c.nome === 'Visa');
  assert.equal(cartao.limiteDisponivel, 50);
  assert.equal(depois.limiteDisponivel, -50);
});

test('entre o fechamento e o vencimento, a fatura fechada aparece antes da atual', async () => {
  // 05/11: a fatura de 11/2026 fechou em 03/11 e vence em 10/11.
  const { cartoes } = await fatura.previsao(u, { meses: 3, hoje: '2026-11-05' });
  const cartao = cartoes.find((c) => c.nome === 'Nubank');
  assert.deepEqual(cartao.faturas.map((f) => [f.referencia, f.situacao, f.atual]), [
    ['2026-11', 'fechada', false],
    ['2026-12', 'aberta', true],
    ['2027-01', 'futura', false],
    ['2027-02', 'futura', false],
    ['2027-03', 'futura', false],
  ]);
  assert.deepEqual(cartao.faturas[0].itens.map((i) => `${i.descricao} ${i.parcela}`), ['Celular 2/4', 'Antes do fechamento 1/1']);
  // Tudo o que ocupa o limite aparece em alguma fatura.
  const somaFaturas = cartao.faturas.reduce((total, f) => total + Math.round(f.total * 100), 0) / 100;
  assert.equal(somaFaturas, cartao.limiteUtilizado);
});

test('outro usuário não vê os cartões do primeiro', async () => {
  const outro = await criarUsuario();
  assert.deepEqual(await fatura.previsao(outro, { meses: 3, hoje: HOJE }), { cartoes: [] });
});
