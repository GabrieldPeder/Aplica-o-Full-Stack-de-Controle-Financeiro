import '../ajudantes/ambiente.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, consultar } from '../../src/config/db.js';
import { executarSql } from '../../database/executar.js';
import { subirServidor, chamar } from '../ajudantes/api.js';

let api;

before(async () => {
  await executarSql('database/schema.sql');
  await executarSql('database/seed.sql');
  api = subirServidor();
});

after(async () => {
  api.fechar();
  await pool.end();
});

test('usuários do seed entram com a senha documentada', async () => {
  for (const email of ['ana@exemplo.com', 'bruno@exemplo.com']) {
    const r = await chamar(api.base, 'POST', '/auth/login', { corpo: { email, senha: 'demo1234' } });
    assert.equal(r.status, 200, email);
  }
});

test('parcelas de cada compra somam o valor exato e têm a mesma data', async () => {
  const { rows } = await consultar(
    `SELECT grupo_parcelamento, COUNT(*)::int AS n, MAX(total_parcelas) AS total, COUNT(DISTINCT data)::int AS datas
     FROM lancamentos WHERE grupo_parcelamento IS NOT NULL GROUP BY grupo_parcelamento`,
  );
  assert.ok(rows.length >= 4);
  for (const r of rows) {
    assert.equal(r.n, r.total);
    assert.equal(r.datas, 1);
  }
});

test('nenhum lançamento no futuro; cada usuário tem 2 cartões e 1 reserva', async () => {
  const { rows: [futuro] } = await consultar('SELECT COUNT(*)::int AS n FROM lancamentos WHERE data > CURRENT_DATE');
  assert.equal(futuro.n, 0);
  const { rows } = await consultar(
    `SELECT usuario_id, COUNT(*) FILTER (WHERE tipo = 'cartao_credito')::int AS cartoes,
            COUNT(*) FILTER (WHERE reserva)::int AS reservas
     FROM fontes_destinos GROUP BY usuario_id`,
  );
  assert.equal(rows.length, 2);
  for (const r of rows) assert.deepEqual([r.cartoes, r.reservas], [2, 1]);
});

test('seed pode ser executado de novo (recomeça do zero)', async () => {
  await executarSql('database/seed.sql');
  const { rows: [u] } = await consultar('SELECT COUNT(*)::int AS n FROM usuarios');
  assert.equal(u.n, 2);
});
