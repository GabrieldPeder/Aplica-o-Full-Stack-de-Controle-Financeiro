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
  assert.equal((await chamar(api.base, 'GET', '/saude-financeira')).status, 401);
});

test('usuário novo → 200 com indicadores vazios, aviso e dica de reserva', async () => {
  const r = await chamar(api.base, 'GET', '/saude-financeira', { token });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.semHistorico, true);
  assert.equal(r.corpo.projecao.length, 6);
  assert.match(r.corpo.aviso, /não constitui recomendação/);
  assert.ok(r.corpo.dicas.some((d) => d.indicador === 'reserva'));
});
