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
let a; // usuário principal
let ids; // categorias e fontes do usuário a

async function lancar(usuarioId, tipo, valor, data, fonteDestinoId, extra = {}) {
  const categoriaId = tipo === 'entrada' ? ids.salario : ids.mercado;
  await lancamento.criar(usuarioId, { tipo, descricao: 'Teste', valor, data, categoriaId, fonteDestinoId, ...extra });
}

before(async () => {
  await executarSql('database/schema.sql');
  a = await criarUsuario();
  ids = {
    salario: (await categoria.criar(a, { nome: 'Salário', tipo: 'entrada' })).id,
    mercado: (await categoria.criar(a, { nome: 'Mercado', tipo: 'saida' })).id,
    empresa: (await fonteDestino.criar(a, { nome: 'Empresa', tipo: 'renda' })).id,
    freela: (await fonteDestino.criar(a, { nome: 'Freela', tipo: 'renda' })).id,
    corrente: (await fonteDestino.criar(a, { nome: 'Conta corrente', tipo: 'conta' })).id,
    poupanca: (await fonteDestino.criar(a, { nome: 'Poupança', tipo: 'conta' })).id,
    nubank: (await fonteDestino.criar(a, {
      nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000,
    })).id,
  };
  await lancar(a, 'entrada', 5000, '2026-11-05', ids.empresa);
  await lancar(a, 'entrada', 800, '2026-11-20', ids.freela);
  await lancar(a, 'entrada', 1000, '2026-11-06', ids.corrente); // entrada direto na conta
  await lancar(a, 'saida', 300, '2026-11-10', ids.corrente);
  await lancar(a, 'saida', 0.1, '2026-11-11', ids.nubank);
  await lancar(a, 'saida', 0.2, '2026-11-12', ids.nubank);
  await lancar(a, 'saida', 900, '2026-11-15', ids.nubank, { totalParcelas: 3 }); // compra parcelada
  await lancar(a, 'saida', 999, '2026-10-31', ids.corrente); // fora do período
  await lancar(a, 'entrada', 999, '2026-12-01', ids.empresa); // fora do período
});

after(async () => {
  await pool.end();
});

test('entradas por fonte, no período, maior total primeiro', async () => {
  const r = await relatorio.porFonteDestino(a, NOVEMBRO);
  assert.deepEqual(r.periodo, NOVEMBRO);
  assert.deepEqual(
    r.entradasPorFonte.map(({ nome, tipo, total }) => [nome, tipo, total]),
    [['Empresa', 'renda', 5000], ['Conta corrente', 'conta', 1000], ['Freela', 'renda', 800]],
  );
  assert.equal(r.totalEntradas, 6800);
});

test('saídas por destino somam centavos exatos e contam a compra parcelada inteira', async () => {
  const r = await relatorio.porFonteDestino(a, NOVEMBRO);
  assert.deepEqual(
    r.saidasPorDestino.map(({ nome, total }) => [nome, total]),
    [['Nubank', 900.3], ['Conta corrente', 300]],
  );
  assert.equal(r.totalSaidas, 1200.3);
});

test('saldo de cada conta no período, inclusive conta sem movimento', async () => {
  const r = await relatorio.porFonteDestino(a, NOVEMBRO);
  assert.deepEqual(
    r.saldoContas.map(({ nome, entradas, saidas, saldo }) => [nome, entradas, saidas, saldo]),
    [['Conta corrente', 1000, 300, 700], ['Poupança', 0, 0, 0]],
  );
});

test('outro usuário não vê nada do primeiro', async () => {
  const b = await criarUsuario();
  const r = await relatorio.porFonteDestino(b, NOVEMBRO);
  assert.deepEqual(r.entradasPorFonte, []);
  assert.deepEqual(r.saidasPorDestino, []);
  assert.deepEqual(r.saldoContas, []);
  assert.equal(r.totalEntradas, 0);
});
