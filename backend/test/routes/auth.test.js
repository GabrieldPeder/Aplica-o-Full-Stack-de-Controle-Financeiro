import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { criarApp } from '../../src/server.js';
import { pool, consultar } from '../../src/config/db.js';
import { config } from '../../src/config/env.js';
import { executarSql } from '../../database/executar.js';

let servidor;
let base;

async function chamar(metodo, caminho, { corpo, token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const resposta = await fetch(`${base}/api${caminho}`, {
    method: metodo,
    headers,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, headers: resposta.headers };
}

const cadastro = (extra = {}) => ({
  nome: 'Ana Souza', email: 'Ana@Email.com ', cpf: '529.982.247-25',
  senha: 'segura123', confirmacaoSenha: 'segura123', ...extra,
});

before(async () => {
  await executarSql('database/schema.sql');
  servidor = criarApp().listen(0);
  base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  servidor.close();
  await pool.end();
});

test('cadastro válido responde 201 com o usuário normalizado', async () => {
  const r = await chamar('POST', '/auth/cadastro', { corpo: cadastro() });
  assert.equal(r.status, 201);
  assert.deepEqual(Object.keys(r.corpo.usuario).sort(), ['cpf', 'email', 'id', 'nome']);
  assert.equal(r.corpo.usuario.email, 'ana@email.com');
  assert.equal(r.corpo.usuario.cpf, '52998224725');
});

test('cadastro inválido responde 400 com todos os campos', async () => {
  const r = await chamar('POST', '/auth/cadastro', {
    corpo: { nome: '', email: 'x', cpf: '123', senha: 'curta', confirmacaoSenha: 'outra' },
  });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.corpo.campos).sort(), ['confirmacaoSenha', 'cpf', 'email', 'nome', 'senha']);
});

test('e-mail com maiúsculas e CPF com máscara contam como repetidos → 409', async () => {
  const r = await chamar('POST', '/auth/cadastro', {
    corpo: cadastro({ email: 'ANA@email.com', cpf: '52998224725' }),
  });
  assert.equal(r.status, 409);
  assert.equal(r.corpo.erro, 'Usuário já cadastrado.');
  assert.deepEqual(Object.keys(r.corpo.campos).sort(), ['cpf', 'email']);
});

test('login certo devolve token que funciona no /me', async () => {
  const login = await chamar('POST', '/auth/login', { corpo: { email: ' ANA@email.com', senha: 'segura123' } });
  assert.equal(login.status, 200);
  assert.equal(login.corpo.usuario.nome, 'Ana Souza');
  const me = await chamar('GET', '/auth/me', { token: login.corpo.token });
  assert.equal(me.status, 200);
  assert.equal(me.corpo.usuario.email, 'ana@email.com');
});

test('senha errada e e-mail inexistente dão a mesma resposta 401', async () => {
  const senhaErrada = await chamar('POST', '/auth/login', { corpo: { email: 'ana@email.com', senha: 'errada123' } });
  const semConta = await chamar('POST', '/auth/login', { corpo: { email: 'nao@existe.com', senha: 'segura123' } });
  assert.equal(senhaErrada.status, 401);
  assert.deepEqual(senhaErrada.corpo, { erro: 'E-mail ou senha inválidos.' });
  assert.deepEqual(semConta.corpo, senhaErrada.corpo);
});

test('login sem campos responde 400', async () => {
  const r = await chamar('POST', '/auth/login', { corpo: {} });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.corpo.campos).sort(), ['email', 'senha']);
});

test('nenhuma resposta expõe o hash da senha', async () => {
  const login = await chamar('POST', '/auth/login', { corpo: { email: 'ana@email.com', senha: 'segura123' } });
  const me = await chamar('GET', '/auth/me', { token: login.corpo.token });
  for (const corpo of [login.corpo, me.corpo]) {
    assert.doesNotMatch(JSON.stringify(corpo), /senha/i);
  }
});

test('/me sem token responde 401', async () => {
  const r = await chamar('GET', '/auth/me');
  assert.equal(r.status, 401);
  assert.deepEqual(r.corpo, { erro: 'Token não informado.' });
});

test('/me com token adulterado, expirado ou de usuário excluído responde 401', async () => {
  const { rows: [{ id }] } = await consultar(`SELECT id FROM usuarios WHERE email = 'ana@email.com'`);
  const adulterado = jwt.sign({}, 'outro-segredo', { subject: String(id) });
  const expirado = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret, { subject: String(id) });
  const excluido = jwt.sign({}, config.jwtSecret, { subject: '999999' });
  for (const token of [adulterado, expirado, excluido, 'lixo']) {
    const r = await chamar('GET', '/auth/me', { token });
    assert.equal(r.status, 401, `token ${token.slice(0, 10)}…`);
    assert.deepEqual(r.corpo, { erro: 'Sessão inválida ou expirada. Entre novamente.' });
  }
});

test('6ª tentativa errada responde 429 e acertos não contam', async () => {
  // Servidor próprio: contador de tentativas zerado.
  const outro = criarApp().listen(0);
  const url = `http://localhost:${outro.address().port}/api/auth/login`;
  const tentar = (senha) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ana@email.com', senha }),
    });
  try {
    for (let i = 0; i < 3; i++) assert.equal((await tentar('segura123')).status, 200);
    for (let i = 0; i < 5; i++) assert.equal((await tentar('errada123')).status, 401);
    const bloqueada = await tentar('errada123');
    assert.equal(bloqueada.status, 429);
    assert.match((await bloqueada.json()).erro, /^Muitas tentativas\. Tente novamente em \d+ minutos?\.$/);
    assert.ok(Number(bloqueada.headers.get('retry-after')) > 0);
  } finally {
    outro.close();
  }
});
