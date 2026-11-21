import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import * as categoria from '../../src/models/categoria.js';
import * as fonteDestino from '../../src/models/fonteDestino.js';
import * as lancamento from '../../src/models/lancamento.js';
import * as relatorio from '../../src/models/relatorio.js';
import { criarUsuario } from '../ajudantes/cenario.js';

const NOVEMBRO = { inicio: '2026-11-01', fim: '2026-11-30' };
let a;
let ids;

const lancar = (tipo, categoriaId, valor, data, extra = {}) => lancamento.criar(a, {
  tipo, descricao: 'Teste', valor, data, categoriaId, fonteDestinoId: extra.fonte ?? ids.conta, totalParcelas: extra.parcelas,
});

before(async () => {
  await executarSql('database/schema.sql');
  a = await criarUsuario();
  ids = {
    mercado: (await categoria.criar(a, { nome: 'Mercado', tipo: 'saida' })).id,
    lazer: (await categoria.criar(a, { nome: 'Lazer', tipo: 'saida' })).id,
    saude: (await categoria.criar(a, { nome: 'Saúde', tipo: 'saida' })).id,
    salario: (await categoria.criar(a, { nome: 'Salário', tipo: 'entrada' })).id,
    conta: (await fonteDestino.criar(a, { nome: 'Conta', tipo: 'conta' })).id,
    cartao: (await fonteDestino.criar(a, {
      nome: 'Cartão', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000,
    })).id,
  };
  // novembro
  await lancar('saida', ids.mercado, 600, '2026-11-04');
  await lancar('saida', ids.mercado, 0.1, '2026-11-05');
  await lancar('saida', ids.lazer, 300, '2026-11-20', { fonte: ids.cartao, parcelas: 3 }); // conta inteira no mês da compra
  await lancar('entrada', ids.salario, 5000, '2026-11-05');
  // outubro (período anterior)
  await lancar('saida', ids.mercado, 500, '2026-10-10');
  await lancar('saida', ids.saude, 200, '2026-10-15'); // só no período anterior
  // fora dos dois períodos
  await lancar('saida', ids.lazer, 999, '2026-09-30');
});

after(async () => {
  await pool.end();
});

test('saídas por categoria: total, percentual, anterior e variação; maior total primeiro', async () => {
  const r = await relatorio.porCategoria(a, NOVEMBRO);
  assert.deepEqual(r.periodo, NOVEMBRO);
  assert.deepEqual(r.periodoAnterior, { inicio: '2026-10-01', fim: '2026-10-31' });
  assert.equal(r.totalSaidas, 900.1);
  assert.deepEqual(
    r.saidas.map(({ nome, total, percentual, totalAnterior, variacao }) => [nome, total, percentual, totalAnterior, variacao]),
    [
      ['Mercado', 600.1, 66.67, 500, 100.1],
      ['Lazer', 300, 33.33, 0, 300],
      ['Saúde', 0, 0, 200, -200], // aparece mesmo só tendo valor no período anterior
    ],
  );
});

test('entradas por categoria só do período', async () => {
  const r = await relatorio.porCategoria(a, NOVEMBRO);
  assert.equal(r.totalEntradas, 5000);
  assert.deepEqual(r.entradas.map(({ nome, total }) => [nome, total]), [['Salário', 5000]]);
});

test('período sem lançamentos → listas vazias e percentuais sem divisão por zero', async () => {
  const r = await relatorio.porCategoria(a, { inicio: '2027-05-01', fim: '2027-05-31' });
  assert.equal(r.totalSaidas, 0);
  assert.deepEqual(r.saidas, []);
});

test('outro usuário não vê nada', async () => {
  const b = await criarUsuario();
  const r = await relatorio.porCategoria(b, NOVEMBRO);
  assert.deepEqual([r.saidas, r.entradas], [[], []]);
});
