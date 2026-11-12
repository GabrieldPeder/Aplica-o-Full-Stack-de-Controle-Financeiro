import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroApi, tratarErros, rotaNaoEncontrada } from '../../src/middlewares/erros.js';

function resFalso() {
  return {
    statusCode: null,
    body: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(corpo) {
      this.body = corpo;
      return this;
    },
  };
}

function tratar(erro) {
  const res = resFalso();
  tratarErros(erro, {}, res, () => {});
  return res;
}

test('ErroApi com campos', () => {
  const res = tratar(new ErroApi(400, 'Dados inválidos.', { valor: 'O valor deve ser maior que zero.' }));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { erro: 'Dados inválidos.', campos: { valor: 'O valor deve ser maior que zero.' } });
});

test('ErroApi sem campos não inclui a chave campos', () => {
  const res = tratar(new ErroApi(404, 'Lançamento não encontrado.'));
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { erro: 'Lançamento não encontrado.' });
});

test('JSON malformado vira 400', () => {
  const erro = Object.assign(new SyntaxError('Unexpected end'), { type: 'entity.parse.failed', status: 400 });
  const res = tratar(erro);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { erro: 'JSON inválido no corpo da requisição.' });
});

test('e-mail duplicado vira 409 no campo email', () => {
  const res = tratar({ code: '23505', constraint: 'usuarios_email_unico' });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    erro: 'Usuário já cadastrado.',
    campos: { email: 'Já existe um usuário com este e-mail.' },
  });
});

test('CPF duplicado vira 409 no campo cpf', () => {
  const res = tratar({ code: '23505', constraint: 'usuarios_cpf_unico' });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    erro: 'Usuário já cadastrado.',
    campos: { cpf: 'Já existe um usuário com este CPF.' },
  });
});

test('categoria duplicada vira 409 no campo nome', () => {
  const res = tratar({ code: '23505', constraint: 'categorias_nome_unico' });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    erro: 'Registro duplicado.',
    campos: { nome: 'Já existe uma categoria com este nome e tipo.' },
  });
});

test('fonte/destino duplicada vira 409 no campo nome', () => {
  const res = tratar({ code: '23505', constraint: 'fontes_destinos_nome_unico' });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    erro: 'Registro duplicado.',
    campos: { nome: 'Já existe uma fonte/destino com este nome.' },
  });
});

test('duplicidade em constraint desconhecida vira 409 genérico', () => {
  const res = tratar({ code: '23505', constraint: 'outra_constraint' });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { erro: 'Registro duplicado.' });
});

test('violação de FK vira 409', () => {
  const res = tratar({ code: '23503' });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { erro: 'Não é possível excluir: existem lançamentos vinculados.' });
});

test('parâmetro com tipo inválido (22P02) vira 400', () => {
  const res = tratar({ code: '22P02' });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { erro: 'Parâmetro inválido.' });
});

test('erro inesperado vira 500 sem stack', (t) => {
  t.mock.method(console, 'error', () => {});
  const res = tratar(new Error('banco caiu'));
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { erro: 'Erro interno do servidor.' });
  assert.equal('stack' in res.body, false);
});

test('rota inexistente vira 404', () => {
  const res = resFalso();
  rotaNaoEncontrada({}, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { erro: 'Rota não encontrada.' });
});
