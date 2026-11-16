import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validar, texto, email, cpf, senha, igualA, umDe, inteiro, dinheiro, booleano, quando,
} from '../../src/middlewares/validar.js';

// Executa o middleware com uma requisição falsa e devolve o que aconteceu.
function executar(esquema, { body, query, params } = {}) {
  const req = { body, query: query ?? {}, params: params ?? {} };
  const res = {
    statusCode: null,
    corpo: null,
    status(c) { this.statusCode = c; return this; },
    json(c) { this.corpo = c; return this; },
  };
  let chamouNext = false;
  validar(esquema)(req, res, () => { chamouNext = true; });
  return { req, res, chamouNext };
}

const regra = (r, valor, corpo = {}) => r(valor, corpo);

test('normaliza o corpo em req.dados e descarta campos extras', () => {
  const { req, chamouNext } = executar(
    { body: { nome: texto({ max: 120 }), email: email() } },
    { body: { nome: '  Ana  ', email: ' Ana@Email.COM ', usuario_id: 99 } },
  );
  assert.equal(chamouNext, true);
  assert.deepEqual(req.dados, { nome: 'Ana', email: 'ana@email.com' });
});

test('normaliza query em req.filtros e params em req.parametros', () => {
  const { req } = executar(
    { query: { pagina: inteiro({ min: 1, padrao: 1 }) }, params: { id: inteiro({ min: 1 }) } },
    { query: {}, params: { id: '7' } },
  );
  assert.deepEqual(req.filtros, { pagina: 1 });
  assert.deepEqual(req.parametros, { id: 7 });
});

test('junta todos os erros e responde 400', () => {
  const { res, chamouNext } = executar(
    { body: { nome: texto(), email: email(), cpf: cpf() } },
    { body: { email: 'sem-arroba', cpf: '123' } },
  );
  assert.equal(chamouNext, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.corpo, {
    erro: 'Dados inválidos.',
    campos: { nome: 'Campo obrigatório.', email: 'E-mail inválido.', cpf: 'CPF inválido.' },
  });
});

test('corpo ausente conta como vazio', () => {
  const { res } = executar({ body: { nome: texto() } }, {});
  assert.deepEqual(res.corpo.campos, { nome: 'Campo obrigatório.' });
});

test('texto: tamanho máximo e opcional', () => {
  assert.deepEqual(regra(texto({ max: 3 }), 'abcd'), { erro: 'Máximo de 3 caracteres.' });
  assert.deepEqual(regra(texto({ opcional: true }), '   '), { valor: null });
  assert.deepEqual(regra(texto(), 42), { erro: 'Campo obrigatório.' });
});

test('cpf: guarda só os dígitos', () => {
  assert.deepEqual(regra(cpf(), '529.982.247-25'), { valor: '52998224725' });
});

test('senha: pelo menos 8 caracteres com letra e número', () => {
  const msg = 'A senha deve ter pelo menos 8 caracteres, com letras e números.';
  assert.deepEqual(regra(senha(), 'abc12'), { erro: msg });
  assert.deepEqual(regra(senha(), 'abcdefgh'), { erro: msg });
  assert.deepEqual(regra(senha(), '12345678'), { erro: msg });
  assert.deepEqual(regra(senha(), 'segura123'), { valor: 'segura123' });
});

test('igualA: confirmação de senha', () => {
  const r = igualA('senha', 'As senhas não conferem.');
  assert.deepEqual(r('x1234567', { senha: 'segura123' }), { erro: 'As senhas não conferem.' });
  assert.deepEqual(r('segura123', { senha: 'segura123' }), { valor: 'segura123' });
});

test('umDe: aceita só os valores da lista', () => {
  assert.deepEqual(regra(umDe(['entrada', 'saida']), 'saida'), { valor: 'saida' });
  assert.deepEqual(regra(umDe(['entrada', 'saida']), 'outro'), { erro: 'Valor inválido.' });
  assert.deepEqual(regra(umDe(['entrada', 'saida']), undefined), { erro: 'Campo obrigatório.' });
});

test('inteiro: converte texto, respeita limites e padrão', () => {
  const r = inteiro({ min: 1, max: 31 });
  assert.deepEqual(regra(r, '15'), { valor: 15 });
  assert.deepEqual(regra(r, '0'), { erro: 'Informe um número inteiro entre 1 e 31.' });
  assert.deepEqual(regra(r, '2.5'), { erro: 'Informe um número inteiro entre 1 e 31.' });
  assert.deepEqual(regra(r, 'abc'), { erro: 'Informe um número inteiro entre 1 e 31.' });
  assert.deepEqual(regra(inteiro({ min: 1, padrao: 1 }), undefined), { valor: 1 });
  assert.deepEqual(regra(inteiro({ min: 1, opcional: true }), ''), { valor: null });
  assert.deepEqual(regra(inteiro({ min: 1 }), '99999999999'), {
    erro: 'Informe um número inteiro entre 1 e 2147483647.',
  });
});

test('dinheiro: maior que zero com até 2 casas', () => {
  const msg = 'Informe um valor maior que zero, com até 2 casas decimais.';
  assert.deepEqual(regra(dinheiro(), 1500.5), { valor: 1500.5 });
  assert.deepEqual(regra(dinheiro(), '33.34'), { valor: 33.34 });
  assert.deepEqual(regra(dinheiro(), 0), { erro: msg });
  assert.deepEqual(regra(dinheiro(), 10.005), { erro: msg });
  assert.deepEqual(regra(dinheiro(), 'dez'), { erro: msg });
});

test('booleano: aceita true/false e usa o padrão', () => {
  assert.deepEqual(regra(booleano({ padrao: false }), undefined), { valor: false });
  assert.deepEqual(regra(booleano(), true), { valor: true });
  assert.deepEqual(regra(booleano(), 'talvez'), { erro: 'Valor inválido.' });
});

test('quando: aplica a regra só se a condição valer, senão grava null', () => {
  const r = quando((corpo) => corpo.tipo === 'cartao_credito', inteiro({ min: 1, max: 31 }));
  assert.deepEqual(r(undefined, { tipo: 'conta' }), { valor: null });
  assert.deepEqual(r(10, { tipo: 'conta' }), { valor: null });
  assert.deepEqual(r(undefined, { tipo: 'cartao_credito' }), { erro: 'Campo obrigatório.' });
  assert.deepEqual(r('10', { tipo: 'cartao_credito' }), { valor: 10 });
});
