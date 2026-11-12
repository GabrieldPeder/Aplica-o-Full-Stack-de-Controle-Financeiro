// Conexão com o PostgreSQL: pool de conexões e transações.
import pg from 'pg';
import { config } from './env.js';

// DATE (OID 1082) volta como texto 'AAAA-MM-DD'. Sem isso o pg cria um Date no fuso
// local e '2026-11-03' pode virar 02/11 no horário de Brasília.
pg.types.setTypeParser(1082, (valor) => valor);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Uma conexão ociosa pode cair (banco reiniciado, notebook que dormiu). Sem este
// handler o Node encerraria a API inteira; o pool descarta a conexão e abre outra.
pool.on('error', (erro) => {
  console.error('Conexão ociosa com o banco foi perdida:', erro.message);
});

export function consultar(sql, params = []) {
  return pool.query(sql, params);
}

const ignorarErro = () => {};

// Executa fn(cliente) dentro de BEGIN/COMMIT. Qualquer erro desfaz tudo (ROLLBACK)
// e é relançado. A conexão sempre volta para o pool (ou é descartada, se quebrou).
export async function emTransacao(fn) {
  const cliente = await pool.connect();
  // Enquanto a conexão está conosco, um erro "assíncrono" dela não pode derrubar a API;
  // ele também aparece como rejeição da query em andamento.
  cliente.on('error', ignorarErro);
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    cliente.off('error', ignorarErro);
    cliente.release();
    return resultado;
  } catch (erro) {
    try {
      await cliente.query('ROLLBACK');
    } catch {
      // conexão já perdida: o erro que interessa é o original
    }
    cliente.off('error', ignorarErro);
    cliente.release(erro); // com erro: o pool descarta esta conexão
    throw erro;
  }
}
