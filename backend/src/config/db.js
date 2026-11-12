// Conexão com o PostgreSQL: pool de conexões e transações.
import pg from 'pg';
import { config } from './env.js';

// DATE (OID 1082) volta como texto 'AAAA-MM-DD'. Sem isso o pg cria um Date no fuso
// local e '2026-11-03' pode virar 02/11 no horário de Brasília.
pg.types.setTypeParser(1082, (valor) => valor);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export function consultar(sql, params = []) {
  return pool.query(sql, params);
}

// Executa fn(cliente) dentro de BEGIN/COMMIT. Qualquer erro desfaz tudo (ROLLBACK)
// e é relançado. A conexão sempre volta para o pool.
export async function emTransacao(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}
