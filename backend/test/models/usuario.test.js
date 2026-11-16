import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { pool, consultar } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { ErroApi } from '../../src/middlewares/erros.js';
import * as usuario from '../../src/models/usuario.js';

const dados = (extra = {}) => ({
  nome: 'Ana Souza', email: 'ana@email.com', cpf: '52998224725', senha: 'segura123', ...extra,
});

async function rejeita409(promessa, camposEsperados) {
  await assert.rejects(promessa, (erro) => {
    assert.ok(erro instanceof ErroApi);
    assert.equal(erro.status, 409);
    assert.equal(erro.message, 'Usuário já cadastrado.');
    assert.deepEqual(Object.keys(erro.campos).sort(), camposEsperados);
    return true;
  });
}

before(async () => {
  await executarSql('database/schema.sql');
});

after(async () => {
  await pool.end();
});

test('cria usuário e devolve sem a senha', async () => {
  const criado = await usuario.criarComPadroes(dados());
  assert.deepEqual(Object.keys(criado).sort(), ['cpf', 'email', 'id', 'nome']);
  assert.equal(criado.email, 'ana@email.com');
});

test('senha é gravada em hash bcrypt', async () => {
  const { rows } = await consultar(`SELECT senha_hash FROM usuarios WHERE email = 'ana@email.com'`);
  assert.notEqual(rows[0].senha_hash, 'segura123');
  assert.equal(await bcrypt.compare('segura123', rows[0].senha_hash), true);
});

test('cria as categorias e fontes padrão', async () => {
  const { rows: [{ id }] } = await consultar(`SELECT id FROM usuarios WHERE email = 'ana@email.com'`);
  const { rows: categorias } = await consultar('SELECT nome, tipo FROM categorias WHERE usuario_id = $1', [id]);
  const { rows: fontes } = await consultar('SELECT nome, tipo FROM fontes_destinos WHERE usuario_id = $1', [id]);
  assert.equal(categorias.length, usuario.CATEGORIAS_PADRAO.length);
  assert.equal(categorias.length, 9);
  assert.deepEqual(fontes.map((f) => f.tipo).sort(), ['conta', 'renda']);
});

test('e-mail repetido → 409 no campo email', async () => {
  await rejeita409(usuario.criarComPadroes(dados({ cpf: '11144477735' })), ['email']);
});

test('CPF repetido → 409 no campo cpf', async () => {
  await rejeita409(usuario.criarComPadroes(dados({ email: 'outra@email.com' })), ['cpf']);
});

test('e-mail e CPF repetidos → 409 com os dois campos', async () => {
  await rejeita409(usuario.criarComPadroes(dados()), ['cpf', 'email']);
});

test('se os padrões falharem, o usuário não fica gravado', async () => {
  // Constraint temporária que faz a inserção das categorias padrão falhar.
  await consultar(`ALTER TABLE categorias ADD CONSTRAINT teste_bloqueia_lazer CHECK (nome <> 'Lazer') NOT VALID`);
  try {
    await assert.rejects(
      usuario.criarComPadroes(dados({ email: 'bia@email.com', cpf: '11144477735' })),
      { code: '23514' },
    );
  } finally {
    await consultar('ALTER TABLE categorias DROP CONSTRAINT teste_bloqueia_lazer');
  }
  const { rows } = await consultar(`SELECT count(*)::int AS n FROM usuarios WHERE email = 'bia@email.com'`);
  assert.equal(rows[0].n, 0);
});

test('conferirCredenciais: senha certa devolve o usuário', async () => {
  const u = await usuario.conferirCredenciais('ana@email.com', 'segura123');
  assert.equal(u.nome, 'Ana Souza');
  assert.equal('senhaHash' in u || 'senha_hash' in u, false);
});

test('conferirCredenciais: senha errada ou e-mail inexistente devolve null', async () => {
  assert.equal(await usuario.conferirCredenciais('ana@email.com', 'errada123'), null);
  assert.equal(await usuario.conferirCredenciais('ninguem@email.com', 'segura123'), null);
});

test('buscarPorId devolve o usuário ou null', async () => {
  const { rows: [{ id }] } = await consultar(`SELECT id FROM usuarios WHERE email = 'ana@email.com'`);
  assert.equal((await usuario.buscarPorId(id)).email, 'ana@email.com');
  assert.equal(await usuario.buscarPorId(999999), null);
});
