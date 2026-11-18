import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { subirServidor, chamar, criarSessao } from '../ajudantes/api.js';

let api;
let token;

before(async () => {
  await executarSql('database/schema.sql');
  api = subirServidor();
  token = await criarSessao(api.base);
});

after(async () => {
  api.fechar();
  await pool.end();
});

test('sem token → 401', async () => {
  assert.equal((await chamar(api.base, 'GET', '/relatorios/fontes-destinos?inicio=2026-11-01&fim=2026-11-30')).status, 401);
  assert.equal((await chamar(api.base, 'GET', '/relatorios/faturas')).status, 401);
});

test('fontes-destinos sem datas ou com data inexistente → 400 com os campos', async () => {
  const semDatas = await chamar(api.base, 'GET', '/relatorios/fontes-destinos', { token });
  assert.equal(semDatas.status, 400);
  assert.deepEqual(Object.keys(semDatas.corpo.campos).sort(), ['fim', 'inicio']);
  const inexistente = await chamar(api.base, 'GET', '/relatorios/fontes-destinos?inicio=2026-02-30&fim=2026-03-31', { token });
  assert.equal(inexistente.status, 400);
  assert.ok(inexistente.corpo.campos.inicio);
});

test('fontes-destinos com início depois do fim → 400 no campo fim', async () => {
  const r = await chamar(api.base, 'GET', '/relatorios/fontes-destinos?inicio=2026-12-01&fim=2026-11-01', { token });
  assert.equal(r.status, 400);
  assert.deepEqual(r.corpo, {
    erro: 'Dados inválidos.',
    campos: { fim: 'A data final deve ser igual ou posterior à inicial.' },
  });
});

test('fontes-destinos responde 200 com o formato do relatório', async () => {
  const r = await chamar(api.base, 'GET', '/relatorios/fontes-destinos?inicio=2026-11-01&fim=2026-11-30', { token });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.corpo).sort(), [
    'entradasPorFonte', 'periodo', 'saidasPorDestino', 'saldoContas', 'totalEntradas', 'totalSaidas',
  ]);
  assert.deepEqual(r.corpo.saldoContas.map((c) => c.nome), ['Conta corrente']); // conta padrão do cadastro
});

test('faturas: meses fora de 1 a 12 → 400', async () => {
  for (const meses of ['0', '13', 'abc']) {
    const r = await chamar(api.base, 'GET', `/relatorios/faturas?meses=${meses}`, { token });
    assert.equal(r.status, 400, `meses=${meses}`);
    assert.ok(r.corpo.campos.meses);
  }
});

test('faturas: padrão de 3 meses além da atual', async () => {
  await chamar(api.base, 'POST', '/fontes-destinos', {
    token, corpo: { nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000 },
  });
  const r = await chamar(api.base, 'GET', '/relatorios/faturas', { token });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.cartoes.length, 1);
  assert.equal(r.corpo.cartoes[0].faturas.length, 4);
  const seis = await chamar(api.base, 'GET', '/relatorios/faturas?meses=6', { token });
  assert.equal(seis.corpo.cartoes[0].faturas.length, 7);
});
