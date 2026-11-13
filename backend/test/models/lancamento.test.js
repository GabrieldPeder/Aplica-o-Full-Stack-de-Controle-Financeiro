import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, consultar } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { ErroApi } from '../../src/middlewares/erros.js';
import * as lancamento from '../../src/models/lancamento.js';

let contador = 0;

// Cria um usuário com categorias de entrada/saída, uma conta e um cartão.
async function criarCenario() {
  contador++;
  const { rows: [u] } = await consultar(
    `INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ('Teste', $1, $2, 'x') RETURNING id`,
    [`lanc${contador}@teste.com`, String(contador).padStart(11, '7')],
  );
  const inserir = async (sql, params) => (await consultar(sql, params)).rows[0].id;
  return {
    usuarioId: u.id,
    alimentacao: await inserir(`INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, 'Alimentação', 'saida') RETURNING id`, [u.id]),
    salario: await inserir(`INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, 'Salário', 'entrada') RETURNING id`, [u.id]),
    conta: await inserir(`INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, 'Conta', 'conta') RETURNING id`, [u.id]),
    cartao: await inserir(
      `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite)
       VALUES ($1, 'Cartão', 'cartao_credito', 5, 15, 5000) RETURNING id`,
      [u.id],
    ),
  };
}

const saida = (c, extra = {}) => ({
  tipo: 'saida', descricao: 'Mercado', valor: 50, data: '2026-11-03',
  categoriaId: c.alimentacao, fonteDestinoId: c.conta, ...extra,
});

async function rejeitaCom(promessa, status, campo) {
  await assert.rejects(promessa, (erro) => {
    assert.ok(erro instanceof ErroApi);
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

test('cria lançamento à vista e devolve em camelCase com valor numérico', async () => {
  const c = await criarCenario();
  const [l] = await lancamento.criar(c.usuarioId, saida(c, { valor: 19.99 }));
  assert.equal(l.valor, 19.99);
  assert.equal(l.data, '2026-11-03');
  assert.equal(l.totalParcelas, 1);
  assert.equal(l.grupoParcelamento, null);
  assert.equal(l.categoriaNome, 'Alimentação');
});

test('parcelado 100,00 em 3x no cartão: 33,34 + 33,33 + 33,33, mesmo grupo e mesma data', async () => {
  const c = await criarCenario();
  const parcelas = await lancamento.criar(c.usuarioId, saida(c, { valor: 100, fonteDestinoId: c.cartao, totalParcelas: 3 }));
  assert.deepEqual(parcelas.map((p) => p.valor), [33.34, 33.33, 33.33]);
  assert.deepEqual(parcelas.map((p) => p.parcelaAtual), [1, 2, 3]);
  assert.equal(new Set(parcelas.map((p) => p.grupoParcelamento)).size, 1);
  assert.ok(parcelas.every((p) => p.data === '2026-11-03'));
});

test('parcelamento fora do cartão → 400 em totalParcelas', async () => {
  const c = await criarCenario();
  await rejeitaCom(lancamento.criar(c.usuarioId, saida(c, { totalParcelas: 2 })), 400, 'totalParcelas');
});

test('saída com categoria de entrada → 400 em categoriaId', async () => {
  const c = await criarCenario();
  await rejeitaCom(lancamento.criar(c.usuarioId, saida(c, { categoriaId: c.salario })), 400, 'categoriaId');
});

test('categoria ou fonte de outro usuário → 404', async () => {
  const a = await criarCenario();
  const b = await criarCenario();
  await rejeitaCom(lancamento.criar(a.usuarioId, saida(a, { categoriaId: b.alimentacao })), 404);
  await rejeitaCom(lancamento.criar(a.usuarioId, saida(a, { fonteDestinoId: b.conta })), 404);
});

test('usuário A não lê, edita nem exclui lançamento de B', async () => {
  const a = await criarCenario();
  const b = await criarCenario();
  const [deB] = await lancamento.criar(b.usuarioId, saida(b));
  assert.equal(await lancamento.buscarPorId(a.usuarioId, deB.id), null);
  await rejeitaCom(lancamento.atualizar(a.usuarioId, deB.id, { descricao: 'x' }), 404);
  assert.equal(await lancamento.excluir(a.usuarioId, deB.id), false);
  assert.ok(await lancamento.buscarPorId(b.usuarioId, deB.id));
});

test('listar: filtros, ordenação, paginação e totais sobre o filtro inteiro', async () => {
  const c = await criarCenario();
  for (let dia = 1; dia <= 22; dia++) {
    await lancamento.criar(c.usuarioId, saida(c, { valor: 10, data: `2026-10-${String(dia).padStart(2, '0')}` }));
  }
  await lancamento.criar(c.usuarioId, {
    tipo: 'entrada', descricao: 'Salário', valor: 1000, data: '2026-10-05',
    categoriaId: c.salario, fonteDestinoId: c.conta,
  });
  await lancamento.criar(c.usuarioId, saida(c, { data: '2026-11-01' })); // fora do período

  const pag1 = await lancamento.listar(c.usuarioId, { inicio: '2026-10-01', fim: '2026-10-31' });
  assert.equal(pag1.totalItens, 23);
  assert.equal(pag1.totalPaginas, 2);
  assert.equal(pag1.itens.length, 20);
  assert.equal(pag1.itens[0].data, '2026-10-22');
  assert.deepEqual(pag1.totais, { entradas: 1000, saidas: 220, saldo: 780 });

  const pag2 = await lancamento.listar(c.usuarioId, { inicio: '2026-10-01', fim: '2026-10-31', pagina: 2 });
  assert.equal(pag2.itens.length, 3);

  const soEntradas = await lancamento.listar(c.usuarioId, { inicio: '2026-10-01', fim: '2026-10-31', tipo: 'entrada' });
  assert.equal(soEntradas.totalItens, 1);
  assert.deepEqual(soEntradas.totais, { entradas: 1000, saidas: 0, saldo: 1000 });
});

test('atualizar à vista muda qualquer campo', async () => {
  const c = await criarCenario();
  const [l] = await lancamento.criar(c.usuarioId, saida(c));
  const novo = await lancamento.atualizar(c.usuarioId, l.id, { descricao: 'Feira', valor: 12.5, data: '2026-11-10' });
  assert.equal(novo.descricao, 'Feira');
  assert.equal(novo.valor, 12.5);
  assert.equal(novo.data, '2026-11-10');
});

test('atualizar parcelado: descrição/valor sim; data ou cartão → 400', async () => {
  const c = await criarCenario();
  const [p1] = await lancamento.criar(c.usuarioId, saida(c, { valor: 100, fonteDestinoId: c.cartao, totalParcelas: 2 }));
  const novo = await lancamento.atualizar(c.usuarioId, p1.id, { descricao: 'TV', valor: 60 });
  assert.equal(novo.descricao, 'TV');
  assert.equal(novo.valor, 60);
  await rejeitaCom(lancamento.atualizar(c.usuarioId, p1.id, { data: '2026-12-01' }), 400, 'data');
  await rejeitaCom(lancamento.atualizar(c.usuarioId, p1.id, { fonteDestinoId: c.conta }), 400, 'fonteDestinoId');
  // mandar o mesmo valor que já está gravado não é alteração
  await lancamento.atualizar(c.usuarioId, p1.id, { data: '2026-11-03', totalParcelas: 2 });
});

test('excluir: só a parcela ou todas as parcelas do grupo', async () => {
  const c = await criarCenario();
  const compra1 = await lancamento.criar(c.usuarioId, saida(c, { fonteDestinoId: c.cartao, totalParcelas: 3 }));
  assert.equal(await lancamento.excluir(c.usuarioId, compra1[0].id), true);
  assert.equal(await lancamento.buscarPorId(c.usuarioId, compra1[0].id), null);
  assert.ok(await lancamento.buscarPorId(c.usuarioId, compra1[1].id));

  const compra2 = await lancamento.criar(c.usuarioId, saida(c, { fonteDestinoId: c.cartao, totalParcelas: 3 }));
  assert.equal(await lancamento.excluir(c.usuarioId, compra2[1].id, { todasParcelas: true }), true);
  for (const p of compra2) assert.equal(await lancamento.buscarPorId(c.usuarioId, p.id), null);
  assert.ok(await lancamento.buscarPorId(c.usuarioId, compra1[2].id), 'não pode apagar outra compra');
});

test('excluir todasParcelas em lançamento à vista apaga só ele', async () => {
  const c = await criarCenario();
  const [a] = await lancamento.criar(c.usuarioId, saida(c));
  const [b] = await lancamento.criar(c.usuarioId, saida(c));
  assert.equal(await lancamento.excluir(c.usuarioId, a.id, { todasParcelas: true }), true);
  assert.ok(await lancamento.buscarPorId(c.usuarioId, b.id));
});
