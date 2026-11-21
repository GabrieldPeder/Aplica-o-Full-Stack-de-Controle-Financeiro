import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import * as categoria from '../../src/models/categoria.js';
import * as fonteDestino from '../../src/models/fonteDestino.js';
import * as lancamento from '../../src/models/lancamento.js';
import * as saude from '../../src/models/saude.js';
import { criarUsuario } from '../ajudantes/cenario.js';

const HOJE = '2026-11-21'; // meses analisados: ago, set, out/2026
let a;
let ids;

const lancar = (usuarioId, tipo, categoriaId, fonteDestinoId, valor, data, totalParcelas) =>
  lancamento.criar(usuarioId, { tipo, descricao: 'Teste', valor, data, categoriaId, fonteDestinoId, totalParcelas });

async function criarBase(usuarioId, { reserva = true } = {}) {
  const base = {
    salario: (await categoria.criar(usuarioId, { nome: 'Salário', tipo: 'entrada' })).id,
    mercado: (await categoria.criar(usuarioId, { nome: 'Mercado', tipo: 'saida' })).id,
    lazer: (await categoria.criar(usuarioId, { nome: 'Lazer', tipo: 'saida' })).id,
    conta: (await fonteDestino.criar(usuarioId, { nome: 'Conta', tipo: 'conta' })).id,
    cartao: (await fonteDestino.criar(usuarioId, {
      nome: 'Cartão', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000,
    })).id,
  };
  if (reserva) base.poupanca = (await fonteDestino.criar(usuarioId, { nome: 'Poupança', tipo: 'conta', reserva: true })).id;
  return base;
}

before(async () => {
  await executarSql('database/schema.sql');
  a = await criarUsuario();
  ids = await criarBase(a);
  for (const mes of ['08', '09', '10']) {
    await lancar(a, 'entrada', ids.salario, ids.conta, 5000, `2026-${mes}-05`);
    await lancar(a, 'saida', ids.mercado, ids.conta, 3000, `2026-${mes}-10`);
    await lancar(a, 'saida', ids.lazer, ids.conta, 200, `2026-${mes}-15`);
  }
  // mês atual: lazer bem acima da média (200)
  await lancar(a, 'saida', ids.lazer, ids.conta, 500, '2026-11-02');
  // compra parcelada em outubro: 1200 em 6x no cartão (fecha 3, vence 10)
  // compra em 20/10 → 1ª parcela na fatura que fecha 03/11 e vence 10/11 (já vencida em 21/11)
  await lancar(a, 'saida', ids.mercado, ids.cartao, 1200, '2026-10-20', 6);
  // reserva: 11.000 guardados
  await lancar(a, 'entrada', ids.salario, ids.poupanca, 11000, '2026-07-01');
});

after(async () => {
  await pool.end();
});

test('mesRelativo atravessa o ano', () => {
  assert.deepEqual(saude.mesRelativo('2026-01-15', -1), { referencia: '2025-12', inicio: '2025-12-01', fim: '2025-12-31' });
  assert.deepEqual(saude.mesRelativo('2026-11-21', 3), { referencia: '2027-02', inicio: '2027-02-01', fim: '2027-02-28' });
});

test('taxa de poupança por mês e média dos 3 meses completos', async () => {
  const r = await saude.calcular(a, { hoje: HOJE });
  assert.deepEqual(r.referencia.meses, ['2026-08', '2026-09', '2026-10']);
  // ago/set: (5000 − 3200) / 5000 = 36%; out: (5000 − 3200 − 1200) / 5000 = 12%
  assert.deepEqual(r.poupanca.porMes.map((m) => m.taxa), [36, 36, 12]);
  assert.equal(r.poupanca.media, 28);
  assert.ok(r.dicas.some((d) => d.indicador === 'poupanca' && d.tipo === 'elogio'));
});

test('parcelas futuras por mês (só as que vencem depois de hoje)', async () => {
  const r = await saude.calcular(a, { hoje: HOJE });
  assert.deepEqual(r.parcelasFuturas, [
    { referencia: '2026-12', total: 200 },
    { referencia: '2027-01', total: 200 },
    { referencia: '2027-02', total: 200 },
    { referencia: '2027-03', total: 200 },
    { referencia: '2027-04', total: 200 },
  ]);
  assert.ok(r.dicas.some((d) => d.indicador === 'parcelas' && d.texto.includes('04/2027')));
});

test('comprometimento: próximas 3 faturas ÷ renda de 3 meses', async () => {
  const r = await saude.calcular(a, { hoje: HOJE });
  // faturas nov (já vencida → 0), dez (200), jan (200) = 400 de 15.000
  assert.equal(r.comprometimento.proximasFaturas, 400);
  assert.equal(r.comprometimento.rendaTresMeses, 15000);
  assert.equal(r.comprometimento.percentual, 2.67);
  assert.ok(!r.dicas.some((d) => d.indicador === 'comprometimento'));
});

test('categoria fora da curva no mês atual', async () => {
  const r = await saude.calcular(a, { hoje: HOJE });
  assert.deepEqual(r.categoriasForaDaCurva.map((c) => [c.nome, c.atual, c.media, c.acima]), [['Lazer', 500, 200, 150]]);
  assert.ok(r.dicas.some((d) => d.indicador === 'categoria' && d.texto.includes('Lazer')));
});

test('reserva em meses de gastos', async () => {
  const r = await saude.calcular(a, { hoje: HOJE });
  // média de saídas: (3200 + 3200 + 4400) / 3 = 3600 → 11000 / 3600 ≈ 3,1 meses
  assert.equal(r.reserva.saldo, 11000);
  assert.equal(r.reserva.mediaSaidasMensal, 3600);
  assert.equal(r.reserva.meses, 3.1);
  assert.ok(!r.dicas.some((d) => d.indicador === 'reserva'));
});

test('projeção de 6 meses usa média à vista + parcelas conhecidas', async () => {
  const r = await saude.calcular(a, { hoje: HOJE });
  assert.equal(r.projecao.length, 6);
  // 5000 − 3200 − 200 (parcela) = 1600 em dez; sem parcela em mai/2027 = 1800
  assert.deepEqual(r.projecao[0], { referencia: '2026-12', entradas: 5000, saidas: 3400, parcelas: 200, saldo: 1600, acumulado: 1600 });
  assert.equal(r.projecao[5].saldo, 1800);
  assert.equal(r.aviso, 'Conteúdo educativo; não constitui recomendação financeira profissional.');
});

test('usuário no vermelho, sem reserva e muito comprometido recebe os alertas', async () => {
  const b = await criarUsuario();
  const idsB = await criarBase(b, { reserva: false });
  for (const mes of ['08', '09', '10']) {
    await lancar(b, 'entrada', idsB.salario, idsB.conta, 2000, `2026-${mes}-05`);
    await lancar(b, 'saida', idsB.mercado, idsB.conta, 1950, `2026-${mes}-10`);
  }
  await lancar(b, 'saida', idsB.lazer, idsB.cartao, 7200, '2026-11-15', 6); // 1200/mês: dez + jan = 2400 de 6000 (40%)
  const r = await saude.calcular(b, { hoje: HOJE });
  const alertas = new Set(r.dicas.filter((d) => d.tipo === 'alerta').map((d) => d.indicador));
  assert.deepEqual([...alertas].sort(), ['comprometimento', 'poupanca', 'projecao', 'reserva']);
  assert.ok(r.projecao.every((m) => m.saldo < 0));
});

test('usuário sem nenhum lançamento: sem divisão por zero', async () => {
  const c = await criarUsuario();
  const r = await saude.calcular(c, { hoje: HOJE });
  assert.equal(r.semHistorico, true);
  assert.equal(r.poupanca.media, null);
  assert.equal(r.comprometimento.percentual, null);
  assert.equal(r.reserva.meses, null);
  assert.ok(!r.dicas.some((d) => d.indicador === 'projecao'));
});
