import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, consultar, emTransacao } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';

let contador = 0;
async function inserirUsuario(email = `u${++contador}@teste.com`, cpf = String(contador).padStart(11, '0')) {
  const { rows } = await consultar(
    `INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ('Teste', $1, $2, 'x') RETURNING id`,
    [email, cpf],
  );
  return rows[0].id;
}

async function inserirCategoria(usuarioId) {
  const { rows } = await consultar(
    `INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, 'Alimentação', 'saida') RETURNING id`,
    [usuarioId],
  );
  return rows[0].id;
}

async function inserirConta(usuarioId) {
  const { rows } = await consultar(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, 'Conta corrente', 'conta') RETURNING id`,
    [usuarioId],
  );
  return rows[0].id;
}

async function inserirLancamento(usuarioId, categoriaId, contaId, valor = 10) {
  await consultar(
    `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, 'saida', 'Mercado', $2, '2026-11-03', $3, $4)`,
    [usuarioId, valor, categoriaId, contaId],
  );
}

before(async () => {
  await executarSql('database/schema.sql');
});

after(async () => {
  await pool.end();
});

test('email duplicado viola usuarios_email_unico', async () => {
  await inserirUsuario('dup@teste.com', '11111111111');
  await assert.rejects(inserirUsuario('dup@teste.com', '22222222222'), {
    code: '23505',
    constraint: 'usuarios_email_unico',
  });
});

test('cpf duplicado viola usuarios_cpf_unico', async () => {
  await inserirUsuario('a@cpf.com', '33333333333');
  await assert.rejects(inserirUsuario('b@cpf.com', '33333333333'), {
    code: '23505',
    constraint: 'usuarios_cpf_unico',
  });
});

test('cartão sem limite viola CHECK', async () => {
  const usuarioId = await inserirUsuario();
  await assert.rejects(
    consultar(
      `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento)
       VALUES ($1, 'Nubank', 'cartao_credito', 3, 10)`,
      [usuarioId],
    ),
    { code: '23514' },
  );
});

test('lançamento com valor 0 viola CHECK', async () => {
  const usuarioId = await inserirUsuario();
  const categoriaId = await inserirCategoria(usuarioId);
  const contaId = await inserirConta(usuarioId);
  await assert.rejects(inserirLancamento(usuarioId, categoriaId, contaId, 0), { code: '23514' });
});

test('excluir categoria com lançamento viola FK', async () => {
  const usuarioId = await inserirUsuario();
  const categoriaId = await inserirCategoria(usuarioId);
  const contaId = await inserirConta(usuarioId);
  await inserirLancamento(usuarioId, categoriaId, contaId);
  await assert.rejects(consultar('DELETE FROM categorias WHERE id = $1', [categoriaId]), { code: '23503' });
});

test('excluir usuário apaga os dados dele em cascata', async () => {
  const usuarioId = await inserirUsuario();
  const categoriaId = await inserirCategoria(usuarioId);
  const contaId = await inserirConta(usuarioId);
  await inserirLancamento(usuarioId, categoriaId, contaId);
  await consultar('DELETE FROM usuarios WHERE id = $1', [usuarioId]);
  const { rows } = await consultar('SELECT count(*)::int AS n FROM lancamentos WHERE usuario_id = $1', [usuarioId]);
  assert.equal(rows[0].n, 0);
});

test('DATE volta como string AAAA-MM-DD', async () => {
  const { rows } = await consultar(`SELECT DATE '2026-11-03' AS d`);
  assert.equal(rows[0].d, '2026-11-03');
});

test('emTransacao desfaz tudo e libera a conexão em erro', async () => {
  for (let i = 0; i < 12; i++) {
    await assert.rejects(
      emTransacao(async (cliente) => {
        await cliente.query(
          `INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ('T', 'rollback@teste.com', '99999999999', 'x')`,
        );
        throw new Error('falha');
      }),
      /falha/,
    );
  }
  const { rows } = await consultar(`SELECT count(*)::int AS n FROM usuarios WHERE email = 'rollback@teste.com'`);
  assert.equal(rows[0].n, 0);
  assert.ok(pool.totalCount <= 10);
  assert.equal(pool.waitingCount, 0);
});

test('emTransacao confirma e devolve o retorno', async () => {
  const id = await emTransacao(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ('T', 'commit@teste.com', '88888888888', 'x') RETURNING id`,
    );
    return rows[0].id;
  });
  const { rows } = await consultar('SELECT email FROM usuarios WHERE id = $1', [id]);
  assert.equal(rows[0].email, 'commit@teste.com');
});

test('schema.sql pode ser executado duas vezes', async () => {
  await executarSql('database/schema.sql');
});
