import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { inicioDoMes } from '../../src/config/datas.js';
import { subirServidor, chamar, criarSessao } from '../ajudantes/api.js';

let api;
let tokenA;
let tokenB;
let a; // ids padrão do usuário A

const pedir = (metodo, caminho, opcoes = {}) => chamar(api.base, metodo, caminho, { token: tokenA, ...opcoes });

before(async () => {
  await executarSql('database/schema.sql');
  api = subirServidor();
  tokenA = await criarSessao(api.base);
  tokenB = await criarSessao(api.base);

  const categorias = (await pedir('GET', '/categorias')).corpo;
  const cartao = await pedir('POST', '/fontes-destinos', {
    corpo: { nome: 'Cartão', tipo: 'cartao_credito', diaFechamento: 5, diaVencimento: 15, limite: 3000 },
  });
  const fontes = (await pedir('GET', '/fontes-destinos')).corpo;
  a = {
    alimentacao: categorias.find((c) => c.nome === 'Alimentação').id,
    salario: categorias.find((c) => c.nome === 'Salário' && c.tipo === 'entrada').id,
    conta: fontes.find((f) => f.tipo === 'conta').id,
    cartao: cartao.corpo.id,
  };
});

after(async () => {
  api.fechar();
  await pool.end();
});

const saida = (extra = {}) => ({
  tipo: 'saida', descricao: 'Mercado', valor: 50, data: inicioDoMes(),
  categoriaId: a.alimentacao, fonteDestinoId: a.conta, ...extra,
});

test('sem token → 401', async () => {
  assert.equal((await chamar(api.base, 'GET', '/lancamentos')).status, 401);
});

test('corpo inválido → 400 com todos os campos', async () => {
  const r = await pedir('POST', '/lancamentos', {
    corpo: { tipo: 'gasto', descricao: '', valor: 10.555, data: '2026-02-30', totalParcelas: 49 },
  });
  assert.equal(r.status, 400);
  assert.deepEqual(
    Object.keys(r.corpo.campos).sort(),
    ['categoriaId', 'data', 'descricao', 'fonteDestinoId', 'tipo', 'totalParcelas', 'valor'],
  );
});

test('cria à vista → 201 com lista; GET /:id devolve o lançamento', async () => {
  const r = await pedir('POST', '/lancamentos', { corpo: saida({ descricao: '  Padaria ' }) });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.length, 1);
  assert.equal(r.corpo[0].descricao, 'Padaria');
  const um = await pedir('GET', `/lancamentos/${r.corpo[0].id}`);
  assert.equal(um.status, 200);
  assert.equal(um.corpo.valor, 50);
});

test('parcelado 100/3 no cartão soma 100,00', async () => {
  const r = await pedir('POST', '/lancamentos', { corpo: saida({ valor: 100, fonteDestinoId: a.cartao, totalParcelas: 3 }) });
  assert.equal(r.status, 201);
  const soma = r.corpo.reduce((t, p) => t + Math.round(p.valor * 100), 0);
  assert.equal(soma, 10000);
});

test('R$ 0,02 em 3x → 400 no valor', async () => {
  const r = await pedir('POST', '/lancamentos', { corpo: saida({ valor: 0.02, fonteDestinoId: a.cartao, totalParcelas: 3 }) });
  assert.equal(r.status, 400);
  assert.ok(r.corpo.campos.valor);
});

test('saída com categoria de entrada → 400 em categoriaId', async () => {
  const r = await pedir('POST', '/lancamentos', { corpo: saida({ categoriaId: a.salario }) });
  assert.equal(r.status, 400);
  assert.ok(r.corpo.campos.categoriaId);
});

test('listar usa o mês corrente por padrão e devolve totais', async () => {
  const r = await pedir('GET', '/lancamentos');
  assert.equal(r.status, 200);
  assert.ok(r.corpo.totalItens >= 4);
  assert.equal(r.corpo.pagina, 1);
  assert.ok(r.corpo.totais.saidas > 0);
});

test('filtro com fim antes do início → 400', async () => {
  const r = await pedir('GET', '/lancamentos?inicio=2026-11-10&fim=2026-11-01');
  assert.equal(r.status, 400);
  assert.ok(r.corpo.campos.fim);
});

test('editar parcelado mandando o objeto inteiro (sem mudar data) → 200', async () => {
  const [p1] = (await pedir('POST', '/lancamentos', {
    corpo: saida({ valor: 90, fonteDestinoId: a.cartao, totalParcelas: 3 }),
  })).corpo;
  const r = await pedir('PUT', `/lancamentos/${p1.id}`, { corpo: { ...saida({ fonteDestinoId: a.cartao, totalParcelas: 3 }), descricao: 'TV', valor: 31 } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.descricao, 'TV');

  const mudaData = await pedir('PUT', `/lancamentos/${p1.id}`, { corpo: saida({ fonteDestinoId: a.cartao, data: '2020-01-01' }) });
  assert.equal(mudaData.status, 400);
});

test('usuário B não lê, edita nem exclui lançamento de A → 404', async () => {
  const [l] = (await pedir('POST', '/lancamentos', { corpo: saida() })).corpo;
  const opcoes = { token: tokenB };
  assert.equal((await chamar(api.base, 'GET', `/lancamentos/${l.id}`, opcoes)).status, 404);
  assert.equal((await chamar(api.base, 'PUT', `/lancamentos/${l.id}`, { ...opcoes, corpo: saida() })).status, 404);
  assert.equal((await chamar(api.base, 'DELETE', `/lancamentos/${l.id}`, opcoes)).status, 404);
});

test('DELETE com todasParcelas → 204 e grupo apagado', async () => {
  const parcelas = (await pedir('POST', '/lancamentos', {
    corpo: saida({ fonteDestinoId: a.cartao, totalParcelas: 2 }),
  })).corpo;
  assert.equal((await pedir('DELETE', `/lancamentos/${parcelas[0].id}?todasParcelas=true`)).status, 204);
  assert.equal((await pedir('GET', `/lancamentos/${parcelas[1].id}`)).status, 404);
});

test('excluir categoria com lançamento → 409', async () => {
  const r = await pedir('DELETE', `/categorias/${a.alimentacao}`);
  assert.equal(r.status, 409);
});
